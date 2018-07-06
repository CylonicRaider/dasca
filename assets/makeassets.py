#!/usr/bin/env python3
# -*- coding: ascii -*-

import sys, re
import base64
import xml.dom.minidom

SPECIAL_RE = re.compile(r'/\*!(.+)\*/')

LINE_LENGTH = 78

def parse_input(text):
    index = 0
    while 1:
        m = SPECIAL_RE.search(text, index)
        if not m:
            break
        if m.start() != index:
            yield (None, text[index:m.start()])
        yield tuple(m.group(1).split())
        index = m.end()
    if index != len(text):
        yield (None, text[index:])

def minify_svg(text):
    def traverse(node):
        for ch in node.childNodes:
            if ch.nodeType == xml.dom.minidom.Node.ELEMENT_NODE:
                traverse(ch)
            elif ch.nodeType == xml.dom.minidom.Node.TEXT_NODE:
                # TODO: Optimize stylesheets.
                ch.data = ch.data.strip()
    # ElementTree does not preserve namespace prefixes and hence generates
    # rather ugly (and suboptimal) output when serializing again.
    # minidom, on the other hand, does not emit a newline after the document
    # type whether it was absent in the source file or not... which is just
    # what we need.
    document = xml.dom.minidom.parseString(text)
    traverse(document)
    ret = document.toxml('utf-8')
    document.unlink()
    return ret

def import_asset(filename):
    with open(filename) as f:
        rawdata = f.read()
    if filename.endswith('.svg'):
        data = minify_svg(rawdata)
    else:
        data = rawdata.encode('utf-8')
    encdata = base64.b64encode(data).decode('ascii')
    index = 0
    while index < len(encdata):
        endindex = index + LINE_LENGTH - 2
        yield '\\\n  '
        yield encdata[index:endindex]
        index = endindex

def process_input(stream):
    for item in stream:
        if item[0] is None:
            yield item[1]
        elif item[0] == 'include':
            if len(item) != 2:
                raise SystemExit('Invalid include directive: %r' % (item,))
            for piece in import_asset(item[1]):
                yield piece
        else:
            raise SystemExit('Invalid directive: %r' % (item,))

def main():
    text = sys.stdin.read()
    for piece in process_input(parse_input(text)):
        sys.stdout.write(piece)
    sys.stdout.flush()

if __name__ == '__main__': main()
