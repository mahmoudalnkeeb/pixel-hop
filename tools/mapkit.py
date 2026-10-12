"""Tiny helpers for authoring ASCII level maps (GDD §4.1). Used by tools/build_levels.py."""
import json


class Grid:
    def __init__(self, cols, rows):
        self.g = [['.'] * cols for _ in range(rows)]

    def fill(self, c0, c1, r0, r1, ch='#'):
        for r in range(r0, r1 + 1):
            for c in range(c0, c1 + 1):
                self.g[r][c] = ch

    def put(self, c, r, ch):
        self.g[r][c] = ch

    def row(self, r, c0, text):
        for i, ch in enumerate(text):
            if ch != ' ':
                self.g[r][c0 + i] = ch

    def lines(self):
        return [''.join(r) for r in self.g]


def dump(path, meta, grid_lines, objects):
    head = json.dumps(meta, indent=2)[:-2]
    out = head + ',\n  "map": [\n' + ',\n'.join('    ' + json.dumps(m) for m in grid_lines) + '\n  ],\n'
    out += '  "objects": [\n' + ',\n'.join('    ' + json.dumps(o) for o in objects) + '\n  ]\n}\n'
    json.loads(out)
    with open(path, 'w') as f:
        f.write(out)
