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
//     Plugin can not install when this is not set.
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

const {VimHelp, PluginManager} = require("vimhelp");
const yargs = require("yargs");
const PromisePool = require("es6-promise-pool");
const CONCURRENCY = 4;

const doActionConcurrency = (pluginNames, action, success, failure) => {
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
      .command({
        command: "install <plugin-names..>",
        desc: "Install Vim plugins",
        aliases: ["add"],
        handler: (argv) => {
          const {res, pluginManager, pluginNames} = argv;
          const action = pluginManager.install.bind(pluginManager);
          return doActionConcurrency(
            pluginNames, action,
            (name, result) => res.send(`Installation success: ${name} (${shortHash(result)})`),
            (name, error) => res.send(`Installation failure: ${name}\n${markdownPre(error.errorText)}`)
          );
        },
      })
      .command({
        command: "uninstall <plugin-names..>",
        desc: "Uninstall Vim plugins",
        aliases: ["rm", "remove", "delete"],
        handler: (argv) => {
          const {res, pluginManager, pluginNames} = argv;
          const action = pluginManager.uninstall.bind(pluginManager);
          return doActionConcurrency(
            pluginNames, action,
            (name) => res.send(`Uninstallation success: ${name}`),
            (name, error) => res.send(`Uninstallation failure: ${name}\n${markdownPre(error.errorText)}`)
          );
        },
      })
      .command({
        command: "update [plugin-names..]",
        desc: "Update Vim plugins",
        handler: (argv) => {
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
            (name, error) => res.send(`Update failure: ${name}\n${markdownPre(error.errorText)}`)
          );
        },
      })
      .command({
        command: "list",
        desc: "List Vim plugins",
        handler: (argv) => {
          const {res, pluginManager} = argv;
          res.send(pluginManager.pluginNames.join("\n"));
        },
      })
      .demandCommand()
      .strict()
      ;
  })
  .demandCommand()
  .strict()
  ;

const shortHash = (hash) => {
  return hash.substring(0, 7);
};

let enableMarkdown = true;
const markdownPre = (text) => {
  if (enableMarkdown) {
    return "```\n" + text + "\n```";
  }
  return text;
};


module.exports = (robot) => {
  enableMarkdown = process.env.HUBOT_VIMHELP_MARKDOWN !== "0";

  const vimHelp = new VimHelp(process.env.HUBOT_VIMHELP_VIM);
  if (process.env.HUBOT_VIMHELP_HELPLANG) {
    vimHelp.helplang = process.env.HUBOT_VIMHELP_HELPLANG.split(",");
  }

  const helpPattern = ":h(?:elp)?(?:\\s+(.*))$";
  const helpRegExp =
    new RegExp(
      `^${helpPattern}`,
      process.env.HUBOT_VIMHELP_MULTILINE === "1" ? "m" : ""
    );

  const handleHelp = async (word, res) => {
    try {
      const helpText = await vimHelp.search(word);
      res(markdownPre(helpText));
    } catch(e) {
      res(e.errorText);
    }
  };

  robot.hear(helpRegExp, async (res) => {
    await handleHelp(res.match[1], res.send.bind(res));
  });

  robot.respond(new RegExp(helpPattern), async (res) => {
    await handleHelp(res.match[1], res.reply.bind(res));
  });

  const PLUGINS_DIR = process.env.HUBOT_VIMHELP_PLUGINS_DIR;
  let pluginManager;
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
