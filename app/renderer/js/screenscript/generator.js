// The screen generator: pick a look and what to show, get readable script code to edit further.
const q = (s) => JSON.stringify(String(s));
const list = (a) => '{' + a.map(q).join(', ') + '}';

export const STYLES = [
  { id: 'amp', name: 'Amp sim LCD', desc: 'Model name on top, a bar and value for each control' },
  { id: 'phosphor', name: 'Green phosphor', desc: 'Retro scope trace with glow and scanlines' },
  { id: 'oled', name: 'Modern OLED', desc: 'Crisp rings with values, a status line' },
  { id: 'tft', name: 'Colour dashboard', desc: 'Header bar, coloured tiles and a level graph' },
  { id: 'vu', name: 'VU meter', desc: 'Needle meters for the input and output' },
  { id: 'tuner', name: 'Tuner', desc: 'Big note name and a cents needle' },
  { id: 'digits', name: 'Preset digits', desc: 'Big seven segment preset number with a name you can edit' },
  { id: 'pixel', name: 'Pixel art', desc: 'Chunky pixels, a bouncing amp and notes' },
];

const HELPERS = `-- 0 to 1 for any control or signal, so everything can be drawn as a bar
local function amount(name)
  local info = controlInfo(name)
  if info == nil then
    local v = signal(name) or 0
    return type(v) == "number" and math.clamp(v, 0, 1) or 0
  end
  if info.kind == "knob" then return knob(name) end
  if info.kind == "switch" then return (switch(name) - 1) / math.max(1, info.positions - 1) end
  return ctl(name) and 1 or 0
end

-- the value as text
local function show(name)
  if controlInfo(name) then return valueText(name) end
  local v = signal(name) or 0
  if type(v) ~= "number" then return tostring(v) end
  if math.abs(v) >= 100 then return string.format("%d", v) end
  return string.format("%.2f", v)
end
`;

const head = (style, o) => `-- ${STYLES.find((s) => s.id === style).name} screen, made by the screen generator. Edit it freely.
-- draw() runs for every frame. W and H are the screen size in pixels.

local title = ${q(o.title || 'PEDAL')}
local items = ${list(o.items)} -- controls and signals to show
`;

const GEN = {
  amp: (o) => `${head('amp', o)}
theme("amp")

${HELPERS}
function draw()
  clear()
  -- header with the model name and an on light
  gradient(0, 0, W, 12, colors.panel, colors.bg)
  text(title, 3, 3, colors.accent)
  if pedalOn() then
    fillCircle(W - 7, 6, 2.5, colors.good)
  else
    circle(W - 7, 6, 2.5, colors.dim)
  end
  -- one row per item
  local rows = math.max(1, math.min(#items, math.floor((H - 14) / 8)))
  local rh = math.floor((H - 14) / rows)
  for i = 1, rows do
    local name = items[i]
    local y = 14 + (i - 1) * rh
    local ty = y + math.floor((rh - 7) / 2)
    text(name:upper():sub(1, 8), 3, ty, colors.fg)
    local bx, bw = math.floor(W * 0.38), math.floor(W * 0.38)
    fillRoundRect(bx, y + 2, bw, rh - 4, 1, colors.dim)
    fillRoundRect(bx, y + 2, bw * amount(name), rh - 4, 1, colors.accent)
    text(show(name), W - 3, ty, colors.fg, nil, "right")
  end
end
`,
  phosphor: (o) => `${head('phosphor', o)}
local trace = ${q(o.trace || 'in')} -- what moves the trace

theme("phosphor")

${HELPERS}
function draw()
  clear()
  glow(3, colors.fg)
  local gy, gh = 11, H - 22
  -- a dim grid
  alpha(0.4)
  for x = 0, W, W / 8 do line(x, gy, x, gy + gh, colors.dim) end
  for y = gy, gy + gh, gh / 4 do line(0, y, W, y, colors.dim) end
  alpha(1)
  -- the trace: a wave as big as the signal
  local size = 0.15 + amount(trace) * 0.85
  local pts = {}
  for x = 0, W, 2 do
    table.insert(pts, x)
    table.insert(pts, gy + gh / 2 - math.sin(x * 0.16 + time() * 9) * size * gh * 0.45)
  end
  polyline(pts, colors.fg, 1.5)
  text(title, 2, 2, colors.fg)
  if blink(600) then text("_", W - 8, 2, colors.fg) end
  -- values along the bottom
  local n = math.max(1, #items)
  local cw = W / n
  for i, name in ipairs(items) do
    text(name:upper():sub(1, 3) .. " " .. math.floor(amount(name) * 99), (i - 1) * cw + 2, H - 9, colors.fg)
  end
  glow(0)
  scanlines(0.3)
end
`,
  oled: (o) => `${head('oled', o)}
theme("oled")
theme({fg = "#eaf6ff", accent = "#7fe8ff", dim = "#1d3440"})

${HELPERS}
function draw()
  clear()
  -- status line
  text(title, 2, 1, colors.fg)
  if pedalOn() then
    fillRoundRect(W - 17, 1, 15, 8, 3, colors.accent)
    text("ON", W - 9.5, 5, colors.bg, nil, "middle")
  else
    roundRect(W - 17, 1, 15, 8, 3, colors.dim)
    text("OFF", W - 9.5, 5, colors.dim, nil, "middle")
  end
  line(0, 11, W, 11, colors.dim)
  -- a ring for each of the first three items
  local n = math.max(1, math.min(#items, 3))
  local r = math.max(4, math.min((H - 25) / 2, W / (n * 2) - 5))
  local cy = 13 + (H - 13 - 9) / 2
  for i = 1, n do
    local name = items[i]
    if name == nil then break end
    local cx = W * (i - 0.5) / n
    ring(cx, cy, r, amount(name), colors.accent, math.max(2, r * 0.18))
    text(tostring(math.floor(amount(name) * 100)), cx, cy, colors.fg, nil, "middle")
    text(name:upper():sub(1, 9), cx, H - 8, colors.dim, nil, "center")
  end
end
`,
  tft: (o) => `${head('tft', o)}
local graphOf = ${q(o.trace || 'out')} -- the level drawn at the bottom

theme("tft")
local tints = {"#2b9bff", "#ff7a2f", "#3ddc84", "#ff3d6e", "#ffd21f", "#b45cff"}

${HELPERS}
function draw()
  clear()
  -- header bar
  gradient(0, 0, W, 12, "#2b7bd6", "#163f80", false)
  icon("bolt", 2, 1, 10, "#ffffff")
  text(title, 14, 3, "#ffffff")
  text(pedalOn() and "ON" or "BYPASS", W - 3, 3, pedalOn() and "#ffffff" or "#9fb3d9", nil, "right")
  -- tiles
  local gh = math.floor(H * 0.24)
  local area = H - 14 - gh - 2
  local n = #items
  local cols = n > 2 and 2 or math.max(1, n)
  local rows = math.max(1, math.min(math.ceil(n / cols), math.floor(area / 16)))
  local tw, th = W / cols, area / rows
  for i = 1, math.min(n, rows * cols) do
    local name = items[i]
    local x = ((i - 1) % cols) * tw + 1
    local y = 14 + math.floor((i - 1) / cols) * th
    local tint = tints[(i - 1) % #tints + 1]
    fillRoundRect(x, y, tw - 2, th - 2, 2, colors.panel)
    fillRect(x, y, 2, th - 2, tint)
    text(name:upper():sub(1, 9), x + 5, y + 2, "#9fb3d9")
    text(show(name), x + tw - 5, y + 2, colors.fg, nil, "right")
    bar(x + 5, y + th - 6, tw - 12, 2, amount(name), tint, colors.dim)
  end
  -- level graph
  graph(0, H - gh, W, gh, history("graph", amount(graphOf)), "#ff7a2f", 0, 1, true)
end
`,
  vu: (o) => {
    const src = (o.signals.length ? o.signals : ['in', 'out']).slice(0, 2);
    return `${head('vu', { ...o, items: o.items })}
local meters = ${list(src)} -- one needle meter per signal

theme("paper")
theme({bg = "#efe3c2", fg = "#2a2418", dim = "#8a7c5a", bad = "#c9302c"})

${HELPERS}
local needle = {}

-- signal level as a VU reading from 0 to 1 (-20 dB to +3 dB)
local function reading(name)
  if name == "in" or name == "out" then
    return math.clamp((signal(name .. "Db") + 20) / 23, 0, 1)
  end
  return amount(name)
end

function draw()
  clear()
  local mw = W / #meters
  for i, name in ipairs(meters) do
    local x0 = (i - 1) * mw
    local cx, cy = x0 + mw / 2, H * 1.08
    local r = math.min(mw * 0.6, H * 0.95)
    -- the needle rises fast and falls slowly, like a real VU
    local target = reading(name)
    local v = needle[i] or 0
    v = v + (target - v) * (target > v and 0.45 or 0.1)
    needle[i] = v
    -- scale: black up to 0 dB, red above
    arc(cx, cy, r * 0.84, -45, 27, colors.fg, 1)
    arc(cx, cy, r * 0.84, 27, 45, colors.bad, 3)
    for k = 0, 10 do
      local a = math.rad(-45 + k * 9)
      local r0 = r * (k % 5 == 0 and 0.74 or 0.79)
      line(cx + math.sin(a) * r0, cy - math.cos(a) * r0, cx + math.sin(a) * r * 0.84, cy - math.cos(a) * r * 0.84, k >= 8 and colors.bad or colors.fg, 1)
    end
    text("VU", cx, cy - r * 0.5, colors.fg, nil, "center")
    text(name:upper(), x0 + 4, H - 9, colors.dim)
    -- needle
    local a = math.rad(-45 + 90 * v)
    line(cx, cy, cx + math.sin(a) * r * 0.97, cy - math.cos(a) * r * 0.97, "#111111", 1.5)
    if i > 1 then line(x0, 0, x0, H, colors.dim) end
  end
  if not pedalOn() then text("OFF", W - 3, 2, colors.bad, nil, "right") end
end
`;
  },
  tuner: (o) => `${head('tuner', o)}
theme("oled")
theme({fg = "#ffffff", dim = "#33414a"})

${HELPERS}
local NOTES = {"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"}
local shown = 0

function draw()
  clear()
  -- a tuner stage in the circuit gives "note" and "cents"
  local cents = signal("cents")
  local note = signal("note")
  if cents == nil then
    -- no tuner yet: follow the first item so you can see it work
    local semis = amount(items[1] or "in") * 24
    note = NOTES[math.floor(semis + 0.5) % 12 + 1]
    cents = ((semis + 0.5) % 1 - 0.5) * 100
  end
  shown = shown + (cents - shown) * 0.3
  local inTune = math.abs(shown) < 3
  local col = inTune and colors.good or (math.abs(shown) < 15 and colors.warn or colors.bad)
  -- note name
  text(note, W / 2, H * 0.42, col, math.floor(H * 0.5), "middle", "bold")
  if inTune then icon("check", 3, 2, 10, colors.good) end
  text(string.format("%+.0f", shown), W - 3, 2, colors.dim, nil, "right")
  -- cents scale with a moving marker
  local y = H - 6
  for c = -50, 50, 10 do
    local x = W / 2 + c / 50 * (W / 2 - 8)
    line(x, y - (c == 0 and 7 or 3), x, y, colors.dim)
  end
  local x = W / 2 + math.clamp(shown, -50, 50) / 50 * (W / 2 - 8)
  fillRoundRect(x - 2, y - 9, 4, 9, 1, col)
  if shown < -3 then text(">", 3, y - 8, col) end
  if shown > 3 then text("<", W - 8, y - 8, col) end
end
`,
  digits: (o) => `${head('digits', o)}
theme("amber")

${HELPERS}
local preset = load("preset", 1)
local names = load("names", {})

local function pick(n)
  preset = (n - 1) % 16 + 1
  save("preset", preset)
end

function draw()
  clear()
  -- bank letter and slot: A1 .. D4
  local bank = string.char(65 + math.floor((preset - 1) / 4))
  local slot = (preset - 1) % 4 + 1
  local size = math.floor(H * 0.6)
  digits(bank .. slot, 4, math.floor((H - size) / 2), size, colors.fg, fade(colors.dim, 0.45))
  -- the preset name: click it to rename
  local nx = math.floor(size * 1.5) + 10
  local name = names[preset] or ("PRESET " .. preset)
  local n = textfield("name", nx, 4, W - nx - 3, 12, name, 16)
  if n ~= name then
    names[preset] = n
    save("names", names)
  end
  -- the first item as a small readout
  if items[1] then
    text(items[1]:upper():sub(1, 6) .. " " .. show(items[1]), nx, 20, colors.dim)
  end
  -- previous / next
  local by = H - 14
  if button("<", nx, by, 18, 12) then pick(preset - 1) end
  if button(">", nx + 22, by, 18, 12) then pick(preset + 1) end
  if pedalOn() then fillCircle(W - 6, by + 6, 2.5, colors.fg) end
end

-- the wheel steps through the presets too
function onWheel(d)
  pick(preset - d)
end
`,
  pixel: (o) => `${head('pixel', o)}
theme("pico")

${HELPERS}
local S = 2 -- every drawn pixel is S x S screen pixels
local w, h = math.floor(W / S), math.floor(H / S)
local AMP = {
  ".##########.",
  "#..........#",
  "#.oooooooo.#",
  "#.o######o.#",
  "#.oooooooo.#",
  "#..........#",
  ".##########.",
  "..#......#..",
}
local NOTE = {"..##", "..#.#", "..#..", ".##..", "###..", ".#..."}
local notes = {}

function draw()
  clear()
  push()
  scale(S)
  -- the amp bounces with what you play
  local lv = math.clamp((signal("in") or 0) * 1.6, 0, 1)
  local ay = h - 10 - 8 - math.floor(lv * 3)
  fillRect(0, h - 9, w, 9, colors.panel)
  sprite(AMP, 2, ay, 1, {["#"] = colors.fg, o = colors.dim})
  -- notes fly out
  if lv > 0.25 and every(260) then table.insert(notes, {x = 13, y = ay, t = 0}) end
  for i = #notes, 1, -1 do
    local m = notes[i]
    m.t = m.t + dt()
    m.x = m.x + dt() * 16
    m.y = m.y - dt() * 5
    if m.x > w * 0.42 then
      table.remove(notes, i)
    else
      sprite(NOTE, math.floor(m.x), math.floor(m.y + math.sin(m.t * 9)), 1, {["#"] = colors.accent})
    end
  end
  text(title:sub(1, math.floor(w / 6)), 1, h - 8, colors.fg)
  -- chunky bars on the right
  local bx = math.floor(w * 0.45)
  for i, name in ipairs(items) do
    local y = 1 + (i - 1) * 8
    if y + 7 > h - 9 then break end
    text(name:upper():sub(1, 1), bx, y, colors.fg)
    local bw = w - bx - 8
    fillRect(bx + 7, y + 1, bw, 5, colors.dim)
    fillRect(bx + 7, y + 1, math.floor(bw * amount(name) + 0.5), 5, i % 2 == 1 and colors.accent or colors.good)
  end
  pop()
end
`,
};

/**
 * Make code for a style. o = { title, items: [control or signal names], signals: [signal names], trace }
 */
export function generate(style, o = {}) {
  const fn = GEN[style] || GEN.amp;
  const items = (o.items && o.items.length ? o.items : ['in']).slice(0, 8);
  const signals = o.signals || [];
  const trace = o.trace || signals.find((s) => ['in', 'out', 'env', 'lfo'].includes(s)) || 'in';
  return fn({ title: o.title || 'PEDAL', items, signals, trace });
}
