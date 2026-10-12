"""Builds levels/2.json and levels/10.json. Run from the repo root: python3 tools/build_levels.py
Level 1 comes from the GDD's Appendix C.8 map and is edited by hand."""
from mapkit import Grid, dump


def level2():
    """Spike Valley (§5.4): spikes, one-way platforms, drop-through, Hoppers, checkpoint at column 65."""
    W, H = 130, 15
    m = Grid(W, H)
    m.fill(0, W - 1, 11, 14)                      # ground
    m.put(2, 10, 'P')
    for c in (6, 8, 10, 12, 14, 16): m.put(c, 9, 'o')

    # Introduce: spikes in a dip, with a one-way bridge over it, then a one-way staircase.
    m.fill(23, 28, 11, 11, '.')
    m.fill(25, 26, 11, 11, '^')                   # spikes sit in the dip on row 12's ground
    m.fill(22, 29, 9, 9, '-')                     # ...or walk around them on a bridge
    for c in (23, 25, 27): m.put(c, 8, 'o')
    m.put(30, 10, 'e')
    m.fill(32, 34, 9, 9, '-')
    m.fill(35, 37, 7, 7, '-')
    m.fill(38, 41, 5, 5, '-')
    for c, r in ((33, 8), (36, 6), (39, 4), (40, 4)): m.put(c, r, 'o')
    # Gem 3: a fake patch in the ceiling block above the top step.
    m.fill(37, 46, 0, 2)
    m.fill(41, 42, 1, 2, '%')
    m.put(42, 1, 'G')

    # Develop: spike floor under one-way platforms.
    m.put(44, 10, 'h')
    m.fill(46, 53, 10, 10, '^')
    m.fill(45, 47, 9, 9, '-')
    m.fill(50, 52, 9, 9, '-')
    for c in (46, 51): m.put(c, 8, 'o')
    # Drop-through pocket: the only way in is ↓ + Jump through the one-way lid.
    m.fill(54, 55, 10, 10)                        # step up
    m.fill(56, 56, 8, 10)
    m.fill(63, 63, 8, 10)
    m.fill(57, 62, 10, 10)                        # raised pocket floor
    m.fill(57, 62, 8, 8, '-')                     # lid
    for c in (57, 58, 59, 61, 62): m.put(c, 9, 'o')
    m.put(60, 9, 'G')                             # gem 1: drop-through required
    m.put(65, 10, 'C')                            # checkpoint

    # Twist: Hoppers guarding narrow one-way ledges over a spike floor.
    m.fill(68, 97, 10, 10, '^')
    for c0 in (68, 73, 78, 83, 88, 93):
        m.fill(c0, c0 + 2, 9, 9, '-')
        m.put(c0 + 1, 8, 'o')
    for c in (74, 84, 94): m.put(c, 8, 'h')
    # Gem 2: too high for a plain jump from a ledge (head reaches row 4); stomping a Hopper mid-hop gets there.
    m.put(84, 3, 'G')

    m.put(99, 10, 'e')
    # Test: an ascending spike corridor with alternating one-way platforms.
    m.fill(101, 116, 10, 10, '^')
    m.fill(101, 103, 9, 9, '-')
    m.fill(106, 108, 8, 8, '-')
    m.fill(111, 113, 7, 7, '-')
    for c, r in ((102, 8), (107, 7), (112, 6)): m.put(c, r, 'o')
    m.put(112, 6, 'h')
    m.fill(117, W - 1, 6, 10)                     # high ground to the flag
    m.put(122, 5, 'e')
    for c in (118, 119, 120): m.put(c, 4, 'o')
    m.put(126, 5, 'F')

    meta = {"id": "2", "name": "Spike Valley", "world": 1, "music": "music_hills", "par": 60}
    objects = [
        {"type": "sign", "x": 4, "y": 10, "text": "Spikes hurt! Jump over them"},
        {"type": "sign", "x": 20, "y": 10, "text": "Platforms: jump up through"},
        {"type": "sign", "x": 53, "y": 9, "text": "Down + Jump drops through"},
    ]
    dump('levels/2.json', meta, m.lines(), objects)
    return m.lines()


def level10():
    """Throne of Gloop (§5.4, §6.2): a 60-column Throne Hall, then the 20×12 arena."""
    W, H = 80, 12
    m = Grid(W, H)
    m.fill(0, 59, 0, 0)                           # hall ceiling
    m.fill(0, W - 1, 11, 11)                      # floor
    m.put(2, 10, 'P')
    for c in range(8, 52, 6): m.put(c, 9, 'o')
    m.fill(14, 15, 9, 10, 'B')                    # plinths
    m.fill(30, 31, 9, 10, 'B')
    m.fill(20, 24, 7, 7, '-')
    for c in (21, 23): m.put(c, 6, 'o')
    m.put(26, 10, 'k')
    m.put(42, 10, 'k')
    m.fill(36, 40, 7, 7, '-')
    m.put(55, 10, 'C')
    m.put(57, 10, 'H')

    # Arena (§6.2), columns 60–79. The doorway in its left wall closes when the fight starts.
    m.fill(60, 79, 0, 0)
    m.fill(60, 60, 0, 8)
    m.fill(79, 79, 0, 10)
    m.fill(62, 65, 6, 6, '-')
    m.fill(74, 77, 6, 6, '-')

    meta = {"id": "10", "name": "Throne of Gloop", "world": 5, "music": "music_drone", "par": 0}
    objects = [{"type": "banner", "x": x, "y": 1} for x in (6, 18, 34, 48)] + [
        {"type": "arena", "x": 60, "y": 0, "w": 20, "h": 12, "door": {"x": 60, "y": 9, "h": 2}},
        {"type": "boss", "x": 72, "y": 10},
    ]
    dump('levels/10.json', meta, m.lines(), objects)
    return m.lines()


if __name__ == '__main__':
    for name, rows in (('2', level2()), ('10', level10())):
        print(f'--- level {name}')
        print('\n'.join(rows))
