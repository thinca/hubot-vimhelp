const chai = require("chai");
const sinon = require("sinon");
chai.use(require("sinon-chai"));
require("coffee-script/register");
const Helper = require("hubot-test-helper");
const helper = new Helper("../scripts/vimhelp.js");
const vimhelp = require("vimhelp");
const {VimHelp, PluginManager} = vimhelp;

const {expect} = chai;


const spyConstructor = (ns, className) => {
  const spy = sinon.spy();
  const StubClass = class extends ns[className] {
    constructor(...args) {
      super(...args);
      spy(...args);
    }
  };
  const original = ns[className];
  spy.restore = () => {
    ns[className] = original;
  };
  ns[className] = StubClass;
  return spy;
};

const stubProperty = (obj, propName) => {
  const stub = sinon.stub();
  const originalDescriptor = Object.getOwnPropertyDescriptor(obj, propName);
  const hasOriginalValue = originalDescriptor ? null : obj.hasOwnProperty(propName);
  const originalValue = originalDescriptor ? null : obj[propName];
  Object.defineProperty(obj, propName, {
    configurable: true,
    enumerable: true,
    get: stub,
    set: stub
  });
  stub.restore = () => {
    if (originalDescriptor) {
      Object.defineProperty(obj, propName, originalDescriptor);
    } else {
      delete obj[propName];
      if (hasOriginalValue) {
        obj[propName] = originalValue;
      }
    }
  };
  return stub;
};

const spyVimHelp = spyConstructor(vimhelp, "VimHelp");
const spyPluginManager = spyConstructor(vimhelp, "PluginManager");

const tempEnv = (envs) => {
  const originals = {};
  for (const key of Object.keys(envs)) {
    originals[key] = process.env[key];
    const value = envs[key];
    if (value) {
      process.env[key] = envs[key];
    } else {
      delete process.env[key];
    }
  }
  return () => {
    for (const key of Object.keys(envs)) {
      if (originals[key]) {
        process.env[key] = originals[key];
      } else {
        delete process.env[key];
      }
    }
  };
};

const envWith = (envs) => {
  let restoreEnv;
  before(() => {
    restoreEnv = tempEnv(envs);
  });
  after(() => {
    restoreEnv();
  });
};

describe('hubot-vimhelp', () => {
  let room;

  beforeEach(() => {
    spyVimHelp.reset();
    spyPluginManager.reset();
    room = helper.createRoom();
  });

  afterEach(() => {
    room.destroy();
  });

  describe("Configuration", () => {
    describe("$HUBOT_VIMHELP_VIM", () => {
      envWith({HUBOT_VIMHELP_VIM: "/path/to/vim"});

      it("will be passed to constructor of VimHelp", () => {
        expect(spyVimHelp).to.have.been.calledWith("/path/to/vim");
      });
    });

    describe("$HUBOT_VIMHELP_PLUGINS_DIR", () => {
      context("when the value is set", () => {
        envWith({HUBOT_VIMHELP_PLUGINS_DIR: "/path/to/plugins"});
        it("will be passed to constructor of PluginManager", () => {
          expect(spyPluginManager).to.have.been.calledWith("/path/to/plugins");
        });
      });

      context("when the value is not set", () => {
        envWith({HUBOT_VIMHELP_PLUGINS_DIR: ""});
        it("turns off the PluginManager", () => {
          expect(spyPluginManager).to.have.callCount(0);
        });
      });
    });

    describe("$HUBOT_VIMHELP_HELPLANG", () => {
      envWith({HUBOT_VIMHELP_HELPLANG: "ja,en"});
      let stub;
      before(() => {
        stub = stubProperty(VimHelp.prototype, "helplang");
      });
      after(() => {
        stub.restore();
      });
      it("sets helplang of VimHelp", () => {
        expect(stub).to.have.been.calledWith(["ja", "en"]);
      });
    });
  });

  describe(":help", () => {
    before(() => {
      sinon.stub(VimHelp.prototype, "search")
        .withArgs("help").returns(
          Promise.resolve("*help*")
        )
        .withArgs("non-existing").returns(
          Promise.reject({errorText: "E149: Sorry, no help for not-existing"})
        );
    });
    after(() => {
      VimHelp.prototype.search.restore();
    });

    const testHelpWith = (done, cmd, res) => {
      res = res || "```\n*help*\n```";
      room.user.say("bob", cmd).then(() => {
        expect(room.messages).to.eql([
          ["bob", cmd],
          ["hubot", res]
        ]);
        done();
      }).catch(done);
    };

    it("shows help", (done) => {
      testHelpWith(done, ":help help");
    });

    it("can be omitted to :h", (done) => {
      testHelpWith(done, ":h help");
    });

    context("$HUBOT_VIMHELP_MARKDOWN is 0", () => {
      envWith({HUBOT_VIMHELP_MARKDOWN: "0"});
      it("responses without markdown", (done) => {
        testHelpWith(done, ":help help", "*help*");
      });
    });

    context("with non-existing subject", () => {
      it("reports an error", (done) => {
        room.user.say("bob", ":help non-existing").then(() => {
          expect(room.messages).to.eql([
            ["bob", ":help non-existing"],
            ["hubot", "E149: Sorry, no help for not-existing"]
          ]);
          done();
        }).catch(done);
      });
    });
  });

  describe("/vimhelp", () => {
    context("when HUBOT_VIMHELP_PLUGINS_DIR is empty", () => {
      envWith({HUBOT_VIMHELP_PLUGINS_DIR: null});
      it("shows error message", (done) => {
        room.user.say("bob", "/vimhelp").then(() => {
          expect(room.messages).to.eql([
            ["bob", "/vimhelp"],
            ["hubot", "ERROR: Sorry, PluginManager is unavailable."]
          ]);
          done();
        }).catch(done);
      });
    });

    const HELP_TEXT = `Plugin Manager for :help

Usage: /vimhelp plugin {cmd} {args}

  add/install {plugin-name}
  rm/remove/uninstall/delete {plugin-name}
  update [{plugin-name}]
  list
`;

    describe("no arguments", () => {
      envWith({HUBOT_VIMHELP_PLUGINS_DIR: "/path/to/plugins"});
      it("shows help message", (done) => {
        room.user.say("bob", "/vimhelp").then(() => {
          expect(room.messages).to.eql([
            ["bob", "/vimhelp"],
            ["hubot", HELP_TEXT]
          ]);
          done();
        }).catch(done);
      });
    });

    describe("help", () => {
      envWith({HUBOT_VIMHELP_PLUGINS_DIR: "/path/to/plugins"});
      it("shows help message", (done) => {
        room.user.say("bob", "/vimhelp help").then(() => {
          expect(room.messages).to.eql([
            ["bob", "/vimhelp help"],
            ["hubot", HELP_TEXT]
          ]);
          done();
        }).catch(done);
      });
    });

    describe("plugin", () => {
      envWith({HUBOT_VIMHELP_PLUGINS_DIR: "/path/to/plugins"});

      describe("install", () => {
        before(() => {
          sinon.stub(PluginManager.prototype, "install")
            .withArgs("success").returns(
              Promise.resolve("0123456789012345678901234567890123456789")
            )
            .withArgs("failure").returns(
              Promise.reject({errorText: "ERROR"})
            );
        });
        after(() => {
          PluginManager.prototype.install.restore();
        });

        context("when a plugin exists", () => {
          it("shows a success message", (done) => {
            room.user.say("bob", "/vimhelp plugin install success").then(() => {
              expect(room.messages).to.eql([
                ["bob", "/vimhelp plugin install success"],
                ["hubot", "Installation success: success (0123456)"]
              ]);
              done();
            }).catch(done);
          });
        });

        context("when a plugin does not exist", () => {
          it("shows a failure message", (done) => {
            room.user.say("bob", "/vimhelp plugin install failure").then(() => {
              expect(room.messages).to.eql([
                ["bob", "/vimhelp plugin install failure"],
                ["hubot", "Installation failure: failure\n```\nERROR\n```"]
              ]);
              done();
            }).catch(done);
          });
        });
      });

      describe("uninstall", () => {
        before(() => {
          sinon.stub(PluginManager.prototype, "uninstall")
            .withArgs("success").returns(
              Promise.resolve("/path/to/success")
            )
            .withArgs("failure").returns(
              Promise.reject({errorText: "ERROR"})
            );
        });
        after(() => {
          PluginManager.prototype.uninstall.restore();
        });

        context("when a plugin exists", () => {
          it("shows a success message", (done) => {
            room.user.say("bob", "/vimhelp plugin uninstall success").then(() => {
              expect(room.messages).to.eql([
                ["bob", "/vimhelp plugin uninstall success"],
                ["hubot", "Uninstallation success: success"]
              ]);
              done();
            }).catch(done);
          });
        });

        context("when a plugin does not exist", () => {
          it("shows a failure message", (done) => {
            room.user.say("bob", "/vimhelp plugin uninstall failure").then(() => {
              expect(room.messages).to.eql([
                ["bob", "/vimhelp plugin uninstall failure"],
                ["hubot", "Uninstallation failure: failure\n```\nERROR\n```"]
              ]);
              done();
            }).catch(done);
          });
        });
      });

      describe("update", () => {
        beforeEach(() => {
          sinon.stub(PluginManager.prototype, "update")
            .withArgs("updated").returns(
              Promise.resolve({
                pluginName: "updated",
                pluginPath: "/path/to/updated",
                beforeVersion: "0123456789012345678901234567890123456789",
                afterVersion: "5678901234567890123456789012345678901234",
                updated() {
                  return this.beforeVersion !== this.afterVersion;
                }
              })
            )
            .withArgs("no-updated").returns(
              Promise.resolve({
                pluginName: "no-updated",
                pluginPath: "/path/to/no-updated",
                beforeVersion: "0123456789012345678901234567890123456789",
                afterVersion: "0123456789012345678901234567890123456789",
                updated() {
                  return this.beforeVersion !== this.afterVersion;
                }
              })
            )
            .withArgs("failure").returns(
              Promise.reject({errorText: "ERROR"})
            );
        });
        afterEach(() => {
          PluginManager.prototype.update.restore();
        });

        context("with no arguments", () => {
          let stub;
          before(() => {
            stub = stubProperty(PluginManager.prototype, "pluginNames").returns(["updated", "no-updated"]);
          });
          after(() => {
            stub.restore();
          });
          it("updates all plugins", (done) => {
            room.user.say("bob", "/vimhelp plugin update").then(() => {
              expect(room.messages).to.eql([
                ["bob", "/vimhelp plugin update"],
                ["hubot", "Update success: updated (0123456 => 5678901)"]
              ]);
              done();
            }).catch(done);
          });
        });

        context("when a plugin is updated", () => {
          it("shows an updated message", (done) => {
            room.user.say("bob", "/vimhelp plugin update updated").then(() => {
              expect(room.messages).to.eql([
                ["bob", "/vimhelp plugin update updated"],
                ["hubot", "Update success: updated (0123456 => 5678901)"]
              ]);
              done();
            }).catch(done);
          });
        });

        context("when a plugin is not updated", () => {
          it("does not show the message", (done) => {
            room.user.say("bob", "/vimhelp plugin update no-updated").then(() => {
              expect(room.messages).to.eql([
                ["bob", "/vimhelp plugin update no-updated"]
              ]);
              done();
            }).catch(done);
          });
        });

        context("when a plugin does not exist", () => {
          it("shows a failure message", (done) => {
            room.user.say("bob", "/vimhelp plugin update failure").then(() => {
              expect(room.messages).to.eql([
                ["bob", "/vimhelp plugin update failure"],
                ["hubot", "Update failure: failure\n```\nERROR\n```"]
              ]);
              done();
            }).catch(done);
          });
        });
      });

      describe("list", () => {
        let stub;
        before(() => {
          stub = stubProperty(PluginManager.prototype, "pluginNames").returns(["updated", "no-updated"]);
        });
        after(() => {
          stub.restore();
        });
        it("shows list of installed plugins", (done) => {
          room.user.say("bob", "/vimhelp plugin list").then(() => {
            expect(room.messages).to.eql([
              ["bob", "/vimhelp plugin list"],
              ["hubot", "updated\nno-updated"]
            ]);
            done();
          }).catch(done);
        });
      });
    });
  });
});