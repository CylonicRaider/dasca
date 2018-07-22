
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
  ZTsgY3Vyc29yOiBwb2ludGVyIH0KLnNjYWxlLmNsaWNrYWJsZTphY3RpdmUgeyBmaWxsOiAjODA4\
  MDgwIH08L3N0eWxlPjxkZWZzPjxwYXRoIGQ9Ik0tNTQsLTEgTC01MCwwIEwtNTQsMSBaIiBpZD0i\
  dGljayIvPjwvZGVmcz48cmVjdCBoZWlnaHQ9IjYyIiB3aWR0aD0iMTI2IiB4PSIxIiB5PSIxIi8+\
  PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNjQsNTgpIj48ZyBmaWxsPSJncmF5Ij48dXNlIHhsaW5r\
  OmhyZWY9IiN0aWNrIi8+PHVzZSB0cmFuc2Zvcm09InJvdGF0ZSgxOCkiIHhsaW5rOmhyZWY9IiN0\
  aWNrIi8+PHVzZSB0cmFuc2Zvcm09InJvdGF0ZSgzNikiIHhsaW5rOmhyZWY9IiN0aWNrIi8+PHVz\
  ZSB0cmFuc2Zvcm09InJvdGF0ZSg1NCkiIHhsaW5rOmhyZWY9IiN0aWNrIi8+PHVzZSB0cmFuc2Zv\
  cm09InJvdGF0ZSg3MikiIHhsaW5rOmhyZWY9IiN0aWNrIi8+PHVzZSB0cmFuc2Zvcm09InJvdGF0\
  ZSg5MCkiIHhsaW5rOmhyZWY9IiN0aWNrIi8+PHVzZSB0cmFuc2Zvcm09InJvdGF0ZSgxMDgpIiB4\
  bGluazpocmVmPSIjdGljayIvPjx1c2UgdHJhbnNmb3JtPSJyb3RhdGUoMTI2KSIgeGxpbms6aHJl\
  Zj0iI3RpY2siLz48dXNlIHRyYW5zZm9ybT0icm90YXRlKDE0NCkiIHhsaW5rOmhyZWY9IiN0aWNr\
  Ii8+PHVzZSB0cmFuc2Zvcm09InJvdGF0ZSgxNjIpIiB4bGluazpocmVmPSIjdGljayIvPjx1c2Ug\
  dHJhbnNmb3JtPSJyb3RhdGUoMTgwKSIgeGxpbms6aHJlZj0iI3RpY2siLz48L2c+PHRleHQgY2xh\
  c3M9ImxhYmVsLTAiIHRleHQtYW5jaG9yPSJlbmQiIHg9Ii01NSIgeT0iMSI+MDwvdGV4dD48dGV4\
  dCBjbGFzcz0ic2NhbGUiIHRleHQtYW5jaG9yPSJlbmQiIHg9Ii01IiB5PSItNCIvPjx0ZXh0IGNs\
  YXNzPSJkZXNjIiB4PSI1IiB5PSItNCIvPjx0ZXh0IGNsYXNzPSJsYWJlbC0xIiB4PSI1NSIgeT0i\
  MSI+MTwvdGV4dD48cGF0aCBjbGFzcz0icG9pbnRlciIgZD0iTTQsLTEgSC00NiBMLTUwLDAgTC00\
  NiwxIEg0IFoiIGZpbGw9InJlZCIvPjxjaXJjbGUgZmlsbD0icmVkIiByPSIyIi8+PC9nPjxyZWN0\
  IGZpbGw9Im5vbmUiIGhlaWdodD0iNjIiIHN0cm9rZT0iZ3JheSIgc3Ryb2tlLXdpZHRoPSIyIiB3\
  aWR0aD0iMTI2IiB4PSIxIiB5PSIxIi8+PC9zdmc+";
var GAUGE_NODE = parseAsset(GAUGE_TEXT, "image/svg+xml");

var CRANK_TEXT = "\
  PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48c3ZnIHZpZXdCb3g9Ii0xNiwt\
  MTYgMzIsMzIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBmaWxs\
  PSIjNjA2MDYwIiBvcGFjaXR5PSIwLjIiIHI9IjE2Ii8+PGNpcmNsZSBmaWxsPSIjNjA2MDYwIiBy\
  PSI4Ii8+PGcgY2xhc3M9ImhhbmRsZSI+PGxpbmUgc3Ryb2tlPSIjODA4MDgwIiBzdHJva2UtbGlu\
  ZWNhcD0icm91bmQiIHkyPSItMTIiLz48Y2lyY2xlIGN5PSItMTIiIGZpbGw9IiNhMGEwYTAiIHI9\
  IjIiLz48L2c+PC9zdmc+";
var CRANK_NODE = parseAsset(CRANK_TEXT, "image/svg+xml");
