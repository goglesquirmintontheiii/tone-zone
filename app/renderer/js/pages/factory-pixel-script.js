// Screen script for the Pixel Quest template (factory-showcase-floor.js): a little game console that is secretly
// a synth. Each character is a voice, each level an effects chain. Plain screen script code (docs/screen-scripts.md).

export const PIXEL_SCRIPT = `-- Pixel Quest: pick a character (the synth voice) and a level (the effects),
-- then play: the hero runs faster and jumps on every note you play.
-- D-pad, A, B, START and SELECT move through the menus, the LEVEL
-- footswitches warp between levels, POWER-UP turns a sparkle octave on and off.
-- The screen drives the circuit through its outputs (voice, crusher, slicer,
-- echo, reverb, wobble and the power-up octave).

local CHARS = {
  {name = "KNIGHT", voice = "square lead", mode = 0, col = "#4aa8ff", stats = {4, 3, 2}},
  {name = "NINJA", voice = "saw lead", mode = 1, col = "#ff4f6a", stats = {5, 2, 3}},
  {name = "WIZARD", voice = "magic pad", mode = 6, col = "#b36bff", stats = {2, 5, 4}},
  {name = "GOLEM", voice = "sub bass", mode = 5, col = "#9b7a4a", stats = {5, 1, 1}, oct = -1},
  {name = "GHOST", voice = "strings", mode = 3, col = "#d8e6ff", stats = {2, 4, 5}},
  {name = "ROBOT", voice = "robot organ", mode = 2, col = "#a8b4c4", stats = {3, 3, 3}},
  {name = "KITTY", voice = "meow brass", mode = 4, col = "#ffa94d", stats = {1, 5, 4}},
  {name = "SLIME", voice = "filter sweep", mode = 7, col = "#5be36b", stats = {3, 2, 5}},
}
-- crush, slicer pattern, echo {ms, repeats, mix}, reverb {type, mix}
local LEVELS = {
  {name = "1-1 GREEN HILLS", fx = "slap echo", cr = 0, sl = 0, dl = {180, 0.2, 0.25}, rv = {0, 0.2}, col = "#3ddc84", sky = "#29adff"},
  {name = "1-2 CRYSTAL CAVE", fx = "big cave verb", cr = 0, sl = 0, dl = {0, 0, 0}, rv = {1, 0.45}, col = "#5ec8ff", sky = "#14203a"},
  {name = "1-3 8-BIT TOWN", fx = "crunch + gate", cr = 0.65, sl = 1, dl = {0, 0, 0}, rv = {0, 0.12}, col = "#ffd54a", sky = "#29adff"},
  {name = "1-4 BOSS CASTLE", fx = "arpeggio echo", cr = 0.35, sl = 7, dl = {330, 0.45, 0.3}, rv = {2, 0.2}, col = "#ff5a2a", sky = "#2a1a3a"},
  {name = "2-1 SKY TEMPLE", fx = "shimmer heaven", cr = 0, sl = 0, dl = {420, 0.4, 0.25}, rv = {4, 0.4}, col = "#e9e3ff", sky = "#c2c3c7"},
  {name = "2-2 UNDERWATER", fx = "wobble + dark", cr = 0.2, sl = 0, dl = {260, 0.5, 0.3}, rv = {6, 0.35}, col = "#2fd1c4", sky = "#1d4a7a", wobble = true},
}
local PAL = {bg = "#1d2b53", ink = "#000000", white = "#fff1e8", yellow = "#ffec27", red = "#ff004d", green = "#00e436",
  blue = "#29adff", grey = "#83769c", pink = "#ff77a8", peach = "#ffccaa", orange = "#ffa300", dgreen = "#008751", brown = "#ab5236"}
local SPR = {
  KNIGHT = {"..b..b..", ".aaaaaa.", ".abwwba.", ".aaaaaa.", "..bbbb..", ".aaaaaa.", ".a.aa.a.", "..a..a.."},
  NINJA = {"........", ".bbbbbb.", ".bwbbwb.", ".aaaaaaa", ".bbbbbb.", "..bbbb..", ".b.bb.b.", ".b....b."},
  WIZARD = {"...a....", "..aaa...", ".aaaaa..", "aaaaaaa.", ".bwbwb..", ".bbbbb..", "..bbb...", ".b...b.."},
  GOLEM = {".bbbbbb.", "baaaaaab", "bawaawab", "baaaaaab", "bbaaaabb", "baaaaaab", ".aa..aa.", "bb....bb"},
  GHOST = {"..aaaa..", ".aaaaaa.", "awwaawwa", "abwaabwa", "aaaaaaaa", "aaaaaaaa", "aaaaaaaa", "a.aa.aa."},
  ROBOT = {"...b....", "..aaaa..", ".awbbwa.", ".aaaaaa.", ".abbbba.", "aaaaaaaa", ".a.aa.a.", ".bb..bb."},
  KITTY = {"a......a", "aa....aa", "aaaaaaaa", "awbaawba", "aaawwaaa", "aaaaaaaa", ".aaaaaa.", "..a..a.."},
  SLIME = {"........", "...aa...", "..aaaa..", ".awaawa.", ".abaaba.", "aaaaaaaa", "aaaaaaaa", ".bbbbbb."},
}
local PAUSE = {"RESUME", "CHARACTERS", "WORLD MAP", "OPTIONS", "TITLE SCREEN"}
local OPTS = {{"SYNTH MIX", "MIX"}, {"TONE", "TONE"}, {"SPEED", "SPEED"}, {"VOLUME", "VOLUME"}}
local LV_POS = {{18, 70}, {44, 52}, {70, 72}, {96, 50}, {122, 68}, {144, 44}}

-- a 3 x 5 dot font, like the console's own
local GLYPH = {
  A = "010101111101101", B = "110101110101110", C = "011100100100011", D = "110101101101110", E = "111100110100111", F = "111100110100100",
  G = "011100101101011", H = "101101111101101", I = "111010010010111", J = "001001001101010", K = "101101110101101", L = "100100100100111",
  M = "101111111101101", N = "110101101101101", O = "010101101101010", P = "110101110100100", Q = "010101101110011", R = "110101110101101",
  S = "011100010001110", T = "111010010010010", U = "101101101101111", V = "101101101101010", W = "101101111111101", X = "101101010101101",
  Y = "101101010010010", Z = "111001010100111", ["0"] = "111101101101111", ["1"] = "010110010010111", ["2"] = "110001010100111",
  ["3"] = "110001010001110", ["4"] = "101101111001001", ["5"] = "111100110001110", ["6"] = "011100111101111", ["7"] = "111001010010010",
  ["8"] = "111101111101111", ["9"] = "111101111001110", ["-"] = "000000111000000", ["."] = "000000000000010", [":"] = "000010000010000",
  ["!"] = "010010010000010", ["?"] = "110001010000010", ["/"] = "001001010100100", [">"] = "100010001010100", ["<"] = "001010100010001",
  ["+"] = "000010111010000", ["*"] = "000101010101000", ["&"] = "000101111010000", ["%"] = "101001010100101", ["#"] = "010111010111010",
}
-- each glyph as runs of dots {column, row, length}, worked out once
local RUNS = {}
for ch, g in pairs(GLYPH) do
  local runs = {}
  for r = 0, 4 do
    local c = 0
    while c < 3 do
      if g:sub(r * 3 + c + 1, r * 3 + c + 1) == "1" then
        local e = c
        while e < 2 and g:sub(r * 3 + e + 2, r * 3 + e + 2) == "1" do e = e + 1 end
        runs[#runs + 1] = {c, r, e - c + 1}
        c = e + 1
      else c = c + 1 end
    end
  end
  RUNS[ch] = runs
end
local function ptext(s, x, y, px, col, align)
  s = string.upper(tostring(s))
  px = px or 1
  local w = #s * 4 * px - px
  if align == "center" then x = math.floor(x - w / 2 + 0.5) elseif align == "right" then x = x - w end
  for i = 1, #s do
    local runs = RUNS[s:sub(i, i)]
    if runs then
      for _, q in ipairs(runs) do fillRect(x + q[1] * px, y + q[2] * px, q[3] * px, px, col) end
    end
    x = x + 4 * px
  end
end
local function dark(hex)
  return mix(hex, "#000000", 0.45)
end
local function hero(name, x, y, px, col)
  sprite(SPR[name] or SPR.KNIGHT, x, y, px, {a = col, b = dark(col), w = PAL.white})
end

-- the state that is kept: character, level, coins
local st = load("pq", {ch = 1, lv = 1})
local page, cc, lc, pi, oi = "title", st.ch, st.lv, 1, 1
local msg, msgT = "", 0
local coins, jumpT, scroll, lvl, lastNote = 0, -1, 0, 0, 0
local powered = false
local function flash(t) msg = t; msgT = time() + 0.9 end
local function keep() save("pq", st) end

local function press(k)
  local d = (k == "UP" or k == "LEFT") and -1 or 1
  if page == "title" then
    if k == "START" or k == "A" then page, cc = "chars", st.ch end
  elseif page == "chars" then
    if k == "LEFT" or k == "RIGHT" then cc = (cc - 1 + d) % 8 + 1
    elseif k == "UP" or k == "DOWN" then cc = (cc + 3) % 8 + 1
    elseif k == "A" or k == "START" then st.ch = cc; keep(); page, lc = "levels", st.lv; flash(CHARS[cc].name .. " JOINS!")
    elseif k == "B" then page = "title" end
  elseif page == "levels" then
    if k == "LEFT" or k == "RIGHT" or k == "UP" or k == "DOWN" then lc = (lc - 1 + d) % #LEVELS + 1
    elseif k == "A" or k == "START" then st.lv = lc; keep(); page = "game"
    elseif k == "B" then page = "chars" end
  elseif page == "game" then
    if k == "START" then page, pi = "pause", 1
    elseif k == "SELECT" then page, lc = "levels", st.lv
    elseif k == "A" then jumpT = time()
    elseif k == "LEFT" or k == "RIGHT" then st.ch = (st.ch - 1 + d) % 8 + 1; keep() end
  elseif page == "pause" then
    if k == "UP" or k == "DOWN" then pi = (pi - 1 + d) % #PAUSE + 1
    elseif k == "A" then
      page = ({"game", "chars", "levels", "options", "title"})[pi]
      cc, lc = st.ch, st.lv
    elseif k == "B" or k == "START" then page = "game" end
  elseif page == "options" then
    if k == "UP" or k == "DOWN" then oi = (oi - 1 + d) % #OPTS + 1
    elseif k == "LEFT" or k == "RIGHT" then
      local name = OPTS[oi][2]
      setKnob(name, math.clamp(math.floor(knob(name) * 10 + 0.5) / 10 + d * 0.1, 0, 1))
    elseif k == "A" or k == "B" or k == "START" then page = "pause" end
  end
end

on("change", function(e)
  local n = e.name
  if n == "POWER-UP" then
    powered = not powered
    if powered then flash("POWER UP!") end
  elseif n == "< LEVEL" or n == "LEVEL >" then
    st.lv = (st.lv - 1 + (n == "LEVEL >" and 1 or -1) + #LEVELS) % #LEVELS + 1
    keep()
    lc = st.lv
    flash("WARP " .. LEVELS[st.lv].name:sub(1, 3))
    if page == "title" then page = "game" end
  elseif n == "UP" or n == "DOWN" or n == "LEFT" or n == "RIGHT" or n == "A" or n == "B" or n == "START" or n == "SELECT" then
    press(n)
  end
end)

-- the circuit follows the character and the level
local function drive()
  local c, L = CHARS[st.ch] or CHARS[1], LEVELS[st.lv] or LEVELS[1]
  local spd = knob("SPEED")
  output("Voice", c.mode / 7)
  output("Octave", ((c.oct or 0) + 2) / 3)
  output("Crush on", L.cr > 0)
  output("Crush", L.cr)
  output("Slice on", L.sl > 0)
  output("Pattern", L.sl / 15)
  output("Slice time", 1 - spd)
  output("Echo on", L.dl[1] > 0)
  output("Echo time", math.clamp(L.dl[1] * (1.5 - spd), 20, 1200) / 1200)
  output("Repeats", L.dl[2])
  output("Echo mix", L.dl[3])
  output("Echo type", L.cr > 0 and 0.3 or 0)
  output("Verb type", L.rv[1] / 9)
  output("Verb mix", L.rv[2])
  output("Wobble", L.wobble == true)
  output("Power", powered)
end

local function stars()
  for i = 0, 25 do fillRect((i * 53) % W, (i * 37) % 70, 1, 1, PAL.white) end
end
local function title()
  stars()
  ptext("PIXEL", W / 2 + 2, 20, 4, PAL.red, "center")
  ptext("QUEST", W / 2 + 2, 44, 4, PAL.red, "center")
  ptext("PIXEL", W / 2, 18, 4, PAL.yellow, "center")
  ptext("QUEST", W / 2, 42, 4, PAL.yellow, "center")
  if blink(400) then ptext("PRESS START", W / 2, 74, 1.5, PAL.white, "center") end
  for i, n in ipairs({"KNIGHT", "WIZARD", "KITTY", "SLIME"}) do
    local c = n == "KNIGHT" and CHARS[1] or n == "WIZARD" and CHARS[3] or n == "KITTY" and CHARS[7] or CHARS[8]
    hero(n, 32 + (i - 1) * 26, 88 + (blink(300) and i % 2 or 0), 2, c.col)
  end
  ptext("TONE ZONE 2026", W / 2, 112, 1, PAL.grey, "center")
end
local function chars()
  stars()
  ptext("SELECT CHARACTER", W / 2, 4, 1.5, PAL.white, "center")
  for i, c in ipairs(CHARS) do
    local x, y = 6 + (i - 1) % 4 * 38, 16 + math.floor((i - 1) / 4) * 42
    fillRect(x, y, 34, 38, fade(PAL.ink, 0.35))
    rect(x, y, 34, 38, i == cc and (blink(400) and PAL.yellow or PAL.orange) or PAL.grey, i == cc and 2 or 1)
    hero(c.name, x + 5, y + 4, 3, c.col)
    ptext(c.name, x + 17, y + 30, 1, PAL.white, "center")
    if tapped(x, y, 34, 38) then if i == cc then press("A") else cc = i end end
  end
  local c = CHARS[cc]
  ptext(c.name .. " - " .. c.voice, W / 2, 103, 1, PAL.yellow, "center")
  for i, l in ipairs({"PWR", "MAG", "SPD"}) do ptext(l .. " " .. string.rep("#", c.stats[i]), 8 + (i - 1) * 52, 112, 1, PAL.green) end
end
local function levels()
  stars()
  ptext("WORLD MAP", W / 2, 4, 1.5, PAL.white, "center")
  for i = 2, #LV_POS do
    local a, b = LV_POS[i - 1], LV_POS[i]
    for k = 0, 9 do
      if k % 2 == 0 then
        local t0, t1 = k / 10, (k + 1) / 10
        line(a[1] + (b[1] - a[1]) * t0, a[2] + (b[2] - a[2]) * t0, a[1] + (b[1] - a[1]) * t1, a[2] + (b[2] - a[2]) * t1, PAL.peach, 2)
      end
    end
  end
  for i, p in ipairs(LV_POS) do
    fillRect(p[1] - 5, p[2] - 5, 10, 10, LEVELS[i].col)
    rect(p[1] - 5, p[2] - 5, 10, 10, i == lc and (blink(400) and PAL.white or PAL.yellow) or PAL.ink, 1)
    ptext(LEVELS[i].name:sub(1, 3), p[1], p[2] + 8, 1, PAL.white, "center")
    if tapped(p[1] - 9, p[2] - 9, 18, 18) then if i == lc then press("A") else lc = i end end
  end
  local c = CHARS[st.ch]
  hero(c.name, LV_POS[lc][1] - 6, LV_POS[lc][2] - 19, 1.5, c.col)
  fillRect(4, 92, W - 8, 24, fade(PAL.ink, 0.6))
  rect(4, 92, W - 8, 24, PAL.white, 1)
  ptext("WORLD " .. LEVELS[lc].name, 9, 96, 1.5, PAL.yellow)
  ptext("FX: " .. LEVELS[lc].fx .. (lc == st.lv and "  *NOW" or ""), 9, 107, 1, PAL.white)
end
local function game(dt, frozen)
  local c, L = CHARS[st.ch], LEVELS[st.lv]
  fillRect(0, 12, W, 78, L.sky)
  -- the music moves the game: louder playing runs faster, each new note jumps
  if not frozen then
    local now = time()
    local v = math.clamp(((signal("outDb") or -90) + 48) / 42, 0, 1)
    if v > lvl + 0.18 and v > 0.35 and now - lastNote > 0.16 then lastNote = now; jumpT = now; coins = (coins + 1) % 1000 end
    lvl = v * 0.3 + lvl * 0.7
    scroll = (scroll + (0.4 + 3 * lvl * (0.5 + knob("SPEED"))) * dt * 30) % 16
  end
  local sc = scroll
  local t = time()
  for x = -40, W + 40, 40 do
    local hx = x - ((sc * 0.4 + t * 4) % 40)
    polygon({hx, 90, hx, 78, hx + 8, 78, hx + 8, 72, hx + 16, 72, hx + 16, 68, hx + 24, 68, hx + 24, 72, hx + 32, 72, hx + 32, 78, hx + 40, 78, hx + 40, 90}, PAL.dgreen, true)
  end
  for x = -16, W + 16, 16 do
    fillRect(x - sc, 90, 15, 4, PAL.orange)
    fillRect(x - sc, 94, 16, 10, PAL.brown)
    fillRect(x - sc + 4, 97, 3, 2, PAL.orange)
  end
  for i = 0, 3 do
    local cx = ((i * 41 - sc * 3 - t * 20) % (W + 20) + W + 20) % (W + 20) - 10
    fillRect(cx, 46, 3, 6, PAL.yellow)
    fillRect(cx - 1, 47, 5, 4, PAL.yellow)
  end
  local jt = (t - jumpT) / 0.38
  local jy = (jt >= 0 and jt < 1) and math.sin(jt * math.pi) * 18 or 0
  hero(c.name, 34, 66 - jy, 3, (powered and math.floor(t * 12) % 2 == 1) and PAL.yellow or c.col)
  if powered then
    for i = 0, 7 do
      local a = t * 8 + i * 0.785
      fillRect(46 + math.cos(a) * 20, 76 - jy + math.sin(a) * 18, 2, 2, PAL.yellow)
    end
  end
  -- HUD: character, world, coins; hearts are the volume, the bottom line the mix and effects
  fillRect(0, 0, W, 12, PAL.ink)
  ptext(c.name, 14, 3.5, 1, PAL.white)
  ptext("W" .. L.name:sub(1, 3), 80, 3.5, 1, PAL.white, "center")
  ptext("*" .. string.format("%03d", coins), W - 6, 3.5, 1, PAL.yellow, "right")
  fillRect(0, 104, W, 16, PAL.ink)
  local hearts = math.clamp(math.floor(knob("VOLUME") * 5 + 0.5), 0, 5)
  ptext(string.rep("&", hearts), 6, 108, 1.5, PAL.red)
  ptext(string.rep("-", 5 - hearts), 6 + hearts * 6, 108, 1.5, PAL.red)
  ptext("MIX " .. math.floor(knob("MIX") * 100 + 0.5) .. "%", W - 6, 106, 1, PAL.white, "right")
  ptext(L.fx, W - 6, 113, 1, PAL.white, "right")
end
local function pause()
  fillRect(30, 26, 100, 70, PAL.ink)
  rect(30, 26, 100, 70, PAL.white, 1.5)
  ptext("PAUSED", 80, 32, 2, PAL.yellow, "center")
  for i, t in ipairs(PAUSE) do
    ptext(t, 48, 50 + (i - 1) * 9, 1, PAL.white)
    if tapped(30, 48 + (i - 1) * 9, 100, 9) then pi = i; press("A") end
  end
  ptext(">", 42, 50 + (pi - 1) * 9, 1, PAL.red)
end
local function options()
  fillRect(10, 22, 140, 80, PAL.ink)
  rect(10, 22, 140, 80, PAL.white, 1.5)
  ptext("OPTIONS", 80, 28, 2, PAL.yellow, "center")
  for i, o in ipairs(OPTS) do
    local y = 42 + (i - 1) * 13
    ptext(o[1], 22, y, 1, PAL.white)
    local v = knob(o[2])
    for k = 0, 9 do fillRect(82 + k * 6, y - 1, 4, k < math.floor(v * 10 + 0.5) and 7 or 1, PAL.green) end
    if tapped(10, y - 3, 140, 12) then oi = i; press(mouse.x < 110 and "LEFT" or "RIGHT") end
  end
  ptext(">", 16, 42 + (oi - 1) * 13, 1, PAL.red)
  ptext("LEFT/RIGHT CHANGE  B BACK", 80, 94, 1, PAL.white, "center")
end

function draw(dt)
  clear(pedalOn() and PAL.bg or "#0b0f1c")
  if page == "title" then
    title()
    if tapped(0, 0, W, H) then press("START") end
  elseif page == "chars" then chars()
  elseif page == "levels" then levels()
  else
    game(dt, page ~= "game")
    if page == "game" and mouse.pressed then press(mouse.y < 14 and "START" or "A") end
    if page == "pause" then pause() elseif page == "options" then options() end
  end
  if time() < msgT then
    fillRect(10, 50, W - 20, 16, PAL.ink)
    rect(10, 50, W - 20, 16, PAL.yellow, 1)
    ptext(msg, W / 2, 55, 1.5, PAL.yellow, "center")
  end
  drive()
end
`;
