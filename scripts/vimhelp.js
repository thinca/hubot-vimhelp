// Description:
//   A hubot script that shows Vim's help.
//
// Dependencies:
//   vimhelp: v1.0.1
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

const CommandDefinition = {
  help(args, {res}) {
    res.send(HELP_TEXT);
  },
  plugin: {
    install(args, {res, pluginManager}) {
      args.forEach((pluginName) => {
        pluginManager.install(pluginName).then((result) => {
          res.send(`Installation success: ${pluginName} (${shortHash(result)})`);
        }).catch((error) => {
          res.send(`Installation failure: ${pluginName}\n\`\`\`\n${error.errorText}\n\`\`\``);
        });
      });
    },
    uninstall(args, {res, pluginManager}) {
      args.forEach((pluginName) => {
        pluginManager.uninstall(pluginName).then(() => {
          res.send(`Uninstallation success: ${pluginName}`);
        }).catch((error) => {
          res.send(`Uninstallation failure: ${pluginName}\n\`\`\`\n${error.errorText}\n\`\`\``);
        });
      });
    },
    update(args, {res, pluginManager}) {
      const pluginNames = args.length !== 0 ? args : pluginManager.pluginNames;
      pluginNames.forEach((pluginName) => {
        pluginManager.update([pluginName]).then(([info]) => {
          if (info.updated()) {
            res.send(`Update success: ${pluginName} (${shortHash(info.beforeVersion)} => ${shortHash(info.afterVersion)})`);
          }
        }).catch((error) => {
          res.send(`Update failure: ${pluginName}\n\`\`\`\n${error.errorText}\n\`\`\``);
        });
      });
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


module.exports = (robot) => {
  const vimHelp = new VimHelp(process.env.HUBOT_VIMHELP_VIM);
  if (process.env.HUBOT_VIMHELP_HELPLANG) {
    vimHelp.helplang = process.env.HUBOT_VIMHELP_HELPLANG.split(",");
  }

  robot.hear(/^:h(?:elp)?(?:\s+(.*))?/, (res) => {
    const word = res.match[1];
    vimHelp.search(word).then((helpText) => {
      res.send("```\n" + helpText + "\n```");
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

  robot.hear(/^[!/:]vimhelp\s*(.*)$/, (res) => {
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
