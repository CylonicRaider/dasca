
var GAUGE_TEXT = 'PD94bWwgdmVyc2lvbj0iMS4wIj8+PHN2ZyB4bWxucz0iaHR0cDovL3d3dy\
  53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hs\
  aW5rIiB2aWV3Qm94PSIwLDAgMTI4LDY0Ij48c3R5bGUgdHlwZT0idGV4dC9jc3MiPiNwb2ludG\
  Vye3RyYW5zaXRpb246dHJhbnNmb3JtIDAuMnMgZWFzZX10ZXh0e2ZvbnQtZmFtaWx5OkFyaWFs\
  LHNhbnMtc2VyaWY7Zm9udC1zaXplOjEwcHg7ZmlsbDp3aGl0ZX08L3N0eWxlPjxkZWZzPjxwYX\
  RoIGlkPSJ0aWNrIiBkPSJNLTU0LC0xIEwtNTAsMCBMLTU0LDEgWiIvPjwvZGVmcz48cmVjdCB4\
  PSIxIiB5PSIxIiB3aWR0aD0iMTI2IiBoZWlnaHQ9IjYyIi8+PGcgdHJhbnNmb3JtPSJ0cmFuc2\
  xhdGUoNjQsNTgpIj48ZyBmaWxsPSJncmF5Ij48dXNlIHhsaW5rOmhyZWY9IiN0aWNrIi8+PHVz\
  ZSB4bGluazpocmVmPSIjdGljayIgdHJhbnNmb3JtPSJyb3RhdGUoMTgpIi8+PHVzZSB4bGluaz\
  pocmVmPSIjdGljayIgdHJhbnNmb3JtPSJyb3RhdGUoMzYpIi8+PHVzZSB4bGluazpocmVmPSIj\
  dGljayIgdHJhbnNmb3JtPSJyb3RhdGUoNTQpIi8+PHVzZSB4bGluazpocmVmPSIjdGljayIgdH\
  JhbnNmb3JtPSJyb3RhdGUoNzIpIi8+PHVzZSB4bGluazpocmVmPSIjdGljayIgdHJhbnNmb3Jt\
  PSJyb3RhdGUoOTApIi8+PHVzZSB4bGluazpocmVmPSIjdGljayIgdHJhbnNmb3JtPSJyb3RhdG\
  UoMTA4KSIvPjx1c2UgeGxpbms6aHJlZj0iI3RpY2siIHRyYW5zZm9ybT0icm90YXRlKDEyNiki\
  Lz48dXNlIHhsaW5rOmhyZWY9IiN0aWNrIiB0cmFuc2Zvcm09InJvdGF0ZSgxNDQpIi8+PHVzZS\
  B4bGluazpocmVmPSIjdGljayIgdHJhbnNmb3JtPSJyb3RhdGUoMTYyKSIvPjx1c2UgeGxpbms6\
  aHJlZj0iI3RpY2siIHRyYW5zZm9ybT0icm90YXRlKDE4MCkiLz48L2c+PHRleHQgaWQ9ImxhYm\
  VsLTAiIHg9Ii01NSIgeT0iMSIgdGV4dC1hbmNob3I9ImVuZCI+MDwvdGV4dD48dGV4dCBpZD0i\
  bGFiZWwtMSIgeD0iNTUiIHk9IjEiPjE8L3RleHQ+PHRleHQgaWQ9ImRlc2MiIHg9IjUiIHk9Ij\
  EiPjwvdGV4dD48cGF0aCBpZD0icG9pbnRlciIgZD0iTTQsLTEgSC00NiBMLTUwLDAgTC00Niwx\
  IEg0IFoiIGZpbGw9InJlZCIvPjxjaXJjbGUgcj0iMiIgZmlsbD0icmVkIi8+PC9nPjxyZWN0IH\
  g9IjEiIHk9IjEiIHdpZHRoPSIxMjYiIGhlaWdodD0iNjIiIGZpbGw9Im5vbmUiIHN0cm9rZT0i\
  Z3JheSIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+';
var GAUGE_NODE;

void function() {
  var parser = new DOMParser();
  var doc = parser.parseFromString(atob(GAUGE_TEXT), "image/svg+xml");
  GAUGE_NODE = document.importNode(doc.documentElement, true);
}();
