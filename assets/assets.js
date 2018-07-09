
function parseAsset(text, mimeType) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(atob(text), mimeType);
  return document.importNode(doc.documentElement, true);
}

var GAUGE_TEXT = "/*!include gauge.svg*/";
var GAUGE_NODE = parseAsset(GAUGE_TEXT, "image/svg+xml");

function setGaugeDescription(node, text) {
  node.querySelector(".desc").textContent = text;
}
function setGaugeRange(node, type, fromval, toval) {
  var R = 52;
  var path = node.querySelector(".range-" + type);
  var fa = fromval * Math.PI, ta = toval * Math.PI;
  path.setAttribute("d",
    "M " + (R * -Math.cos(fa)) + "," + (R * -Math.sin(fa)) + " " +
    "A 52,52 0 0,1 " + (R * -Math.cos(ta)) + "," + (R * -Math.sin(ta)));
}

var CRANK_TEXT = "/*!include crank.svg*/";
var CRANK_NODE = parseAsset(CRANK_TEXT, "image/svg+xml");
