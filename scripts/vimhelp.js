// Description:
//   A hubot script that shows Vim's help.
//
// Dependencies:
//   vimhelp: v1.2.1
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
//
// Commands:
//   :help {subject} - Show the help of Vim
//   /vimhelp help - Show help for /vimhelp command
//   /vimhelp plugin install {plugin-name} - Install {plugin-name}
//   /vimhelp plugin uninstall {plugin-name} - Uninstall {plugin-name}
//   /vimhelp plugin update [{plugin-names}] - Update {plugin-names}
//   /vimhelp plugin list - Show the installed plugin list
//
// Notes:
//   This script requires Vim.
//   And, also requires Git and some disc spaces if you use plugin manager.
//
// Author:
//   thinca <thinca+npm@gmail.com>

const {VimHelp, PluginManager} = require("vimhelp");
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
  pool.start();
};

const CommandDefinition = {
  help(args, {res}) {
    res.send(HELP_TEXT);
  },
  plugin: {
    install(args, {res, pluginManager}) {
      const action = pluginManager.install.bind(pluginManager);
      doActionConcurrency(
        args, action,
        (name, result) => res.send(`Installation success: ${name} (${shortHash(result)})`),
        (name, error) => res.send(`Installation failure: ${name}\n${markdownPre(error.errorText)}`)
      );
    },
    uninstall(args, {res, pluginManager}) {
      const action = pluginManager.uninstall.bind(pluginManager);
      doActionConcurrency(
        args, action,
        (name) => res.send(`Uninstallation success: ${name}`),
        (name, error) => res.send(`Uninstallation failure: ${name}\n${markdownPre(error.errorText)}`)
      );
    },
    update(args, {res, pluginManager}) {
      const pluginNames = args.length !== 0 ? args : pluginManager.pluginNames;
      const action = pluginManager.update.bind(pluginManager);
      doActionConcurrency(
        pluginNames, action,
        (name, info) => {
          if (info.updated()) {
            res.send(`Update success: ${name} (${shortHash(info.beforeVersion)} => ${shortHash(info.afterVersion)})`);
          }
        },
        (name, error) => res.send(`Update failure: ${name}\n${markdownPre(error.errorText)}`)
      );
    },
    list(args, {res, pluginManager}) {
      res.send(pluginManager.pluginNames.join("\n"));
    }
  }
};
CommandDefinition.plugin.add = CommandDefinition.plugin.install;
CommandDefinition.plugin.rm = CommandDefinition.plugin.uninstall;
CommandDefinition.plugin.remove = CommandDefinition.plugin.uninstall;
CommandDefinition.plugin.delete = CommandDefinition.plugin.uninstall;

const HELP_TEXT = `Plugin Manager for :help

Usage: /vimhelp plugin {cmd} {args}

  add/install {plugin-name}
  rm/remove/uninstall/delete {plugin-name}
  update [{plugin-name}]
  list
`;

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

  robot.hear(/^:h(?:elp)?(?:\s+(.*))?/, (res) => {
    const word = res.match[1];
    vimHelp.search(word).then((helpText) => {
      res.send(markdownPre(helpText));
    }).catch((error) => {
      res.send(error.errorText);
    });
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

    const args = res.match[1].split(/\s+/);
    const context = {res, pluginManager};
    let definition = CommandDefinition;
    while (typeof definition === "object") {
      const cmd = args.shift();
      if (typeof definition[cmd] === "function") {
        const cont = definition[cmd](args, context);
        if (!cont) {
          definition = definition[cmd];
        }
      } else {
        definition = definition[cmd];
      }
    }
    if (!definition) {
      res.send(HELP_TEXT);
    }
  });
};
