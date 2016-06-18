# hubot-vimhelp

[![NPM Version][npm-image]][npm-url]
[![Node.js Version][node-version-image]][node-version-url]
[![Linux Build][travis-image]][travis-url]
[![Test Coverage][coveralls-image]][coveralls-url]

A hubot script that shows Vim's help.

See [`scripts/vimhelp.js`](scripts/vimhelp.js) for full documentation.

## Requirements

- Node.js v6.0.0+

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

[npm-image]: https://img.shields.io/npm/v/hubot-vimhelp.svg
[npm-url]: https://npmjs.org/package/hubot-vimhelp
[node-version-image]: https://img.shields.io/node/v/hubot-vimhelp.svg
[node-version-url]: https://nodejs.org/en/download/
[travis-image]: https://img.shields.io/travis/thinca/hubot-vimhelp/master.svg?label=linux
[travis-url]: https://travis-ci.org/thinca/hubot-vimhelp
[coveralls-image]: https://img.shields.io/coveralls/thinca/hubot-vimhelp/master.svg
[coveralls-url]: https://coveralls.io/r/thinca/hubot-vimhelp?branch=master
