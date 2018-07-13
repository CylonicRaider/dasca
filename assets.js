
function parseAsset(text, mimeType) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(atob(text), mimeType);
  return document.importNode(doc.documentElement, true);
}

var GAUGE_TEXT = "\
  PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48c3ZnIHZpZXdCb3g9IjAsMCAx\
  MjgsNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0\
  dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+dGV4dCB7\
  IGZvbnQtZmFtaWx5OiBBcmlhbCwgc2Fucy1zZXJpZjsgZm9udC1zaXplOiAxMHB4OyBmaWxsOiB3\
  aGl0ZSB9Ci5zY2FsZS5jbGlja2FibGU6aG92ZXIgeyB0ZXh0LWRlY29yYXRpb246IHVuZGVybGlu\
  ZTsgY3Vyc29yOiBwb2ludGVyIH0KLnNjYWxlLmNsaWNrYWJsZTphY3RpdmUgeyBmaWxsOiAjYzBj\
  MGMwIH08L3N0eWxlPjxkZWZzPjxwYXRoIGQ9Ik0tNTQsLTEgTC01MCwwIEwtNTQsMSBaIiBpZD0i\
  dGljayIvPjwvZGVmcz48cmVjdCBoZWlnaHQ9IjYyIiB3aWR0aD0iMTI2IiB4PSIxIiB5PSIxIi8+\
  PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNjQsNTgpIj48ZyBmaWxsPSJub25lIiBzdHJva2Utd2lk\
  dGg9IjQiPjxwYXRoIGNsYXNzPSJyYW5nZS1yZWQiIHN0cm9rZT0iIzYwMDAwMCIvPjxwYXRoIGNs\
  YXNzPSJyYW5nZS15ZWxsb3ciIHN0cm9rZT0iIzQwNDAwMCIvPjxwYXRoIGNsYXNzPSJyYW5nZS1n\
  cmVlbiIgc3Ryb2tlPSIjMDA0MDAwIi8+PC9nPjxnIGZpbGw9ImdyYXkiPjx1c2UgeGxpbms6aHJl\
  Zj0iI3RpY2siLz48dXNlIHRyYW5zZm9ybT0icm90YXRlKDE4KSIgeGxpbms6aHJlZj0iI3RpY2si\
  Lz48dXNlIHRyYW5zZm9ybT0icm90YXRlKDM2KSIgeGxpbms6aHJlZj0iI3RpY2siLz48dXNlIHRy\
  YW5zZm9ybT0icm90YXRlKDU0KSIgeGxpbms6aHJlZj0iI3RpY2siLz48dXNlIHRyYW5zZm9ybT0i\
  cm90YXRlKDcyKSIgeGxpbms6aHJlZj0iI3RpY2siLz48dXNlIHRyYW5zZm9ybT0icm90YXRlKDkw\
  KSIgeGxpbms6aHJlZj0iI3RpY2siLz48dXNlIHRyYW5zZm9ybT0icm90YXRlKDEwOCkiIHhsaW5r\
  OmhyZWY9IiN0aWNrIi8+PHVzZSB0cmFuc2Zvcm09InJvdGF0ZSgxMjYpIiB4bGluazpocmVmPSIj\
  dGljayIvPjx1c2UgdHJhbnNmb3JtPSJyb3RhdGUoMTQ0KSIgeGxpbms6aHJlZj0iI3RpY2siLz48\
  dXNlIHRyYW5zZm9ybT0icm90YXRlKDE2MikiIHhsaW5rOmhyZWY9IiN0aWNrIi8+PHVzZSB0cmFu\
  c2Zvcm09InJvdGF0ZSgxODApIiB4bGluazpocmVmPSIjdGljayIvPjwvZz48dGV4dCBjbGFzcz0i\
  bGFiZWwtMCIgdGV4dC1hbmNob3I9ImVuZCIgeD0iLTU1IiB5PSIxIj4wPC90ZXh0Pjx0ZXh0IGNs\
  YXNzPSJzY2FsZSIgdGV4dC1hbmNob3I9ImVuZCIgeD0iLTUiIHk9Ii00Ii8+PHRleHQgY2xhc3M9\
  ImRlc2MiIHg9IjUiIHk9Ii00Ii8+PHRleHQgY2xhc3M9ImxhYmVsLTEiIHg9IjU1IiB5PSIxIj4x\
  PC90ZXh0PjxwYXRoIGNsYXNzPSJwb2ludGVyIiBkPSJNNCwtMSBILTQ2IEwtNTAsMCBMLTQ2LDEg\
  SDQgWiIgZmlsbD0icmVkIi8+PGNpcmNsZSBmaWxsPSJyZWQiIHI9IjIiLz48L2c+PHJlY3QgZmls\
  bD0ibm9uZSIgaGVpZ2h0PSI2MiIgc3Ryb2tlPSJncmF5IiBzdHJva2Utd2lkdGg9IjIiIHdpZHRo\
  PSIxMjYiIHg9IjEiIHk9IjEiLz48L3N2Zz4=";
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

var CRANK_TEXT = "\
  PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48c3ZnIHZpZXdCb3g9Ii0xNiwt\
  MTYgMzIsMzIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBmaWxs\
  PSIjNjA2MDYwIiBvcGFjaXR5PSIwLjIiIHI9IjE2Ii8+PGNpcmNsZSBmaWxsPSIjNjA2MDYwIiBy\
  PSI4Ii8+PGcgY2xhc3M9ImhhbmRsZSI+PGxpbmUgc3Ryb2tlPSIjODA4MDgwIiBzdHJva2UtbGlu\
  ZWNhcD0icm91bmQiIHkyPSItMTIiLz48Y2lyY2xlIGN5PSItMTIiIGZpbGw9IiNhMGEwYTAiIHI9\
  IjIiLz48L2c+PC9zdmc+";
var CRANK_NODE = parseAsset(CRANK_TEXT, "image/svg+xml");
