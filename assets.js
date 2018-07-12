
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
  aGl0ZSB9PC9zdHlsZT48ZGVmcz48cGF0aCBkPSJNLTU0LC0xIEwtNTAsMCBMLTU0LDEgWiIgaWQ9\
  InRpY2siLz48L2RlZnM+PHJlY3QgaGVpZ2h0PSI2MiIgd2lkdGg9IjEyNiIgeD0iMSIgeT0iMSIv\
  PjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDY0LDU4KSI+PGcgZmlsbD0ibm9uZSIgc3Ryb2tlLXdp\
  ZHRoPSI0Ij48cGF0aCBjbGFzcz0icmFuZ2UtcmVkIiBzdHJva2U9IiM2MDAwMDAiLz48cGF0aCBj\
  bGFzcz0icmFuZ2UteWVsbG93IiBzdHJva2U9IiM0MDQwMDAiLz48cGF0aCBjbGFzcz0icmFuZ2Ut\
  Z3JlZW4iIHN0cm9rZT0iIzAwNDAwMCIvPjwvZz48ZyBmaWxsPSJncmF5Ij48dXNlIHhsaW5rOmhy\
  ZWY9IiN0aWNrIi8+PHVzZSB0cmFuc2Zvcm09InJvdGF0ZSgxOCkiIHhsaW5rOmhyZWY9IiN0aWNr\
  Ii8+PHVzZSB0cmFuc2Zvcm09InJvdGF0ZSgzNikiIHhsaW5rOmhyZWY9IiN0aWNrIi8+PHVzZSB0\
  cmFuc2Zvcm09InJvdGF0ZSg1NCkiIHhsaW5rOmhyZWY9IiN0aWNrIi8+PHVzZSB0cmFuc2Zvcm09\
  InJvdGF0ZSg3MikiIHhsaW5rOmhyZWY9IiN0aWNrIi8+PHVzZSB0cmFuc2Zvcm09InJvdGF0ZSg5\
  MCkiIHhsaW5rOmhyZWY9IiN0aWNrIi8+PHVzZSB0cmFuc2Zvcm09InJvdGF0ZSgxMDgpIiB4bGlu\
  azpocmVmPSIjdGljayIvPjx1c2UgdHJhbnNmb3JtPSJyb3RhdGUoMTI2KSIgeGxpbms6aHJlZj0i\
  I3RpY2siLz48dXNlIHRyYW5zZm9ybT0icm90YXRlKDE0NCkiIHhsaW5rOmhyZWY9IiN0aWNrIi8+\
  PHVzZSB0cmFuc2Zvcm09InJvdGF0ZSgxNjIpIiB4bGluazpocmVmPSIjdGljayIvPjx1c2UgdHJh\
  bnNmb3JtPSJyb3RhdGUoMTgwKSIgeGxpbms6aHJlZj0iI3RpY2siLz48L2c+PHRleHQgY2xhc3M9\
  ImxhYmVsLTAiIHRleHQtYW5jaG9yPSJlbmQiIHg9Ii01NSIgeT0iMSI+MDwvdGV4dD48dGV4dCBj\
  bGFzcz0ibGFiZWwtMSIgeD0iNTUiIHk9IjEiPjE8L3RleHQ+PHRleHQgY2xhc3M9ImRlc2MiIHg9\
  IjUiIHk9IjEiLz48cGF0aCBjbGFzcz0icG9pbnRlciIgZD0iTTQsLTEgSC00NiBMLTUwLDAgTC00\
  NiwxIEg0IFoiIGZpbGw9InJlZCIvPjxjaXJjbGUgZmlsbD0icmVkIiByPSIyIi8+PC9nPjxyZWN0\
  IGZpbGw9Im5vbmUiIGhlaWdodD0iNjIiIHN0cm9rZT0iZ3JheSIgc3Ryb2tlLXdpZHRoPSIyIiB3\
  aWR0aD0iMTI2IiB4PSIxIiB5PSIxIi8+PC9zdmc+";
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
