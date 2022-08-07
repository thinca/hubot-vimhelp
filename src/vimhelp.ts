// Description:
//   A hubot script that shows Vim's help.
//
// Dependencies:
//   vimhelp: v2.0.0
//
// Configuration:
//   HUBOT_VIMHELP_VIM
//     Path to vim binary.
//     Use "vim" on $PATH when this is not set.
//   HUBOT_VIMHELP_PLUGINS_DIR
//     Path to a directory to install plugins.
//     Plugin cannot install when this is not set.
//   HUBOT_VIMHELP_HELPLANG
//     Comma separated value for 'helplang' options.
//     ex: ja,en
//   HUBOT_VIMHELP_MARKDOWN
//     Value is 0 or 1.  When 1, use markdown format in response.
//     Default value is 1.
//   HUBOT_VIMHELP_MULTILINE
//     Value is 0 or 1.  When 1, :help reacts to head of each line.
//     Default value is 0.
//
// Commands:
//   :help {subject} - Show the help of Vim
//   :vimhelp help - Show help for /vimhelp command
//   :vimhelp plugin install {plugin-name} - Install {plugin-name}
//   :vimhelp plugin uninstall {plugin-name} - Uninstall {plugin-name}
//   :vimhelp plugin update [{plugin-names}] - Update {plugin-names}
//   :vimhelp plugin list - Show the installed plugin list
//
// Notes:
//   This script requires Vim.
//   And, also requires Git and some disc spaces if you use plugin manager.
//
// Author:
//   thinca <thinca+npm@gmail.com>

import * as hubot from "hubot";
import {VimHelp, PluginManager, ExecError} from "vimhelp";
import * as yargs from "yargs";
import PromisePool from "es6-promise-pool";
const CONCURRENCY = 4;

const doActionConcurrency = <T>(
  pluginNames: string[],
  action: (name: string) => Promise<T>,
  success: (name: string, result: T) => void,
  failure: (name: string, error: Error) => void
) => {
  const names = pluginNames.slice();
  const promiseProducer = () => {
    const name = names.shift();
    if (!name) {
      return;
    }
    return action(name).then(
      (result) => success(name, result)
    ).catch(
      (error) => failure(name, error)
    );
  };
  const pool = new PromisePool(promiseProducer, CONCURRENCY);
  return pool.start();
};

type Argv = {
  res: Hubot.Response,
  pluginManager: PluginManager,
  pluginNames: string[],
};

const parser = yargs
  .scriptName("/vimhelp")
  .locale("en")
  .exitProcess(false)
  .version(false)
  .hide("help")
  .usage("Utilities for :help")
  .command("plugin", "Manage Vim plugins", (yargs) => {
    return yargs
      .usage("Plugin Manager for :help")
      .command<Argv>({
        command: "install <plugin-names..>",
        describe: "Install Vim plugins",
        aliases: ["add"],
        handler: async (argv) => {
          const {res, pluginManager, pluginNames} = argv;
          const action = pluginManager.install.bind(pluginManager);
          return doActionConcurrency(
            pluginNames, action,
            (name, result) => res.send(`Installation success: ${name} (${shortHash(result)})`),
            (name, error) => res.send(`Installation failure: ${name}\n${markdownPre(unknownErrorToString(error))}`)
          );
        },
      })
      .command<Argv>({
        command: "uninstall <plugin-names..>",
        describe: "Uninstall Vim plugins",
        aliases: ["rm", "remove", "delete"],
        handler: async (argv) => {
          const {res, pluginManager, pluginNames} = argv;
          const action = pluginManager.uninstall.bind(pluginManager);
          return doActionConcurrency(
            pluginNames, action,
            (name) => res.send(`Uninstallation success: ${name}`),
            (name, error) => res.send(`Uninstallation failure: ${name}\n${markdownPre(unknownErrorToString(error))}`)
          );
        },
      })
      .command<Argv>({
        command: "update [plugin-names..]",
        describe: "Update Vim plugins",
        handler: async (argv) => {
          const {res, pluginManager, pluginNames} = argv;
          const names = pluginNames || pluginManager.pluginNames;
          const action = pluginManager.update.bind(pluginManager);
          return doActionConcurrency(
            names, action,
            (name, info) => {
              if (info.updated()) {
                res.send(`Update success: ${name} (${shortHash(info.beforeVersion)} => ${shortHash(info.afterVersion)})`);
              }
            },
            (name, error) => res.send(`Update failure: ${name}\n${markdownPre(unknownErrorToString(error))}`)
          );
        },
      })
      .command<Argv>({
        command: "list",
        describe: "List Vim plugins",
        handler: (argv) => {
          const {res, pluginManager} = argv;
          res.send(pluginManager.pluginNames.join("\n"));
        },
      })
      .demandCommand()
      .strict();
  })
  .demandCommand()
  .strict();

const shortHash = (hash: string) => {
  return hash.substring(0, 7);
};

const unknownErrorToString = (err: unknown): string => {
  if (err instanceof ExecError) {
    return err.errorText;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "[Unknown Error]";
};

let enableMarkdown = true;
const markdownPre = (text: string) => {
  if (enableMarkdown) {
    return "```\n" + text + "\n```";
  }
  return text;
};


module.exports = (robot: hubot.Robot) => {
  enableMarkdown = process.env.HUBOT_VIMHELP_MARKDOWN !== "0";

  const vimHelp = new VimHelp(process.env.HUBOT_VIMHELP_VIM);
  if (process.env.HUBOT_VIMHELP_HELPLANG) {
    vimHelp.helplang = process.env.HUBOT_VIMHELP_HELPLANG.split(",");
  }

  const helpPattern = ":h(?:elp)?(?:\\s+(\\S*))";
  const helpRegExp =
    new RegExp(
      `^${helpPattern}`,
      process.env.HUBOT_VIMHELP_MULTILINE === "1" ? "m" : ""
    );

  const handleHelp = async (word: string, res: (...strings: string[]) => void) => {
    try {
      const helpText = await vimHelp.search(word);
      res(markdownPre(helpText));
    } catch(e) {
      res(unknownErrorToString(e));
    }
  };

  robot.hear(helpRegExp, async (res) => {
    await handleHelp(res.match[1], res.send.bind(res));
  });

  robot.respond(new RegExp(helpPattern), async (res) => {
    await handleHelp(res.match[1], res.reply.bind(res));
  });

  const PLUGINS_DIR = process.env.HUBOT_VIMHELP_PLUGINS_DIR;
  let pluginManager: PluginManager;
  if (PLUGINS_DIR) {
    pluginManager = new PluginManager(PLUGINS_DIR);
    vimHelp.setRTPProvider(pluginManager.rtpProvider);
  }

  robot.hear(/^[!/:]vimhelp\s*([^]*)$/, (res) => {
    if (!pluginManager) {
      res.send("ERROR: Sorry, PluginManager is unavailable.");
      return;
    }

    const argline = res.match[1];
    const args = argline.length === 0 ? [] : argline.split(/\s+/);
    parser.parse(args, {res, pluginManager}, (_err, _argv, output) => {
      if (output) {
        res.send(output);
      }
    });
  });
};
