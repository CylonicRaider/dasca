
function parseAsset(text, mimeType) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(atob(text), mimeType);
  return document.importNode(doc.documentElement, true);
}

var GAUGE_TEXT = "/*!include gauge.svg*/";
var GAUGE_NODE = parseAsset(GAUGE_TEXT, "image/svg+xml");

var CRANK_TEXT = "/*!include crank.svg*/";
var CRANK_NODE = parseAsset(CRANK_TEXT, "image/svg+xml");
