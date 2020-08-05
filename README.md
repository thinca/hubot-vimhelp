# hubot-vimhelp

[![NPM Version][npm-image]][npm-url]
[![Node.js Version][node-version-image]][node-version-url]
[![Build Status][travis-image]][travis-url]
[![Test Coverage][codecov-image]][codecov-url]

A hubot script that shows Vim's help.

See [`scripts/vimhelp.js`](scripts/vimhelp.js) for full documentation.

## Requirements

- Node.js v12.10.0+

- [vimhelp](https://github.com/thinca/node-vimhelp)
  - Vim
  - Git (Optional)

## Installation

In hubot project repo, run:

`npm install hubot-vimhelp --save`

Then add **hubot-vimhelp** to your `external-scripts.json`:

```json
[
  "hubot-vimhelp"
]
```

## Sample Interaction

```
user1>> :help j
hubot>>
j               or                                      *j*
<Down>          or                                      *<Down>*
CTRL-J          or                                      *CTRL-J*
<NL>            or                                      *<NL>* *CTRL-N*
CTRL-N                  [count] lines downward |linewise|.
```

## Commands

### :help

Show the help of Vim.
`:h` which is a shortcut version is available.

### :vimhelp

This is a command for administrator.
Some sub commands exist.

#### :vimhelp help

Show the simple help of `:vimhelp`.

#### :vimhelp plugin

This command manages the Vim plugins.
User can show the help of Vim plugin after you installed a Vim plugin.

User can specify the {plugin-name} by the one of following formats:

- A repository name of [vim-scripts](https://github.com/vim-scripts)
- A GitHub repository in `owner/repos` style
- A URL of Git repository

##### :vimhelp plugin install/add {plugin-name}...

Install Vim plugins.  You can specify one or more plugin names.

##### :vimhelp plugin uninstall/rm/remove/delete {plugin-name}...

Uninstall Vim plugins.  You can specify one or more plugin names.

##### :vimhelp plugin update [{plugin-name}...]

Update installed Vim plugins.  You can specify one or more plugin names.
All Vim plugins are updated when `{plugin-name}` is not specified.

##### :vimhelp plugin list

Show the list of installed Vim plugins.


## License

[zlib License](LICENSE.txt)

## Author

thinca <thinca+npm@gmail.com>


[npm-image]: https://img.shields.io/npm/v/hubot-vimhelp.svg
[npm-url]: https://npmjs.org/package/hubot-vimhelp
[node-version-image]: https://img.shields.io/node/v/hubot-vimhelp.svg
[node-version-url]: https://nodejs.org/en/download/
[travis-image]: https://travis-ci.com/thinca/hubot-vimhelp.svg?branch=master
[travis-url]: https://travis-ci.com/thinca/hubot-vimhelp
[codecov-image]: https://codecov.io/gh/thinca/hubot-vimhelp/branch/master/graph/badge.svg
[codecov-url]: https://codecov.io/gh/thinca/hubot-vimhelp
