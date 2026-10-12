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

    meta = {"id": "2", "name": "Spike Valley", "world": 1, "music": "music_hills", "par": 60,
            "checker": {"enemyGems": [1]}}
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


def level3():
    """Bramble Woods (§5.4): springs and Thornbacks. Checkpoint at column 75."""
    W, H = 150, 15
    m = Grid(W, H)
    m.ground(0, W - 1, 11)
    m.put(2, 10, 'P')
    m.coins([(c, 9) for c in range(6, 18, 2)])

    # Introduce: the spring is the only way over the wall.
    m.put(25, 10, 'S')
    m.fill(29, 34, 5, 10)
    m.coins([(30, 2), (31, 2), (32, 2), (33, 2)])

    # Develop: a spring over a wide pit to a high ledge; the first Thornback walks into a pit.
    m.clear(40, 45, 11, 14)
    m.put(38, 10, 'S')
    m.fill(46, 52, 6, 6)
    m.ground(46, 52, 11)
    m.coins([(40, 4), (42, 3), (44, 4)])
    m.clear(54, 56, 11, 14)                       # small pit
    m.put(59, 10, 't')                            # walks left and falls in
    # Lower route with a Thornback between walls; an upper route of one-way platforms.
    m.fill(61, 61, 10, 10)
    m.fill(70, 70, 10, 10)
    m.put(66, 10, 't')
    m.fill(62, 64, 8, 8, '-')
    m.fill(67, 69, 8, 8, '-')
    m.coins([(63, 7), (68, 7)])
    # Gem 1: a spring straight up into a hidden canopy.
    m.put(73, 10, 'S')
    m.fill(71, 75, 1, 3, '%')
    m.put(73, 2, 'G')
    m.put(77, 10, 'C')

    # Twist: a spring through a gap in a low ceiling onto a corridor; a Thornback over a spring.
    m.fill(82, 100, 6, 6)
    m.clear(83, 85, 6, 6)
    m.put(84, 10, 'S')
    m.fill(86, 100, 1, 2)                         # corridor ceiling
    m.coins([(c, 5) for c in range(88, 99, 2)])
    m.put(94, 5, 'e')
    # Gem 2: the end of a Thornback tunnel under the ground.
    m.clear(92, 102, 12, 13)
    m.clear(92, 92, 11, 11)
    m.put(97, 13, 't')
    m.put(102, 13, 'G')
    # Thornback patrolling a walled one-way platform above a spring.
    m.fill(104, 104, 4, 4)
    m.fill(112, 112, 4, 4)
    m.fill(105, 111, 5, 5, '-')
    m.put(108, 4, 't')
    m.put(108, 10, 'S')
    m.coins([(106, 3), (110, 3)])
    # Gem 3: a fake tree trunk.
    m.fill(116, 117, 6, 10, '%')
    m.fill(114, 119, 4, 5, '%')
    m.put(116, 9, 'G')

    # Test: a spring chain across three pits.
    m.put(120, 10, 'S')
    for c0 in (121, 129, 137):
        m.clear(c0, c0 + 4, 11, 14)
        if c0 < 137:
            m.put(c0 + 7, 10, 'S')                # far end of each 3-wide pillar
    m.fill(142, W - 1, 9, 10)
    m.put(145, 8, 'e')
    m.put(147, 8, 'F')
    for c, r, ch in ((36, 10, 'e'), (49, 5, 'e'), (88, 5, 'e'), (80, 10, 'h')):
        m.put(c, r, ch)
    meta = {"id": "3", "name": "Bramble Woods", "world": 2, "music": "music_woods", "par": 75}
    objects = [
        {"type": "sign", "x": 21, "y": 10, "text": "Springs launch you high"},
        {"type": "sign", "x": 57, "y": 10, "text": "Don't stomp spiky backs!"},
    ]
    dump('levels/3.json', meta, m.lines(), objects)
    return m.lines()


def level4():
    """Sunken Ruins (§5.4): moving platforms and crumble blocks. Checkpoint at column 80."""
    W, H = 160, 15
    m = Grid(W, H)
    m.ground(0, W - 1, 11)
    m.put(2, 10, 'P')
    m.coins([(c, 9) for c in range(6, 18, 3)])
    platforms = []

    # Introduce: a moving platform over a shallow, safe pit; a single crumble block over solid ground.
    m.clear(22, 30, 11, 12)
    platforms.append({"type": "platform", "x": 22, "y": 10, "w": 2, "dx": 7, "dy": 0, "speed": 40, "wait": 0.5})
    m.coins([(24, 8), (26, 8), (28, 8)])
    m.put(35, 9, '=')
    m.coins([(35, 7)])

    # Develop: a vertical platform up a ruin wall, then a crumble bridge over spikes.
    m.fill(44, 50, 3, 10)
    platforms.append({"type": "platform", "x": 41, "y": 10, "w": 2, "dx": 0, "dy": -7, "speed": 35, "wait": 0.8})
    m.coins([(c, 2) for c in range(45, 50, 2)])
    m.fill(51, 51, 6, 10)
    m.fill(52, 60, 10, 10, '^')
    m.fill(52, 60, 6, 6, '=')
    m.put(66, 10, 'h')
    # Gem 1: fall with the bridge to a hidden ledge below it.
    m.fill(55, 57, 9, 9, '-')
    m.put(56, 8, 'G')
    m.put(70, 10, 'e')
    # Gem 3: a fake ruin column.
    m.fill(74, 75, 4, 10, '%')
    m.put(75, 10, 'G')
    m.put(80, 10, 'C')

    # Twist: ride past crumble blocks that must be used before they fall; a platform under a Slime ledge.
    m.clear(85, 103, 11, 14)
    platforms.append({"type": "platform", "x": 85, "y": 10, "w": 2, "dx": 6, "dy": 0, "speed": 45, "wait": 0.4})
    m.fill(95, 96, 9, 9, '=')
    m.fill(99, 100, 9, 9, '=')
    m.coins([(95, 7), (99, 7)])
    m.put(106, 10, 't')
    m.clear(110, 124, 11, 14)
    m.fill(112, 118, 6, 6)
    m.put(115, 5, 'e')
    platforms.append({"type": "platform", "x": 110, "y": 10, "w": 2, "dx": 11, "dy": 0, "speed": 45, "wait": 0.5})
    # Gem 2: a pillar at the far end of the platform path.
    m.fill(121, 122, 9, 14)
    m.clear(121, 122, 11, 14)
    m.fill(121, 122, 9, 9)
    m.put(122, 8, 'G')

    # Test: a three-platform relay with one crumble landing.
    m.clear(127, 147, 11, 14)
    platforms.append({"type": "platform", "x": 127, "y": 10, "w": 2, "dx": 4, "dy": 0, "speed": 40, "wait": 0.4})
    platforms.append({"type": "platform", "x": 134, "y": 7, "w": 2, "dx": 0, "dy": 3, "speed": 35, "wait": 0.4})
    m.put(138, 8, '=')
    platforms.append({"type": "platform", "x": 140, "y": 9, "w": 2, "dx": 5, "dy": 0, "speed": 40, "wait": 0.4})
    m.put(152, 10, 'h')
    m.put(156, 10, 'F')
    for c, r, ch in ((32, 10, 'e'), (47, 2, 'h'), (104, 10, 'e'), (126, 10, 'e'), (150, 10, 't')):
        m.put(c, r, ch)
    meta = {"id": "4", "name": "Sunken Ruins", "world": 2, "music": "music_woods", "par": 90}
    objects = platforms + [{"type": "sign", "x": 32, "y": 10, "text": "Cracked blocks crumble!"}]
    dump('levels/4.json', meta, m.lines(), objects)
    return m.lines()


def shaft(m, left0, interior0, width, right_top, hang_to=12, right_to=None):
    """A wall-jump shaft entered at floor level: the left wall hangs from the ceiling down to `hang_to`,
    leaving a 2-tile passage underneath; the right wall rises from the floor to `right_top`.
    Leave at least 3 open rows between the ceiling and `right_top`, or Hop bonks before he clears the wall.
    Keep `width` at 4 or less: a wall jump carries Hop about 4 tiles across."""
    m.fill(left0, interior0 - 1, 0, hang_to)
    right0 = interior0 + width
    m.fill(right0, right0 + 2, right_top, right_to if right_to is not None else len(m.g) - 1)


def level5():
    """Crystal Caves (§5.4): wall slide and wall jump, Bats. Checkpoints near columns 60 and 120. Soft darkness."""
    W, H = 170, 18
    m = Grid(W, H)
    m.fill(0, W - 1, 0, 1)                        # cave ceiling
    m.ground(0, W - 1, 15)
    m.put(2, 14, 'P')
    m.coins([(c, 13) for c in range(5, 15, 3)])
    m.put(9, 12, '*')

    # Introduce: walk under a hanging wall into a shaft; the only way out is up.
    shaft(m, 18, 22, 4, 5)
    m.coins([(23, 12), (24, 10), (23, 8), (24, 6), (23, 4)])
    m.put(25, 13, '*')
    # Gem 1: the top of an optional tall shaft. Both walls hang from the ceiling, so the floor path runs under it.
    m.fill(34, 35, 0, 12)
    m.fill(39, 40, 0, 11)
    m.put(37, 2, 'G')
    m.coins([(37, 10), (37, 6)])
    # After the first climb: drop into a bat cavern (coin trail for the long drop).
    m.coins([(30, 6), (31, 8), (32, 10)])
    for c, r in ((44, 2), (50, 2)):
        m.put(c, r, 'b')
    m.put(46, 14, 'e')
    # Gem 2: a pocket under the cavern floor, hidden by a fake floor.
    m.fill(48, 50, 15, 16, '%')
    m.put(49, 16, 'G')
    m.put(54, 12, '*')
    m.put(57, 14, 'C')

    # Develop: wall jump between a hanging pillar and a tall pillar over a pit.
    # Walls 4 tiles apart (a wall jump carries Hop about 4); column 62 is a clear take-off tile.
    m.fill(60, 61, 0, 11)
    m.clear(63, 65, 15, 17)
    m.fill(66, 68, 5, 17)
    m.coins([(63, 10), (64, 7), (63, 4)])
    m.coins([(72, 7), (74, 9), (76, 11)])
    m.put(78, 14, 'e')
    m.put(83, 14, 't')

    # Twist: a shaft with spikes on its right side and sleeping Bats that wake as Hop climbs past.
    shaft(m, 87, 90, 4, 6)
    m.fill(92, 93, 14, 14, '^')                   # spikes line the right side: start the climb from the left
    m.put(91, 6, 'b')
    m.put(92, 3, 'b')
    m.coins([(91, 12), (92, 9), (91, 4)])
    m.coins([(100, 6), (101, 8), (102, 10)])
    m.put(106, 14, 't')
    for c in (110, 116):
        m.put(c, 2, 'b')
    m.put(113, 12, '*')
    m.put(120, 14, 'C')

    # More caverns: a second pillar crossing and spike floors.
    m.fill(126, 127, 0, 11)
    m.clear(129, 131, 15, 17)
    m.fill(132, 134, 6, 17)
    m.coins([(129, 9), (130, 6)])
    m.fill(137, 141, 14, 14, '^')
    m.fill(136, 142, 11, 11, '-')
    m.put(139, 10, 'e')
    m.put(144, 2, 'b')
    m.put(146, 14, 'h')

    # Test: climb out of the cave to the flag ledge.
    shaft(m, 149, 152, 4, 7)
    m.coins([(153, 12), (154, 9), (153, 6)])
    m.ground(159, W - 1, 9)
    m.put(162, 8, 'F')
    # Gem 3: a narrow chimney over the flag.
    m.fill(164, 165, 3, 6)                        # floating block: walk under it into the chimney
    m.fill(W - 1, W - 1, 2, 8)
    m.put(167, 3, 'G')
    meta = {"id": "5", "name": "Crystal Caves", "world": 3, "music": "music_caves", "par": 100, "darkness": 0.3}
    objects = [{"type": "sign", "x": 15, "y": 14, "text": "Hold toward a wall, then jump"}]
    dump('levels/5.json', meta, m.lines(), objects)
    return m.lines()


def level6():
    """Echo Mines (§5.4): switch blocks, Droppers, darkness. Checkpoints at columns 56 and 115."""
    W, H = 170, 18
    m = Grid(W, H)
    m.fill(0, W - 1, 0, 1)
    m.ground(0, W - 1, 15)
    m.put(2, 14, 'P')
    m.coins([(c, 13) for c in range(5, 16, 3)])
    for c in (6, 14):
        m.put(c, 14, '*')

    # Introduce: a red wall blocks the way; hit the switch from below; blue steps appear.
    m.put(22, 11, 's')
    m.fill(25, 26, 2, 14, 'R')
    m.put(28, 13, 'U')
    m.fill(29, 30, 11, 11, 'U')
    m.fill(31, 37, 10, 14)
    m.coins([(32, 9), (34, 9), (36, 9)])
    # Gem 1: a blue-only alcove above the ledge.
    m.fill(33, 34, 7, 7, 'U')
    m.fill(31, 31, 3, 6)
    m.fill(37, 37, 3, 6)
    m.fill(32, 36, 3, 3)
    m.put(35, 5, 'G')
    m.put(30, 14, '*')

    # Develop: switch mid-jump so a red bridge appears under Hop; Droppers over safe floor.
    m.clear(41, 48, 15, 17)
    m.fill(42, 47, 14, 14, 'R')
    m.put(42, 10, 's')                            # under the top of a jump from the edge
    m.coins([(42, 11), (46, 11)])
    m.put(40, 14, '*')
    for c in (51, 54):
        m.put(c, 2, 'd')
    m.put(56, 14, 'C')
    m.put(58, 14, 'H')

    # Twist: wall-jump up to a switch that opens the shaft's red wall, turning the climb into a descent.
    shaft(m, 61, 64, 4, 2)
    m.fill(68, 70, 3, 6, 'R')
    m.put(66, 2, 's')
    m.coins([(65, 12), (66, 9), (65, 6)])
    m.put(65, 14, '*')
    for c, r in ((72, 8), (75, 10), (78, 12)):
        m.fill(c, c + 1, r, r, 'U')
        m.put(c, 2, 'd')
    m.put(80, 14, '*')
    # Gem 3: the top of a Dropper shaft (after they've fallen).
    m.fill(86, 87, 0, 12)                         # optional: both walls hang, the corridor runs underneath
    m.fill(91, 92, 0, 11)
    m.put(89, 2, 'd')
    m.put(88, 2, 'd')
    m.put(90, 3, 'G')
    m.put(89, 14, '*')
    m.put(95, 14, 'e')
    # Blue bridge, then a red bridge summoned mid-air.
    m.clear(98, 103, 15, 17)
    m.fill(98, 103, 14, 14, 'U')
    m.clear(106, 111, 15, 17)
    m.fill(106, 111, 14, 14, 'R')
    m.put(108, 10, 's')
    m.put(105, 14, '*')
    m.put(113, 2, 'b')
    m.put(115, 14, 'C')
    m.put(117, 14, 'H')

    # Test: a dark corridor where every landing is lit by a crystal.
    for c0, top in ((124, 13), (131, 12), (138, 13)):
        m.clear(c0, c0 + 2, 15, 17)
        m.fill(c0 + 3, c0 + 4, top, 14)
        m.put(c0 + 4, top - 1, '*')
    for c in (127, 134, 141):
        m.put(c, 2, 'd')
    m.put(146, 14, 'h')
    # Gem 2: a dark side tunnel under the floor; a crystal glints inside.
    m.clear(150, 159, 16, 16)
    m.clear(150, 150, 15, 15)
    m.put(152, 16, '*')
    m.put(159, 16, 'G')
    m.put(156, 14, 'e')
    m.put(166, 14, 'F')
    m.put(164, 14, '*')
    meta = {"id": "6", "name": "Echo Mines", "world": 3, "music": "music_caves", "par": 110, "darkness": 0.6}
    objects = [{"type": "sign", "x": 18, "y": 14, "text": "Hit switches from below"}]
    dump('levels/6.json', meta, m.lines(), objects)
    return m.lines()


def level7():
    """Cloud Ruins (§5.4): wind zones and Puffers. Checkpoints near columns 60 and 125."""
    W, H = 180, 15
    m = Grid(W, H)
    m.ground(0, W - 1, 11)
    m.put(2, 10, 'P')
    m.coins([(c, 9) for c in range(6, 18, 3)])
    winds = []

    # Introduce: a gentle tailwind on flat ground, then a headwind over a 2-tile gap.
    winds.append({"type": "wind", "x": 20, "y": 4, "w": 14, "h": 7, "force": 120, "dir": 1})
    m.coins([(c, 9) for c in range(22, 33, 2)])
    m.put(30, 10, 'e')
    winds.append({"type": "wind", "x": 36, "y": 4, "w": 10, "h": 7, "force": 220, "dir": -1})
    m.clear(40, 41, 11, 14)
    m.coins([(40, 8), (41, 8)])
    m.put(45, 10, 'e')

    # Develop: an updraft column as an elevator; Puffers on cloud platforms.
    winds.append({"type": "wind", "x": 50, "y": 0, "w": 3, "h": 11, "force": 1400, "dir": "up"})
    m.coins([(51, 8), (51, 6), (51, 4)])
    m.put(51, 0, 'G')                             # gem 1: ride the updraft past the top of the screen
    m.fill(53, 59, 4, 4)
    m.put(58, 3, 'p')
    m.coins([(54, 3), (56, 3)])
    m.put(62, 10, 'C')
    m.put(64, 10, 'H')

    # Twist: crosswinds over spikes, then a wind-blown wall-jump shaft.
    m.fill(68, 86, 10, 10, '^')
    for c in (68, 73, 78, 83):
        m.fill(c, c + 1, 8, 8, '-')
        m.put(c, 7, 'o')
    winds.append({"type": "wind", "x": 67, "y": 2, "w": 20, "h": 9, "force": 220, "dir": 1})
    m.put(76, 3, 'p')
    shaft(m, 89, 92, 3, 3, hang_to=7)
    winds.append({"type": "wind", "x": 92, "y": 0, "w": 3, "h": 10, "force": 100, "dir": -1})
    m.coins([(93, 8), (93, 5), (93, 2)])
    # Gem 2: a Puffer-guarded island.
    m.fill(101, 103, 4, 4)
    m.put(102, 3, 'G')
    m.put(105, 2, 'p')
    m.put(110, 10, 'h')
    m.put(118, 10, 'e')
    m.put(125, 10, 'C')
    m.put(127, 10, 'H')

    # Test: a headwind gauntlet with Puffers firing across it.
    winds.append({"type": "wind", "x": 130, "y": 2, "w": 44, "h": 9, "force": 160, "dir": -1})
    for c in (135, 142, 149, 156, 163):
        m.clear(c, c + 1, 11, 14)
    for c in (139, 153, 167):
        m.put(c, 4, 'p')
    for c in (133, 146, 160):
        m.put(c, 10, 'e')
    # Gem 3: a fake cloud.
    m.fill(144, 147, 6, 7, '%')
    m.put(146, 7, 'G')
    m.put(176, 10, 'F')
    meta = {"id": "7", "name": "Cloud Ruins", "world": 4, "music": "music_sky", "par": 120}
    objects = winds + [{"type": "sign", "x": 34, "y": 10, "text": "Wind pushes you around!"}]
    dump('levels/7.json', meta, m.lines(), objects)
    return m.lines()


def level8():
    """Sky Bridge (§5.4): acorn cannons and acorn bouncing. Checkpoints near columns 65 and 130."""
    W, H = 190, 15
    m = Grid(W, H)
    m.ground(0, W - 1, 11)
    m.put(2, 10, 'P')
    m.coins([(c, 9) for c in range(6, 18, 3)])
    winds = []

    # Introduce: a cannon fires acorns over flat ground; stomping one bounces Hop up to a coin row.
    m.fill(34, 34, 10, 10)
    m.put(34, 9, '<')
    m.coins([(c, 4) for c in range(24, 31)])
    m.put(38, 10, 'e')

    # Develop: pits too wide to jump, crossed by bouncing on an acorn mid-air.
    # 5 tiles is past a plain jump (§3.3); the acorn lane sits low enough that every jump crosses it.
    m.clear(42, 46, 11, 14)
    m.fill(52, 52, 10, 10)
    m.put(52, 9, '<')
    m.coins([(44, 6), (45, 6)])
    m.put(56, 10, 'h')
    m.put(62, 10, 'C')
    m.put(64, 10, 'H')
    m.clear(68, 72, 11, 14)
    m.fill(78, 78, 10, 10)
    m.put(78, 9, '<')
    m.coins([(70, 6), (71, 6)])

    # Twist: an acorn ladder. A stomp bounce rises ~50 px, so the rungs (lanes) are 32 px apart:
    # row 10 fired right from the ground, rows 8 and 6 fired left from cannons set in the wall.
    m.put(82, 10, '>')
    m.fill(96, 97, 4, 10)
    m.put(96, 8, '<')
    m.put(96, 6, '<')
    m.put(88, 2, 'G')                             # gem 1: three bounces up the ladder
    m.coins([(87, 7), (90, 5), (93, 3)])
    m.fill(98, 104, 4, 10)
    m.put(101, 3, 'k')
    m.clear(106, 117, 11, 14)
    m.fill(106, 117, 9, 9, '=')
    m.fill(120, 120, 9, 10)
    m.put(120, 8, '<')
    # Gem 3: a wind-assisted long jump from a pillar top to a floating ruin.
    m.fill(121, 122, 6, 10)
    winds.append({"type": "wind", "x": 122, "y": 1, "w": 7, "h": 5, "force": 220, "dir": 1})
    m.fill(128, 129, 6, 6)
    m.put(128, 5, 'G')
    m.put(131, 10, 'C')
    m.put(133, 10, 'H')

    # Test: a long bridge with cannons, Puffers and wind.
    m.clear(136, 180, 11, 14)
    m.fill(136, 180, 9, 9, '-')
    for c in (145, 158, 170):
        m.clear(c, c + 1, 9, 9)
    m.fill(182, 182, 8, 10)
    m.put(182, 7, '<')
    for c in (150, 165):
        m.put(c, 5, 'p')
    winds.append({"type": "wind", "x": 136, "y": 2, "w": 44, "h": 8, "force": 140, "dir": -1})
    for c in (140, 162, 176):
        m.put(c, 8, 'e')
    # Gem 2: under the bridge, with a spring back up through the planks.
    m.fill(152, 156, 12, 12)
    m.put(153, 11, 'G')
    m.put(155, 11, 'S')
    m.put(186, 10, 'F')
    meta = {"id": "8", "name": "Sky Bridge", "world": 4, "music": "music_sky", "par": 120}
    objects = winds + [{"type": "sign", "x": 22, "y": 10, "text": "Stomp acorns to bounce!"}]
    dump('levels/8.json', meta, m.lines(), objects)
    return m.lines()


def level9():
    """Storm Keep (§5.4): three acts. Courtyard with Knights and switch gates; a tower climb ahead of rising
    thornwater; battlements in the storm and a second, faster thornwater rise up the final spire."""
    W, H = 220, 40
    m = Grid(W, H)
    objects = []
    # Act 1: the courtyard.
    m.ground(0, 77, 35)
    m.put(2, 34, 'P')
    m.coins([(c, 33) for c in range(6, 18, 3)])
    m.put(25, 34, 'k')
    m.put(29, 31, 's')
    m.fill(32, 32, 30, 34, 'R')                   # red gate
    m.put(36, 34, 'h')
    m.put(40, 34, 'k')
    m.put(44, 31, 's')
    m.fill(47, 47, 30, 34, 'U')                   # blue gate
    m.put(52, 34, 'h')
    m.put(55, 34, 'k')
    # Gem 1: an alcove behind a red gate: flip the switch a third time.
    m.put(60, 31, 's')
    m.fill(62, 62, 31, 34, 'R')
    m.fill(62, 67, 30, 30)
    m.fill(67, 67, 31, 34)
    m.put(65, 34, 'G')
    m.put(70, 34, 'C')
    m.put(72, 34, 'H')

    # Act 2: the tower climb, with thornwater rising at 16 px/s.
    m.ground(76, 85, 35)                          # tower floor
    shaft(m, 76, 79, 4, 22, hang_to=32, right_to=39)
    m.fill(79, 80, 29, 29, '-')
    m.put(80, 28, 'S')
    m.put(81, 25, '=')
    m.fill(81, 82, 26, 26, '-')
    m.coins([(80, 31), (81, 27), (80, 23)])
    m.clear(83, 83, 27, 28)                       # gem 2: a niche in the tower wall
    m.put(83, 28, 'G')
    objects.append({"type": "thornwater", "x": 79, "w": 4, "trigger": 79, "startRow": 37, "stopRow": 23, "speed": 16})

    # Act 3: the battlements in the storm.
    m.fill(83, 197, 22, 23)
    m.put(88, 21, 'C')
    m.put(90, 21, 'H')
    for c0, w in ((104, 2), (126, 2), (134, 3), (156, 2), (172, 2)):
        m.clear(c0, c0 + w - 1, 22, 23)
    for c in (100, 120, 150, 180):
        m.fill(c, c + 1, 24, 39)                  # supports
    objects.append({"type": "wind", "x": 96, "y": 15, "w": 20, "h": 7, "force": 180, "dir": -1})
    m.fill(122, 122, 21, 21)
    m.put(122, 20, '<')
    m.fill(168, 168, 21, 21)
    m.put(168, 20, '<')
    for c in (130, 146, 164):
        m.put(c, 17, 'b')
    for c in (110, 152, 186):
        m.put(c, 21, 'k')
    for c in (116, 160, 178):
        m.put(c, 21, 'h')
    m.put(142, 21, 'C')
    m.put(144, 21, 'H')
    objects.append({"type": "wind", "x": 146, "y": 15, "w": 30, "h": 7, "force": 160, "dir": 1})

    # The final spire: thornwater at 24 px/s.
    m.fill(195, 197, 3, 19)
    m.ground(202, W - 1, 3)
    m.clear(202, 202, 9, 10)                      # gem 3: a niche halfway up the spire
    m.put(202, 10, 'G')
    m.coins([(199, 18), (200, 14), (199, 10), (200, 6)])
    objects.append({"type": "thornwater", "x": 198, "w": 4, "trigger": 198, "startRow": 24, "stopRow": 4, "speed": 24})
    m.put(210, 2, 'F')
    meta = {"id": "9", "name": "Storm Keep", "world": 5, "music": "music_keep", "par": 180}
    objects.append({"type": "sign", "x": 74, "y": 34, "text": "Climb! The thornwater rises!"})
    dump('levels/9.json', meta, m.lines(), objects)
    return m.lines()


if __name__ == '__main__':
    for name, rows in (('2', level2()), ('3', level3()), ('4', level4()), ('5', level5()), ('6', level6()), ('7', level7()), ('8', level8()), ('9', level9()), ('10', level10())):
        print(f'--- level {name}')
        print('\n'.join(rows))
