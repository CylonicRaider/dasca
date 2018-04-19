
/* Dasca, an idle game by @CylonicRaider (github.com/CylonicRaider/dasca)
 * Abstract engine for JS-based idle games */

'use strict';

/* *** Scheduler ***
 *
 * Runs callbacks at a defined rate. */

/* Construct a new scheduler
 *
 * Callbacks are run in "iterations". Scheduler attempts to have the
 * iterations run at an even rate of fps frames per second; if that fails,
 * iterations are run in batches such that fps is preserved on average. */
function Scheduler(fps) {
  this.fps = fps;
  this.running = false;
  this.iteration = 0;
  this.tasks = [];
  this.contTasks = [];
  this._timer = null;
  this._lastRun = null;
  this._onerror = null;
}

Scheduler.prototype = {
  /* Schedule a task to be run
   *
   * task should have a cb property, which is invoked with this Scheduler
   * instance as the only argument (and the task object as the context). time
   * is the absolute iteration number the task is going to be run on; if not
   * null, it is assigned to task as a property; if task has no non-null
   * "time" property after that, it defaults to zero, so that the task will
   * run on the next iteration.
   *
   * Returns the task parameter. */
  addTask: function(task, time) {
    if (time != null) task.time = time;
    if (task.time == null) task.time = 0;
    var i;
    for (i = 0; i < this.tasks.length; i++) {
      if (this.tasks[i].time > task.time) break;
    }
    this.tasks.splice(i, 0, task);
    return task;
  },

  /* Schedule a task to be run after some iterations
   *
   * See addTask() for the semantics of task (in particular, its "time"
   * property remains absolute). delay is the amount of iterations the task
   * stays idle for before it is run; values no greater than zero cause the
   * task to run on the next iteration.
   *
   * Returns the task parameter. */
  addTaskIn: function(task, delay) {
    return this.addTask(task, this.iteration + delay);
  },

  /* Schedule task to be run on every iteration henceforth
   *
   * task should have a cb property as detailed in addTask(). To un-schedule
   * task, see removeContTask().
   *
   * Returns the task parameter. */
  addContTask: function(task) {
    this.contTasks.push(task);
    return task;
  },

  /* Cancel the individual scheduling of task */
  removeTask: function(task) {
    var idx = this.tasks.indexOf(task);
    if (idx != -1) this.tasks.splice(idx, 1);
  },

  /* Cancel the continuous scheduling of task */
  removeContTask: function(task) {
    var idx = this.contTasks.indexOf(task);
    if (idx != -1) this.contTasks.splice(idx, 1);
  },

  /* Actually run the given task */
  _runTask: function(task) {
    try {
      task.cb(this);
    } catch (e) {
      if (this._onerror) {
        try {
          this._onerror(e);
        } catch (e2) {
          console.error('Exception while running error handler:', e2);
        }
      } else {
        console.error('Exception while running task:', e);
      }
    }
  },

  /* Perform a single iteration of the scheduler */
  _runIteration: function() {
    while (this.tasks.length) {
      if (this.tasks[0].time > this.iteration) break;
      var task = this.tasks.splice(0, 1)[0];
      this._runTask(task);
    }
    var tasklist = this.contTasks.slice();
    for (var i = 0; i < tasklist.length; i++) {
      this._runTask(tasklist[i]);
    }
    this.iteration++;
  },

  /* Perform another run of the scheduler, if it is to be running */
  _checkRun: function() {
    if (this.running) this.run();
  },

  /* Force the scheduler to run (again) */
  run: function() {
    this.running = true;
    if (this._lastRun != null) {
      var now = Date.now();
      while (this.running && this._lastRun <= now) {
        this._runIteration();
        this._lastRun += 1000.0 / this.fps;
      }
    } else {
      this._runIteration();
      this._lastRun = Date.now();
    }
    if (this.running) {
      setTimeout(this._checkRun, 1000.0 / this.fps, this);
    } else {
      this._lastRun = null;
    }
  },

  /* Stop the scheduler after the current iteration */
  stop: function() {
    this.running = false;
  },

  constructor: Scheduler
};

/* *** Serialization ***
 *
 * Serializes object trees (without self references) into JSON strings,
 * allowing reified objects to be of the correct type, and to hook their
 * (de)serialization process. Input containing enumerable function properties
 * is rejected (since those are silently swallowed by JSON); use hooks or the
 * Action class below to serialize references to functions. When hooks are
 * not used, properties whose names start with underscores are removed. */

/* Resolve a dotted name string to an object */
function findObject(name, env) {
  if (env == null) env = window;
  var cur = env, spl = name.split(".");
  for (var i = 0; i < spl.length; i++) {
    cur = cur[spl[i]];
  }
  return cur;
}

/* Serialize an object tree to JSON, storing type information */
function serialize(obj) {
  return JSON.stringify(obj, function(name, value) {
    /* Fail verbosely */
    if (typeof value == "function")
      throw new Error("Cannot serialize function");
    /* Only transform object values */
    if (typeof value != "object" || Array.isArray(value)) return value;
    if (value === null) return null;
    /* Get a meaningful constructor name */
    var cons = value.__sername__;
    if (! cons) cons = value.constructor.name;
    if (! cons) cons = Object.prototype.toString(value).slice(8, -1);
    if (cons == "Object") cons = undefined;
    /* Copy properties into new object, or let object serialize itself */
    var ret;
    if (value.__save__) {
      ret = value.__save__();
    } else {
      ret = {};
      for (var prop in value) {
        if (typeof value[prop] == "function" && ! value.hasOwnProperty(prop))
          continue;
        if (/^_/.test(prop))
          continue;
        ret[prop] = value[prop];
      }
    }
    /* Add type for later retrieval */
    ret.__type__ = cons;
    /* Done */
    return ret;
  });
}

/* Deserialize a JSON string from serialize() into an object structure */
function deserialize(obj, env) {
  if (env == null) env = window;
  return JSON.parse(obj, function(name, value) {
    /* Ignore non-objects */
    if (typeof value != "object" || Array.isArray(value)) return value;
    if (value == null) return null;
    /* Check for a __type__ */
    if (value.__type__) {
      /* Obtain type object */
      var type = findObject(value.__type__, env);
      if (type && type.prototype && type.prototype.__restore__) {
        /* Use restorer function */
        value = type.prototype.__restore__(value, env);
      } else if (type) {
        /* Assume an object is deserializable as-is */
        var newVal = Object.create(type.prototype);
        for (var k in value) if (! /^__.+__$/.test(k)) newVal[k] = value[k];
        value = newVal;
      } else {
        /* Nope */
        throw new Error("Object not deserializable (cannot find type): " +
                        JSON.stringify(value));
      }
      /* Allow alternative restoration handler. */
      if (type && type.prototype && type.prototype.__reinit__)
        type.prototype.__reinit__.call(value, env);
    }
    return value;
  });
}

/* Ensure a JSON string contains only ASCII characters */
function json2ascii(s) {
  return s.replace(/[^ -~]/g, function(ch) {
    s = ch.charCodeAt(0).toString(16);
    switch (s.length) {
      case 1: return "\\u000" + s;
      case 2: return "\\u00" + s;
      case 3: return "\\u0" + s;
      case 4: return "\\u" + s;
    }
  });
}

/* Construct a new StorageCell
 *
 * The object encapsulates the value associated with a particular
 * localStorage key, caches saved values in memory (in case localStorage is
 * not available), and allows transparently serializing/deserializing
 * values. */
function StorageCell(name) {
  this.name = name;
  this.rawValue = undefined;
}

StorageCell.prototype = {
  /* Load the value without deserializing */
  loadRaw: function() {
    if (window.localStorage) {
      var val = localStorage.getItem(this.name);
      if (val != null)
        this.rawValue = val;
    }
    return this.rawValue;
  },

  /* Load the value and deserialize it (in the given environment) */
  load: function(env) {
    return deserialize(this.loadRaw(), env);
  },

  /* Save the given value without serialization */
  saveRaw: function(val) {
    this.rawValue = val;
    if (window.localStorage) {
      localStorage.setItem(this.name, this.rawValue);
    }
  },

  /* Serialize the given value and save it */
  save: function(val) {
    this.saveRaw(serialize(val));
  },

  constructor: StorageCell
};

/* *** Action ***
 *
 * A serializable wrapper around a method call. Can be used as a callback for
 * Scheduler; for that reason, a property named "time" is serialized and
 * restored if present. */

/* Construct a new Action
 *
 * self is the name (!) of an object to be resolved relative to env; func is
 * the name of a function to be resolved relative to self; args is an array
 * of arguments. The function is called with the object resolved for self as
 * the context and args as the positional arguments.
 * If args is omitted, an empty array is used; if env is omitted, the global
 * object (i.e. window) is used. */
function Action(self, func, args, env) {
  this.self = self;
  this.func = func;
  this.args = args || [];
  this.env = env || window;
}

Action.prototype = {
  /* Invoke this Action
   *
   * This function is present to provide a more meaningful name. */
  run: function() {
    return this.cb.apply(this, arguments);
  },

  /* Invoke this Action
   *
   * Resolve and run the function represented by this object as described
   * along with the constructor, and return its return value.
   * Arguments passed to this function are appended to the arguments stored
   * in the object. */
  cb: function() {
    var self = findObject(this.self, this.env);
    var method = findObject(this.func, self);
    return method.apply(self,
      Array.prototype.concat.apply(this.args, arguments));
  },

  constructor: Action,

  /* Prepare for serialization */
  __save__: function() {
    var ret = {self: this.self, func: this.func, args: this.args};
    if (this.time != null) ret.time = this.time;
    return ret;
  },

  /* Deserialize */
  __reinit__: function(env) {
    this.env = env;
  }
};

/* Construct a CachingAction
 *
 * The class derives from Action, and only differs in caching the self object
 * and method (under the assumption that those will never change). */
function CachingAction(self, func, args, env) {
  Action.apply(this, arguments);
  this._self = null;
  this._func = null;
}

CachingAction.prototype = Object.create(Action.prototype);

/* Run the stored function
 *
 * Differently to Action.prototype.run, this function caches the object and
 * the method to invoke. Note that the cache may be invalidated unpredictably
 * (such as when the object is serialized). */
CachingAction.prototype.cb = function() {
  if (this._func == null) {
    this._self = findObject(this.self, this.env);
    this._func = findObject(this.func, this._self);
  }
  return this._func.apply(this._self,
    Array.prototype.concat.apply(this.args, arguments));
};

CachingAction.prototype.constructor = CachingAction;

/* *** Variable ***
 *
 * An (optinally bounded) numerical value with a constant or variable rate of
 * change.
 *
 * Variables are primarily managed via their "derivatives" (or discrete
 * approximations of those); those are determined by summing up values
 * returned by various "handlers". To perform actions that depend on the value
 * of the Variable, "late handlers" are provided.
 * NOTE that neither sort of handler may mutate the Variable's value directly;
 *      changes are automatically aggregated by the implementation.
 * NOTE additionally that late handlers do not have a consistent world view
 *      among different Variable-s: some may have been updated while some may
 *      not. "Normal" handlers see the Variable uniformly in the state
 *      *before* the round of updates. */

/* Construct a new Variable
 *
 * value is the initial value for the variable. */
function Variable(value) {
  this.value = value;
  this._newValue = null;
  this.min = null;
  this.max = null;
  this.handlers = [];
  this.lateHandlers = [];
}

Variable.prototype = {
  /* Add a new handler to this Variable
   *
   * hnd is an object which has a rate or a cb property. If the rate property
   * is present, it is used as a (per-second) rate of change for this
   * Variable; otherwise, the handler is assumed to have a cb property, which
   * is invoked with this Variable and a Scheduler instance as parameters,
   * and is expected to return a (per-second) rate of change. */
  addHandler: function(hnd) {
    this.handlers.push(hnd);
  },

  /* Remove the given handler */
  removeHandler: function(hnd) {
    var idx = this.handlers.indexOf(hnd);
    if (idx != -1) this.handlers.splice(idx, -1);
  },

  /* Add a late handler
   *
   * hnd is an object with a cb property; the latter is invoked with the value
   * of this Variable as a first parameter and this Variable instance as a
   * second one. */
  addLateHandler: function(hnd) {
    this.lateHandlers.push(hnd);
  },

  /* Remove the given late handler */
  removeLateHandler: function(hnd) {
    var idx = this.lateHandlers.indexOf(hnd);
    if (idx != -1) this.lateHandlers.splice(idx, -1);
  },

  /* Run all handlers for this variable and change its value accordingly
   *
   * scheduler is a Scheduler instance to derive timing parameters from.
   * NOTE that all handlers see the value of the Variable *before* the update
   *      and that the new value is not applied until the updateLate() method
   *      is called. */
  update: function(scheduler) {
    var newValue = this.value;
    for (var i = 0; i < this.handlers.length; i++) {
      var hnd = this.handlers[i];
      if (hnd.rate) {
        newValue += hnd.rate / scheduler.fps;
      } else {
        newValue += hnd.cb(this, scheduler) / scheduler.fps;
      }
    }
    if (this.min != null && newValue < this.min) newValue = this.min;
    if (this.max != null && newValue > this.max) newValue = this.max;
    this._newValue = newValue;
  },

  /* Run all late handlers
   *
   * update() must have been called before. */
  updateLate: function() {
    this.value = this._newValue;
    for (var i = 0; i < this.lateHandlers.length; i++) {
      this.lateHandlers[i].cb(this.value, this);
    }
  },

  constructor: Variable
};
