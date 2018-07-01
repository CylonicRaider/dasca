#!/usr/bin/env python3
# -*- coding: ascii -*-

import re

SPECIAL_RE = re.compile(r'/\*!(.*?)\*/')

def parse_input(text):
    index = 0, 0
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
