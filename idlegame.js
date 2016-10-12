
/* Dasca, an idle game by @CylonicRaider (github.com/CylonicRaider/dasca)
 * Abstract engine for JS-based idle games */

'use strict';

/* *** Clock ***
 * An object allowing to sample "time" (as defined by an external source)
 * with a linear transform in place. */

/* Construct a new clock
 * source is a function that, when called, returns the current time; scale
 * and offset modify source's output in a linear fashion: the reading of
 * source is multiplied by scale and offset is added to that to obtain the
 * current time. If scale is undefined or null, it defaults to 1; if offset
 * is null, it is computed such that the clock starts counting from zero. */
function Clock(source, scale, offset) {
  if (scale == null) scale = 1.0;
  if (offset == null) offset = -source() * scale;
  this.source = source;
  this.scale = scale;
  this.offset = offset;
}

Clock.prototype = {
  /* Sample the current time */
  now: function() {
    return this.source() * this.scale + this.offset;
  },

  /* Construct a new clock from this one, applying the given transformation
   * The new clock derives its time from the same (!) source as this one,
   * but its scale and offset are modified to simulate a clock constructed
   * like
   *     new Clock(this, scale, offset);
   */
  derive: function(scale, offset) {
    if (scale == null) scale = 1.0;
    if (offset != null) offset = this.offset * scale + offset;
    var ret = new Clock(this.source, this.scale * scale, offset);
    if (this._realTime) ret._realTime = true;
    return ret;
  },

  /* Serialization boilerplate */
  constructor: Clock
};

/* Construct a clock that returns (optionally scaled) real time
 * The clock counts from zero */
Clock.realTime = function(scale, start) {
  if (scale == null) scale = 1.0;
  scale *= 1e-3;
  var offset = (start == null) ? null : start - performance.now() * scale;
  var ret = new Clock(performance.now.bind(performance), scale, offset);
  ret._realTime = true;
  return ret;
};

/* Seralize a clock */
Clock.__save__ = function(clock) {
  if (! clock._realTime) throw new Error("Clock not serializable!");
  return {scale: clock.scale * 1e3, time: clock.now()};
};

/* Deserialize a clock */
Clock.__restore__ = function(data) {
  return Clock.realTime(data.scale, data.time);
};

/* *** Serialization ***
 * Serializes object trees (!) into JSON strings, allowing reified objects to
 * be of the correct type, to hook their (de)serialization process.
 * Input containing enumerable function properties is rejected (since those
 * are silently swallowed by JSON); use hooks to meaningfully handle them. */

/* Serialize an object tree to JSON, storing type information */
function serialize(obj) {
  return JSON.stringify(obj, function(name, value) {
    /* Fail verbosely */
    if (typeof value == "function")
      throw new Error("Cannot serialize function");
    /* Only transform object values */
    if (typeof value != "object" || Array.isArray(value)) return value;
    /* Get a meaningful constructor name */
    var cons = value.constructor.__sername__;
    if (! cons) cons = value.constructor.name;
    if (! cons) cons = Object.prototype.toString(value).slice(8, -1);
    if (cons == "Object") cons = undefined;
    /* Copy properties into new object, or let object serialize itself */
    var ret;
    if (value.constructor.__save__) {
      ret = value.constructor.__save__(value);
    } else {
      ret = {};
      for (var prop in value) ret[prop] = value[prop];
    }
    /* Add __type__ */
    ret.__type__ = cons;
    /* Done */
    return ret;
  });
}

/* Deserialize a JSON string into an object structure */
function deserialize(obj) {
  return JSON.parse(obj, function(name, value) {
    /* Ignore non-objects */
    if (typeof value != "object" || Array.isArray(value)) return value;
    /* Check for a __type__ */
    if (value.__type__) {
      /* Obtain type object */
      var type = window[value.__type__];
      if (type && type.__restore__) {
        /* Use restorer function */
        value = type.__restore__(value);
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
    }
    return value;
  });
}
