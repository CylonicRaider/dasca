#!/usr/bin/env python3
# -*- coding: ascii -*-

import sys, re
import base64

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

def import_asset(filename):
    with open(filename) as f:
        data = f.read()
    encdata = base64.b64encode(data.encode('utf-8')).decode('ascii')
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
