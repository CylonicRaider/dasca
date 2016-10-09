
/* Dasca, an idle game by @CylonicRaider (github.com/CylonicRaider/dasca)
 * Abstract engine for JS-based idle games */

'use strict';

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
    return new Clock(this.source, this.scale * scale, offset);
  }
};

/* Construct a clock that returns (optionally scaled) real time
 * The clock counts from zero */
Clock.realTime = function(scale) {
  if (scale == null) scale = 1.0;
  return new Clock(performance.now.bind(performance), scale * 1e-3);
};
