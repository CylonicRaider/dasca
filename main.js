
/* Dasca, an idle game by @CylonicRaider (github.com/CylonicRaider/dasca)
 * Game implementation */

'use strict';

var _game;

/* *** Utilities *** */

/* Shortcut for getElementById */
function $id(id, ctx) {
  return (ctx || document).getElementById(id);
}

/* Shortcut for querySelector */
function $sel(sel, ctx) {
  return (ctx || document).querySelector(sel);
}

/* Create a DOM element */
function $make(name, className, attrs, children) {
  /* Create node */
  var ret = document.createElement(name);
  /* Set classes */
  if (className) ret.className = className;
  /* Set additional attributes */
  if (attrs) {
    for (var name in attrs) {
      if (! attrs.hasOwnProperty(name)) continue;
      ret.setAttribute(name, attrs[name]);
    }
  }
  /* Add children */
  if (children) {
    if (typeof children == "string") children = [children];
    for (var i = 0; i < children.length; i++) {
      var e = children[i];
      if (typeof e == "string") {
        /* Strings become text nodes */
        ret.appendChild(document.createTextNode(e));
      } else if (typeof e != "object") {
        /* Other primitive types are not allowed */
        throw new Error("Bad child encountered during DOM node creation");
      } else if (Array.isArray(e)) {
        /* Arrays are handled recursively */
        ret.appendChild($make.apply(null, e));
      } else {
        /* Everything else is assumed to be a DOM node */
        ret.appendChild(e);
      }
    }
  }
  return ret;
}

/* *** Action ***
 * A serializable (and reifiable) function wrapper, usable as a Scheduler
 * task. */

/* Construct a new action
 * name idenfities what to perform, extra may be used to pass additional data
 * to the action, context contains further additional data.
 * While extra is serialized, context is not; thus, name and extra should
 * completely idenfity the action, and context should contain references to
 * objects which are otherwise unattainable. */
function DascaAction(name, extra, context) {
  this.name = name;
  this.extra = extra;
  this.context = context;
  if (DascaAction.handlers[name]) {
    this.cb = DascaAction.handlers[name];
  } else {
    throw new Error("Unknown action " + name);
  }
}

DascaAction.prototype = {
  /* OOP helper */
  constructor: DascaAction
};

/* Collection of handlers for actions */
DascaAction.handlers = {};

/* Add a handler to the list */
DascaAction.addHandler = function(name, cb) {
  DascaAction.handlers[name] = cb;
};

/* Serialization hook */
DascaAction.__save__ = function(action) {
  return {name: action.name, extra: action.extra || undefined};
}

/* Deserialization hook */
DascaAction.__restore__ = function(data, context) {
  return new DascaAction(data.name, data.extra, context);
}

/* *** Variables ***
 * Each variable has a name and a (mutable) value; when the value is changed
 * via the setter method, callbacks registered for the variable (statically)
 * are invoked, each with "this" set to the variable, and the name, the new,
 * and the old value as arguments.
 * Callbacks are registered statically to aid serialization. */

/* Construct a new variable */
function Variable(name, value) {
  this.name = name;
  this.value = value;
}

Variable.prototype = {
  /* Get the value of the variable */
  get: function() {
    return this.value;
  },

  /* Set the value of the variable
   * If the value changes, callbacks are invoked. */
  set: function(value) {
    if (value === this.value) return;
    var oldVal = this.value;
    this.value = value;
    var cbs = callbacks[this.name];
    if (cbs) {
      for (var i = 0; i < cbs.length; i++)
        cbs[i].call(this, this.name, value, oldVal);
    }
  },

  /* OOP noise */
  constructor: Variable
}

/* Mapping of variable names to values */
Variable.callbacks = {};

/* Register the given callback for the given variable name */
Variable.addCallback = function(name, cb) {
  if (! Variable.callbacks[name])
    Variable.callbacks[name] = [];
  if (Variable.callbacks[name].indexOf(cb) == -1)
    Variable.callbacks[name].push(cb);
};

/* Deregister the given callback */
Variable.removeCallback = function(name, cb) {
  if (! Variable.callbacks[name]) return;
  var idx = Variable.callbacks[name].indexOf(cb);
  if (idx != -1) Variable.callbacks[name].splice(idx, 1);
};

/* *** Game objects *** */

/* Construct a new Game
 * state is either null (to indicate the creation of a fresh game), or a
 * string containing a serialized GameState, which is restored. */
function Game(state) {
  this.context = Object.create(window);
  this.context.game = this;
  if (state) {
    this.state = deserialize(state, this.context);
  } else {
    this.state = new GameState();
  }
  this.ui = new GameUI(this);
  this.running = true;
  this.paused = false;
}

Game.prototype = {
  /* Save the game state to a string */
  save: function() {
    return serialize(this.state);
  },

  /* Actually commence game here */
  init: function() {
    var sched = this.state.scheduler;
    sched.clock.setTime(0);
    var texts = [[["i", null, null, "Darkness."], 1],
                 [["i", null, null, "Silence."], 3],
                 [["i", null, null, "Confinement."], 5],
                 [["i", null, null, "Amnesia."], 8]];
    texts.forEach(function(x) {
      sched.addTask(new DascaAction("showMessage", x[0], this.context),
                    x[1]);
    }, this);
    sched.addTask(new DascaAction("showTab", "starttab", this.context), 10);
  },

  /* Pause the game */
  pause: function() {
    this.paused = true;
    this.state.scheduler.clock.setScale(0);
    this.ui._updatePause();
  },

  /* Unpause the game */
  unpause: function() {
    this.paused = false;
    this.state.scheduler.clock.setScale(1);
    this.ui._updatePause();
  },

  /* OOP hook */
  constructor: Game
};

/* Construct a new game state
 * For restoring a saved state, use deserialization. */
function GameState() {
  this.scheduler = Scheduler.makeStrobe(100);
  this.messages = [];
  this.currentTab = null;
  this.lighterVisible = false;
}

GameState.prototype = {
  /* OOP necessity */
  constructor: GameState
};

/* Construct a new game UI */
function GameUI(game) {
  this.game = game;
  this.root = null;
}

GameUI.prototype = {
  /* Install the game UI into the given node */
  mount: function(node) {
    this.root = node;
    /* Create basic node structure */
    node.innerHTML = "";
    node.appendChild($make("div", "row row-all", {id: "gamepane"}, [
      ["div", "col col-quarter inset", null, [
        ["div", null, {id: "messagebar"}]
      ]],
      ["div", "col col-all", null, [
        ["div", "row row-small inset", {id: "tabbar"}],
        ["div", "row row-all inset", null, [
          ["div", "col-all pane", {id: "mainpane"}, [
            ["div", "selectable layer", {id: "starttab"}, [
              ["button", "btn", {id: "btn-pockets"},
                "Check pockets"],
              ["div", "item-card hidable hidden", {id: "card-lighter"}, [
                ["strong", "item-name", null, "Lighter"],
                ["button", "btn btn-small item-use", {id: "use-lighter"},
                  "Ignite"],
                ["div", "item-bar", null, [
                  ["div", "item-bar-content", {style: "width: 80%"}]
                ]]
              ]]
            ]]
          ]]
        ]]
      ]],
      ["div", "col col-quarter inset", {id: "inventbar"}]
    ]));
    node.appendChild($make("div", "row row-small inset", {id: "bottombar"}, [
      ["button", "btn btn-small dim", {id: "credits-game"}, "Credits"],
      ["div", "col-all"],
      ["button", "btn btn-small", {id: "pause-game"}, "Pause"]
    ]));
    /* Restore state */
    if (this.game.state.messages.length) {
      var m = this.game.state.messages;
      for (var i = 0; i < m.length; i++)
        this._showMessage(messages[i], true);
    }
    if (this.game.state.lighterVisible) {
      $id("btn-pockets").classList.add("hidden");
      $id("card-lighter").classList.remove("hidden");
    }
    /* Install button handlers */
    $id("credits-game").addEventListener("click", function() {
      showNode("creditscreen");
      this.game.pause();
    }.bind(this));
    $id("pause-game").addEventListener("click", function() {
      if (this.game.paused) {
        this.game.unpause();
      } else {
        this.game.pause();
      }
    }.bind(this));
    $id("btn-pockets").addEventListener("click", function() {
      this.showMessage("You find a lighter.");
      $id("btn-pockets").classList.add("hidden");
      $id("card-lighter").classList.remove("hidden");
      this.game.state.lighterVisible = true;
    }.bind(this));
    $id("use-lighter").addEventListener("click", function() {
      this.showMessage("The flame looks funny... Oh, right.");
      this.showMessage(["em", null, null, "Lack of gravity."]);
      this.showMessage("\u2014 NYI after this point :( \u2014");
    }.bind(this));
  },

  /* Adapt the UI to the current pause state of the game */
  _updatePause: function() {
    if (this.game.paused) {
      $id("pause-game").textContent = "Resume";
    } else {
      $id("pause-game").textContent = "Pause";
    }
  },

  /* Append a message to the message bar without updating the game state
   * Used internally. */
  _showMessage: function(msg) {
    var msgnode = $make("p", "log-message", null, [msg]);
    var msgbar = $id("messagebar");
    msgbar.appendChild(msgnode);
    msgbar.scrollTop = msgbar.scrollHeight;
  },

  /* Append a message to the message bar */
  showMessage: function(msg) {
    this._showMessage(msg);
    this.game.state.messages.push(msg);
  },

  /* Show the given main area tab */
  showTab: function(tabname) {
    if (tabname) {
      showNode(tabname);
    } else {
      hideNodes("mainpane");
    }
    this.game.state.currentTab = tabname;
  },

  /* OOP annoyance */
  constructor: GameUI
};

/* Handler for showing messages */
DascaAction.addHandler("showMessage", function() {
  this.context.game.ui.showMessage(this.extra);
});

/* Handler for showing tabs */
DascaAction.addHandler("showTab", function() {
  this.context.game.ui.showTab(this.extra);
});

/* *** UI control *** */

/* Show the given UI element, hiding any siblings and showing all its
 * showable parents */
function showNode(node) {
  if (! node) return;
  /* Resolve ID-s */
  if (typeof node == "string") node = $id(node);
  /* Hide siblings */
  var prev = node.previousElementSibling, next = node.nextElementSibling;
  while (prev) {
    if (prev.classList.contains("selectable"))
      prev.classList.remove("selected");
    prev = prev.previousElementSibling;
  }
  while (next) {
    if (next.classList.contains("selectable"))
      next.classList.remove("selected");
    next = next.nextElementSibling;
  }
  /* Show parent */
  showNode(node.parentNode);
  /* Show node */
  if (node.classList && node.classList.contains("selectable"))
    node.classList.add("selected");
}

/* Hide all selectable children of node
 * Approximate opposite of showNode. */
function hideNodes(node) {
  if (! node) return;
  /* Resolve ID-s */
  if (typeof node == "string") node = $id("node");
  /* Hide children */
  for (var ch = node.firstElementChild; ch; ch = ch.nextElementSibling) {
    if (ch.classList.contains("selectable"))
      ch.classList.remove("selected");
  }
}

/* *** Initialization *** */

function init() {
  var game;
  showNode("titlescreen");
  $id("startgame").addEventListener("click", function() {
    game = new Game();
    _game = game;
    game.ui.mount($id("mainscreen"));
    showNode("mainscreen");
    game.init();
  });
  $id("credits-title").addEventListener("click", function() {
    showNode("creditscreen");
    if (game) game.pause();
  });
  $id("back-credits").addEventListener("click", function() {
    if (game && game.running) {
      if (game) game.unpause();
      showNode("mainscreen");
    } else {
      showNode("titlescreen");
    }
  });
}

/* Install load handler */
window.addEventListener("load", init);
