// Screen code of the Advanced Command Center template (factory-showcase-acc.js). Two screens share the pedal's
// files (the multi-file system, docs/screen-scripts.md):
//   lib/acc.lua      what both screens know: the circuits, the controls a preset keeps, the EDIT screen's values
//   lib/bank.lua     the preset bank: presets/bank.bin (bin.pack), presets/names.txt, the recall and deep files
//   lib/ui.lua       drawing helpers both screens use (header, chips, panels, toasts, the shared theme)
//   presets/factory.txt  the factory presets the bank starts with
// PRESETS (left) browses, saves, names, colours, recalls and deletes presets; EDIT (right) pages through the
// circuits, owns twelve deeper values (its outputs drive circuit inputs) and follows every recall.

// what a preset keeps, in file order: [control, kind, positions or DIP number] (k knob or slider, s switch,
// d DIP switch, f footswitch)
export const FIELDS = [
  ['SUSTAIN', 'k'], ['BLEND', 'k'], ['OCTAVE', 'k'], ['FRONT OPT', 'd', 1], ['FRONT OPT', 'd', 2], ['FRONT OPT', 'd', 3], ['FRONT OPT', 'd', 4],
  ['GAIN', 'k'], ['TONE', 'k'], ['BOOST', 'k'], ['VOICE', 's', 3],
  ['RATE', 'k'], ['DEPTH', 'k'], ['WET', 'k'], ['MOD TYPE', 's', 5],
  ['TIME', 'k'], ['REPEATS', 'k'], ['ECHO', 'k'], ['ECHO TYPE', 's', 3], ['SPACE OPT', 'd', 1], ['SPACE OPT', 'd', 2], ['SPACE OPT', 'd', 3], ['SPACE OPT', 'd', 4],
  ['GATE', 'k'], ['OUTPUT', 'k'],
  ['FRONT', 'f'], ['DRIVE', 'f'], ['MOD', 'f'], ['SPACE', 'f'],
];
// the EDIT screen's own values: its outputs 1 to 12 drive these circuit inputs (page 1 FRONT ... 4 SPACE)
export const DEEP = [
  { name: 'Attack', label: 'ATTACK', page: 1, def: 0.3 },
  { name: 'Wah Q', label: 'WAH Q', page: 1, def: 0.55 },
  { name: 'Wah mode', label: 'WAH MODE', page: 1, def: 0, opts: ['PEDAL', 'LFO', 'AUTO'] },
  { name: 'Amp', label: 'AMP GAIN', page: 2, def: 0.3 },
  { name: 'Bass', label: 'BASS', page: 2, def: 0.5, fmt: 'db12' },
  { name: 'Treble', label: 'TREBLE', page: 2, def: 0.5, fmt: 'db12' },
  { name: 'Feedback', label: 'FEEDBACK', page: 3, def: 0.4 },
  { name: 'Shape', label: 'SHAPE', page: 3, def: 0.3 },
  { name: 'Ring', label: 'RING MOD', page: 3, def: 0 },
  { name: 'Verb type', label: 'REVERB', page: 4, def: 1 / 9, opts: ['ROOM', 'HALL', 'PLATE', 'SPRING', 'SHIMMER', 'CLOUD', 'MOD', 'DYNAMIC', '+DELAY', 'SWELL'] },
  { name: 'Verb tone', label: 'TONE', page: 4, def: 0.6 },
  { name: 'Pattern', label: 'SLICE', page: 4, def: 1 / 15, steps: 16 },
];

// the factory presets: name, colour (1 to 8), then what differs from the template's own settings
const BASE = {
  SUSTAIN: 0.5, BLEND: 0.8, OCTAVE: 0, 'FRONT OPT 1': 1, 'FRONT OPT 2': 1, 'FRONT OPT 3': 0, 'FRONT OPT 4': 0,
  GAIN: 0.45, TONE: 0.55, BOOST: 0.3, VOICE: 0, RATE: 0.35, DEPTH: 0.55, WET: 0.5, 'MOD TYPE': 0,
  TIME: 0.6, REPEATS: 0.35, ECHO: 0.3, 'ECHO TYPE': 0, 'SPACE OPT 1': 0, 'SPACE OPT 2': 0, 'SPACE OPT 3': 0, 'SPACE OPT 4': 0,
  GATE: 0.25, OUTPUT: 0.75, FRONT: 1, DRIVE: 1, MOD: 1, SPACE: 1,
};
const FACTORY = [
  ['CLEAN SPARKLE', 4, { DRIVE: 0, WET: 0.35, RATE: 0.3, DEPTH: 0.45, ECHO: 0.2, TIME: 0.55, REPEATS: 0.25 }, { 'Verb type': 2 / 9, 'Verb tone': 0.7 }],
  ['CRUNCH RHYTHM', 1, { MOD: 0, GAIN: 0.5, BOOST: 0.15, ECHO: 0.12, REPEATS: 0.2 }, { Amp: 0.35, Bass: 0.56, Treble: 0.56 }],
  ['LEAD SOLO', 2, { VOICE: 0.5, GAIN: 0.7, BOOST: 0.5, MOD: 0, ECHO: 0.3, TIME: 0.64, REPEATS: 0.42, 'SPACE OPT 3': 1 }, { Amp: 0.4, 'Verb type': 1 / 9 }],
  ['FUZZ WALL', 7, { VOICE: 1, GAIN: 0.82, TONE: 0.4, OCTAVE: 0.45, 'MOD TYPE': 0.5, WET: 0.4, ECHO: 0.15 }, { 'Verb type': 5 / 9, Feedback: 0.6 }],
  ['AMBIENT SWELL', 6, { DRIVE: 0, SUSTAIN: 0.7, DEPTH: 0.65, ECHO: 0.45, TIME: 0.82, REPEATS: 0.6, 'ECHO TYPE': 0.5, 'SPACE OPT 4': 1 }, { 'Verb type': 4 / 9, 'Verb tone': 0.75, Attack: 0.6 }],
  ['SURF TREMOLO', 5, { DRIVE: 0, 'MOD TYPE': 0.75, RATE: 0.55, DEPTH: 0.7, ECHO: 0.1 }, { 'Verb type': 3 / 9, Shape: 0.85 }],
  ['LO-FI SLICER', 3, { MOD: 0, 'SPACE OPT 1': 1, 'SPACE OPT 2': 1, TIME: 0.5, ECHO: 0.18 }, { Pattern: 5 / 15, 'Verb type': 0 }],
  ['WHAMMY DIVE', 8, { 'FRONT OPT 4': 1, VOICE: 0.5, GAIN: 0.6, MOD: 0, ECHO: 0.2 }, { Amp: 0.35 }],
];
const fieldKey = (f) => (f[1] === 'd' ? f[0] + ' ' + f[2] : f[0]);
function factoryText() {
  return FACTORY.map(([name, col, ctl, deep]) => {
    const vals = FIELDS.map((f) => ctl[fieldKey(f)] ?? BASE[fieldKey(f)]);
    const dv = DEEP.map((d) => deep[d.name] ?? d.def);
    return [name, col, [...vals, ...dv].map((v) => +v.toFixed(3)).join(' ')].join('|');
  }).join('\n') + '\n';
}

// Lua tables made from the lists above, so the code and the circuit always agree
const q = (s) => '"' + String(s).replace(/"/g, '') + '"';
const fieldsLua = '{\n' + FIELDS.map((f) => '  {' + [q(f[0]), q(f[1]), ...(f[2] != null ? [f[2]] : [])].join(', ') + '},').join('\n') + '\n}';
const deepLua = '{\n' + DEEP.map((d) => '  {' + [`name = ${q(d.label)}`, `page = ${d.page}`, `def = ${+d.def.toFixed(4)}`, d.opts ? `opts = {${d.opts.map(q).join(', ')}}` : '', d.steps ? `steps = ${d.steps}` : '', d.fmt ? `fmt = ${q(d.fmt)}` : ''].filter(Boolean).join(', ') + '},').join('\n') + '\n}';

// ------------------------------------------------------------------ lib/acc.lua
const ACC_LIB = String.raw`-- Advanced Command Center: what both screens share. The four circuits and their effects, the controls a
-- preset keeps (FIELDS), the values the EDIT screen owns (DEEP, its outputs 1 to 12), colours and settings.
local M = {}

M.SLOTS = 16
M.COLORS = {"#ff7a2f", "#ffc23f", "#3ddc84", "#2fd3c4", "#2b9bff", "#8a6cff", "#ff4fa3", "#e8ecf2"}
M.COLOR_NAMES = {"ORANGE", "AMBER", "GREEN", "TEAL", "BLUE", "VIOLET", "PINK", "WHITE"}
M.THEMES = {"tft", "neon", "ice", "sunset", "amp"}
M.THEME_NAMES = {"STEEL", "NEON", "ICE", "SUNSET", "AMP"}

M.SECTIONS = {
  {name = "FRONT", color = "#3ddc84", foot = "FRONT", fx = {"GATE", "COMP", "WAH", "OCTAVE", "WHAMMY"}},
  {name = "DRIVE", color = "#ff7a2f", foot = "DRIVE", fx = {"BOOST", "OD", "DIST", "FUZZ", "AMP", "EQ"}},
  {name = "MOD", color = "#b45cff", foot = "MOD", fx = {"CHORUS", "PHASER", "FLANGER", "TREMOLO", "VIBE", "RING"}},
  {name = "SPACE", color = "#2b9bff", foot = "SPACE", fx = {"DELAY", "SLICER", "FREEZE", "REVERB", "LO-FI"}},
}

-- what a preset keeps: {control, kind, positions or DIP number}
M.FIELDS = ${fieldsLua}
-- the EDIT screen's values, in the order of its outputs
M.DEEP = ${deepLua}
M.NF = #M.FIELDS
M.NDEEP = #M.DEEP

-- a field as a number from 0 to 1
function M.read(f)
  local kind = f[2]
  if kind == "k" then return knob(f[1]) end
  if kind == "s" then return (switch(f[1]) - 1) / (f[3] - 1) end
  if kind == "d" then return dip(f[1], f[3]) and 1 or 0 end
  return footswitch(f[1]) and 1 or 0
end

-- set a field, only when it changes (each change is like turning the control by hand)
function M.write(f, v)
  local kind = f[2]
  if kind == "k" then
    if math.abs(knob(f[1]) - v) > 0.0005 then setKnob(f[1], v) end
  elseif kind == "s" then
    local p = math.round(v * (f[3] - 1)) + 1
    if switch(f[1]) ~= p then setSwitch(f[1], p) end
  elseif kind == "d" then
    local on = v > 0.5
    if dip(f[1], f[3]) ~= on then setDip(f[1], f[3], on) end
  else
    local on = v > 0.5
    if footswitch(f[1]) ~= on then setFootswitch(f[1], on) end
  end
end

function M.snapshot()
  local out = {}
  for i, f in ipairs(M.FIELDS) do out[i] = M.read(f) end
  return out
end

function M.apply(vals)
  for i, f in ipairs(M.FIELDS) do
    if vals[i] ~= nil then M.write(f, vals[i]) end
  end
end

function M.deepDefaults()
  local t = {}
  for i, d in ipairs(M.DEEP) do t[i] = d.def end
  return t
end

-- positions of a value with options or steps (nil for a plain 0 to 1 value)
function M.count(d)
  if d.opts then return #d.opts end
  return d.steps
end

function M.fmt(d, v)
  local n = M.count(d)
  if d.opts then return d.opts[math.round(v * (n - 1)) + 1] end
  if n then return tostring(math.round(v * (n - 1)) + 1) .. " / " .. n end
  if d.fmt == "db12" then return string.format("%+.1f DB", (v - 0.5) * 24) end
  return tostring(math.floor(v * 100 + 0.5)) .. "%"
end

-- an encoder turned n detents on a deep value: options click one at a time, others go in 2% steps
function M.step(d, v, n)
  local c = M.count(d)
  if c then return math.clamp((math.round(v * (c - 1)) + n) / (c - 1), 0, 1) end
  return math.clamp(math.round((v + n * 0.02) * 100) / 100, 0, 1)
end

-- which effects of section i are on, in the order of SECTIONS[i].fx (deep: the EDIT values, may be nil)
function M.active(i, deep)
  if i == 1 then
    return {dip("FRONT OPT", 1), dip("FRONT OPT", 2), dip("FRONT OPT", 3), knob("OCTAVE") > 0.03, dip("FRONT OPT", 4)}
  elseif i == 2 then
    local v = switch("VOICE")
    local eq = deep ~= nil and (math.abs(deep[5] - 0.5) > 0.02 or math.abs(deep[6] - 0.5) > 0.02)
    return {knob("BOOST") > 0.03, v == 1, v == 2, v == 3, true, eq}
  elseif i == 3 then
    local t = switch("MOD TYPE")
    return {t == 1, t == 2, t == 3, t == 4, t == 5, deep ~= nil and deep[9] > 0.02}
  end
  -- FREEZE is a latching footswitch that freezes when pressed off (on is its resting state)
  return {knob("ECHO") > 0.02, dip("SPACE OPT", 2), not footswitch("FREEZE"), true, dip("SPACE OPT", 1)}
end

-- the settings both screens follow: colour theme and brightness (settings.txt)
function M.settings()
  local s = {theme = 1, dim = 1}
  local t = fs.read("settings.txt")
  if t then
    for _, line in ipairs(t:split("\n")) do
      local kv = line:split("=")
      if kv[1] == "theme" then s.theme = math.clamp(math.floor(tonumber(kv[2]) or 1), 1, #M.THEMES) end
      if kv[1] == "dim" then s.dim = math.clamp(tonumber(kv[2]) or 1, 0.3, 1) end
    end
  end
  return s
end

function M.saveSettings(s)
  fs.write("settings.txt", "theme=" .. s.theme .. "\ndim=" .. string.format("%.2f", s.dim))
end

return M
`;

// ------------------------------------------------------------------ lib/bank.lua
const BANK_LIB = String.raw`-- The preset bank both screens share:
--   presets/bank.bin   "ACC1", version, slots, fields, deep values; then per slot: used, colour and each value
--                      as a 16 bit number (bin.pack "<H")
--   presets/names.txt  one name per slot, one per line
--   state/deep.bin     the EDIT screen's values right now (it writes them when they change)
--   state/recall.txt   the last recall: a counter and the slot, so the EDIT screen follows it
--   state/stamp.txt    a counter bumped on every bank write, so the other screen reloads
local acc = require("lib/acc")
local M = {}

local BANK, NAMES = "presets/bank.bin", "presets/names.txt"
local DEEPF, RECALL, STAMP = "state/deep.bin", "state/recall.txt", "state/stamp.txt"
local HEAD = "<c4 B B B B"
M.slots = {}
M.names = {}

local function empty()
  M.slots, M.names = {}, {}
  for i = 1, acc.SLOTS do
    M.slots[i] = {used = false, color = 1, vals = {}}
    M.names[i] = ""
  end
end

-- the bank from its files (the factory presets the first time)
function M.load()
  empty()
  local s = fs.readBin(BANK)
  if s == nil then
    M.seed()
    return
  end
  if #s >= bin.size(HEAD) then
    local magic, ver, n, nf, nd, pos = bin.unpack(HEAD, s)
    if magic == "ACC1" then
      for i = 1, n do
        if pos + 1 + (nf + nd) * 2 > #s then break end
        local used, col
        used, col, pos = bin.unpack("<B B", s, pos)
        local vals = {}
        for k = 1, nf + nd do
          local v
          v, pos = bin.unpack("<H", s, pos)
          -- fields first, then the deep values: a bank from a version with other counts still lines up
          if k <= nf and k <= acc.NF then vals[k] = v / 65535 end
          if k > nf and k - nf <= acc.NDEEP then vals[acc.NF + k - nf] = v / 65535 end
        end
        if i <= acc.SLOTS then M.slots[i] = {used = used == 1, color = math.clamp(col, 1, #acc.COLORS), vals = vals} end
      end
    end
  end
  local t = fs.read(NAMES)
  if t then
    local lines = t:split("\n")
    for i = 1, acc.SLOTS do M.names[i] = (lines[i] or ""):trim() end
  end
end

-- the factory presets (presets/factory.txt: name|colour|values)
function M.seed()
  empty()
  local t = fs.read("presets/factory.txt") or ""
  local i = 0
  for _, line in ipairs(t:split("\n")) do
    local p = line:split("|")
    if #p >= 3 and i < acc.SLOTS then
      i += 1
      local vals = {}
      for k, v in ipairs(p[3]:split(" ")) do vals[k] = tonumber(v) or 0 end
      M.slots[i] = {used = true, color = tonumber(p[2]) or 1, vals = vals}
      M.names[i] = p[1]
    end
  end
  M.save()
end

function M.save()
  local parts = {bin.pack(HEAD, "ACC1", 1, acc.SLOTS, acc.NF, acc.NDEEP)}
  local nv = acc.NF + acc.NDEEP
  for i = 1, acc.SLOTS do
    local sl = M.slots[i]
    parts[#parts + 1] = bin.pack("<B B", sl.used and 1 or 0, sl.color)
    for k = 1, nv do
      parts[#parts + 1] = bin.pack("<H", math.round(math.clamp(sl.vals[k] or 0, 0, 1) * 65535))
    end
  end
  fs.writeBytes(BANK, table.concat(parts))
  fs.write(NAMES, table.concat(M.names, "\n"))
  fs.write(STAMP, tostring(M.stamp() + 1))
end

function M.used(i)
  return M.slots[i] ~= nil and M.slots[i].used
end

function M.name(i)
  if not M.used(i) then return "EMPTY" end
  local n = M.names[i]
  if n == "" then return "PRESET " .. i end
  return n
end

function M.color(i)
  if not M.used(i) then return "#5a606b" end
  return acc.COLORS[M.slots[i].color] or acc.COLORS[1]
end

function M.count()
  local n = 0
  for i = 1, acc.SLOTS do
    if M.used(i) then n += 1 end
  end
  return n
end

-- store the controls (and the EDIT screen's values) in slot i
function M.store(i, name, color)
  local vals = acc.snapshot()
  local deep = M.readDeep()
  for k = 1, acc.NDEEP do vals[acc.NF + k] = deep[k] end
  M.slots[i] = {used = true, color = color, vals = vals}
  M.names[i] = name
  M.save()
end

function M.remove(i)
  M.slots[i] = {used = false, color = 1, vals = {}}
  M.names[i] = ""
  M.save()
end

-- the EDIT screen's values
function M.readDeep()
  local s = fs.readBin(DEEPF)
  local out = acc.deepDefaults()
  if s ~= nil and #s >= acc.NDEEP * 2 then
    local pos = 1
    for k = 1, acc.NDEEP do
      local v
      v, pos = bin.unpack("<H", s, pos)
      out[k] = v / 65535
    end
  end
  return out
end

function M.writeDeep(vals)
  local parts = {}
  for k = 1, acc.NDEEP do parts[k] = bin.pack("<H", math.round(math.clamp(vals[k] or 0, 0, 1) * 65535)) end
  fs.writeBytes(DEEPF, table.concat(parts))
end

-- the deep values kept in slot i (nil for an empty slot)
function M.deepOf(i)
  if not M.used(i) then return nil end
  local out = acc.deepDefaults()
  for k = 1, acc.NDEEP do
    local v = M.slots[i].vals[acc.NF + k]
    if v ~= nil then out[k] = v end
  end
  return out
end

function M.markRecall(count, slot)
  fs.write(RECALL, count .. "," .. slot)
end

function M.lastRecall()
  local t = fs.read(RECALL)
  if t == nil then return 0, 0 end
  local p = t:split(",")
  return tonumber(p[1]) or 0, tonumber(p[2]) or 0
end

function M.stamp()
  return tonumber(fs.read(STAMP) or "0") or 0
end

-- slot i differs from the controls now? (cheap enough to run a few times a second)
function M.edited(i)
  if not M.used(i) then return false end
  local vals = M.slots[i].vals
  for k, f in ipairs(acc.FIELDS) do
    local v = vals[k]
    if v ~= nil and math.abs(acc.read(f) - v) > 0.004 then return true end
  end
  return false
end

return M
`;

// ------------------------------------------------------------------ lib/ui.lua
const UI_LIB = String.raw`-- Drawing helpers both screens use, and the theme they share.
local acc = require("lib/acc")
local M = {}

M.set = acc.settings()
theme(acc.THEMES[M.set.theme])
font("condensed", 8)

-- follow settings.txt (the EDIT screen's HOME page changes it)
function M.refresh()
  local s = acc.settings()
  if s.theme ~= M.set.theme then theme(acc.THEMES[s.theme]) end
  M.set = s
end

-- dim the whole screen at the end of draw()
function M.finish()
  if M.set.dim < 0.99 then fillRect(0, 0, W, H, fade("#000000", 1 - M.set.dim)) end
end

function M.panel(x, y, w, h, edge)
  fillRoundRect(x, y, w, h, 3, colors.panel)
  roundRect(x, y, w, h, 3, edge or fade(colors.dim, 0.6))
end

-- a small rounded label; filled when on
function M.chip(label, x, y, w, h, color, on)
  if on then
    fillRoundRect(x, y, w, h, 2, fade(color, 0.85))
    text(label, x + w / 2, y + h / 2, colors.bg, 8, "middle", "bold")
  else
    roundRect(x, y, w, h, 2, fade(color, 0.55))
    text(label, x + w / 2, y + h / 2, fade(colors.fg, 0.55), 8, "middle", "bold")
  end
end

function M.header(title, color)
  fillRect(0, 0, W, 15, colors.panel)
  fillRect(0, 15, W, 1, fade(color, 0.8))
  text(title, 5, 4, colors.fg, 9, "left", "bold")
end

-- a value bar with a thin track
function M.vbar(x, y, w, v, color)
  fillRect(x, y, w, 3, fade(colors.dim, 0.35))
  fillRect(x, y, w * math.clamp(v, 0, 1), 3, color)
end

-- a short message that fades out
local msg, msgT = "", 0
M.toastY = H - 38
function M.toast(s)
  msg, msgT = s, 1.8
end
function M.drawToast(dt)
  if msgT <= 0 then return end
  msgT -= dt
  local w = textWidth(msg, 9, "bold") + 16
  alpha(math.clamp(msgT * 2, 0, 1))
  fillRoundRect((W - w) / 2, M.toastY, w, 15, 7, colors.fg)
  text(msg, W / 2, M.toastY + 7.5, colors.bg, 9, "middle", "bold")
  alpha(1)
end

-- an input level that never reads below a gentle idle movement (inputs read 0 off the board)
function M.level(name)
  return math.clamp(input(name), 0, 1)
end

return M
`;

// ------------------------------------------------------------------ PRESETS screen
export const ACC_PRESETS_SCRIPT = String.raw`-- PRESETS: the preset library of the Advanced Command Center.
-- PRESET encoder picks a slot, RECALL loads it, STORE saves the sound there (press STORE again, or tap SAVE,
-- to confirm the name). Tap a slot to pick it, tap it again to load it. The footswitches PRESET - and
-- PRESET + load the previous and next preset. Presets live in the pedal's files (lib/bank.lua), so they stay
-- with the pedal on the board and the EDIT screen follows each recall.
-- Outputs: Ring (the PRESET ring's dot), Ring R / G / B (its colour, also the PRESET LEDs), Slot and Recall
-- (read by the EDIT screen). Inputs: In and Out levels, Beat (the tap tempo LFO).
local acc = require("lib/acc")
local bank = require("lib/bank")
local ui = require("lib/ui")

bank.load()
local sel = 1
local cur = 0
local recalls = 0
local mode = "browse"     -- browse, save, delete
local draftName = ""
local draftColor = 1
local edited = false
local stamp = bank.stamp()
local inPk, outPk = 0, 0

-- start where the last recall left off
do
  local n, slot = bank.lastRecall()
  recalls = n
  if slot >= 1 and slot <= acc.SLOTS then
    cur = slot
    sel = slot
  end
end

local function hexCh(c, i)
  return tonumber(c:sub(i, i + 1), 16) / 255
end

-- the ring and the PRESET LEDs show the picked slot in its colour
local function sendRing()
  local c = bank.color(sel)
  output("Ring", (sel - 1) / (acc.SLOTS - 1))
  output("Ring R", math.round(hexCh(c, 2), 2))
  output("Ring G", math.round(hexCh(c, 4), 2))
  output("Ring B", math.round(hexCh(c, 6), 2))
end

local function recall(i)
  if not bank.used(i) then
    ui.toast("SLOT " .. i .. " IS EMPTY")
    return
  end
  acc.apply(bank.slots[i].vals)
  cur = i
  sel = i
  recalls = (recalls + 1) % 10000
  bank.markRecall(recalls, i)
  output("Slot", i)
  output("Recall", recalls % 256)
  edited = false
  ui.toast("LOADED " .. string.format("%02d", i) .. " " .. bank.name(i))
end

-- the next used slot from i going dir (or i itself when none)
local function nextUsed(i, dir)
  for k = 1, acc.SLOTS do
    local j = (i - 1 + dir * k) % acc.SLOTS + 1
    if bank.used(j) then return j end
  end
  return i
end

local function openSave()
  mode = "save"
  if bank.used(sel) then
    draftName = bank.name(sel)
    draftColor = bank.slots[sel].color
  else
    draftName = string.format("USER %02d", sel)
    draftColor = (sel - 1) % #acc.COLORS + 1
  end
end

local function doSave()
  local name = draftName:trim():upper()
  if name == "" then name = string.format("USER %02d", sel) end
  bank.store(sel, name:sub(1, 16), draftColor)
  stamp = bank.stamp()
  cur = sel
  recalls = (recalls + 1) % 10000
  bank.markRecall(recalls, sel)
  output("Slot", sel)
  output("Recall", recalls % 256)
  mode = "browse"
  edited = false
  ui.toast("SAVED " .. string.format("%02d", sel) .. " " .. name)
end

local function doDelete()
  bank.remove(sel)
  stamp = bank.stamp()
  if cur == sel then cur = 0 end
  mode = "browse"
  ui.toast("DELETED SLOT " .. sel)
end

-- the pedal's controls
on("encoder", "PRESET", function(e)
  if mode == "browse" then
    sel = (sel - 1 + e.dir * e.steps) % acc.SLOTS + 1
  elseif mode == "save" then
    draftColor = (draftColor - 1 + e.dir) % #acc.COLORS + 1
  end
end)
-- while the on-screen keyboard is up, OK on it comes first
on("change", "STORE", function(e)
  if focused() then return end
  if mode == "save" then doSave() else openSave() end
end)
on("change", "RECALL", function(e)
  if focused() then return end
  if mode ~= "browse" then mode = "browse" else recall(sel) end
end)
on("change", "PRESET -", function(e)
  mode = "browse"
  recall(nextUsed(cur > 0 and cur or sel, -1))
end)
on("change", "PRESET +", function(e)
  mode = "browse"
  recall(nextUsed(cur > 0 and cur or sel, 1))
end)
-- a preset loaded on the board may bring other files
on("preset", function(e)
  bank.load()
  stamp = bank.stamp()
end)
on("timer", 400, function(e)
  ui.refresh()
  local s = bank.stamp()
  if s ~= stamp then
    stamp = s
    bank.load()
  end
  edited = cur > 0 and bank.edited(cur)
end)

-- ---------------------------------------------------------------- drawing
local GX, GY, CW, RH = 4, 20, (W - 12) / 2, 15

local function slotCell(i)
  local col = (i - 1) // 8
  local row = (i - 1) % 8
  local x = GX + col * (CW + 4)
  local y = GY + row * RH
  local used = bank.used(i)
  local c = bank.color(i)
  if i == cur then fillRoundRect(x, y, CW, RH - 2, 3, fade(c, 0.22)) end
  fillRect(x + 2, y + 2, 3, RH - 6, used and c or fade(colors.dim, 0.5))
  text(string.format("%02d", i), x + 9, y + 3, i == sel and colors.fg or colors.dim, 9, "left", "mono")
  text(bank.name(i), x + 25, y + 3, used and colors.fg or fade(colors.dim, 0.8), 9, "left", "bold")
  if i == cur and edited then text("*", x + CW - 7, y + 2, colors.warn, 9, "left", "bold") end
  if i == sel then roundRect(x, y, CW, RH - 2, 3, colors.accent, 1) end
  if mode == "browse" and tapped(x, y, CW, RH - 2) then
    if sel == i then recall(i) else sel = i end
  end
end

local function topBar()
  fillRect(0, 0, W, 16, colors.panel)
  local c = cur > 0 and bank.color(cur) or colors.dim
  fillRect(0, 16, W, 1, fade(c, 0.9))
  text("PRESETS", 5, 4, colors.dim, 9, "left", "bold")
  local title = cur > 0 and (string.format("%02d ", cur) .. bank.name(cur)) or "NO PRESET"
  text(title, 52, 4, c, 9, "left", "bold")
  if edited then text("EDITED", 52 + textWidth(title, 9, "bold") + 6, 4, colors.warn, 9, "left", "bold") end
  -- levels and the tap tempo
  local i, o = ui.level("In"), ui.level("Out")
  inPk = math.max(i, inPk - 0.02)
  outPk = math.max(o, outPk - 0.02)
  text("IN", W - 78, 4, colors.dim, 8, "left")
  meter(W - 68, 5, 22, 5, inPk, 8)
  text("OUT", W - 42, 4, colors.dim, 8, "left")
  meter(W - 30, 5, 22, 5, outPk, 8)
  fillCircle(W - 4, 8, 2, input("Beat") > 0.5 and colors.bad or fade(colors.dim, 0.5))
end

local function bottomBar()
  local y = H - 18
  fillRect(0, y - 2, W, 20, colors.panel)
  local bw = 52
  if button("LOAD", 4, y, bw, 14) then recall(sel) end
  if button("SAVE", 4 + (bw + 4), y, bw, 14) then openSave() end
  if bank.used(sel) and button("DELETE", 4 + (bw + 4) * 2, y, bw, 14, colors.bad) then mode = "delete" end
  text(bank.count() .. " / " .. acc.SLOTS .. " USED", W - 4, y + 1, colors.dim, 8, "right")
  text(math.floor(fs.used() / 1024) .. " KB OF FILES", W - 4, y + 8, colors.dim, 8, "right")
end

local function saveDialog()
  fillRect(0, 0, W, H, fade(colors.bg, 0.75))
  local x, y, w, h = 26, 22, W - 52, H - 44
  ui.panel(x, y, w, h, colors.accent)
  text(string.format("SAVE TO SLOT %02d", sel), x + 8, y + 7, colors.fg, 9, "left", "bold")
  if bank.used(sel) then text("REPLACES " .. bank.name(sel), x + w - 8, y + 7, colors.warn, 8, "right") end
  text("NAME", x + 8, y + 24, colors.dim, 8, "left")
  draftName = textfield("name", x + 8, y + 32, w - 16, 16, draftName, 16)
  text("COLOUR  (TURN PRESET)", x + 8, y + 56, colors.dim, 8, "left")
  local sw = (w - 16) / #acc.COLORS
  for k, c in ipairs(acc.COLORS) do
    local sx = x + 8 + (k - 1) * sw
    fillRoundRect(sx + 1, y + 64, sw - 2, 14, 3, c)
    if k == draftColor then roundRect(sx - 1, y + 62, sw + 2, 18, 4, colors.fg, 2) end
    if tapped(sx, y + 64, sw, 14) then draftColor = k end
  end
  if button("SAVE", x + 8, y + h - 22, 70, 15) then doSave() end
  if button("CANCEL", x + 84, y + h - 22, 70, 15) then mode = "browse" end
  text("OR PRESS STORE", x + w - 8, y + h - 18, colors.dim, 8, "right")
end

local function deleteDialog()
  fillRect(0, 0, W, H, fade(colors.bg, 0.75))
  local x, y, w, h = 46, 50, W - 92, 74
  ui.panel(x, y, w, h, colors.bad)
  text("DELETE THIS PRESET?", x + w / 2, y + 12, colors.fg, 9, "middle", "bold")
  text(string.format("%02d ", sel) .. bank.name(sel), x + w / 2, y + 28, bank.color(sel), 9, "middle", "bold")
  if button("DELETE", x + 10, y + h - 24, 80, 16, colors.bad) then doDelete() end
  if button("KEEP", x + w - 90, y + h - 24, 80, 16) then mode = "browse" end
end

function draw(dt)
  clear()
  topBar()
  for i = 1, acc.SLOTS do slotCell(i) end
  bottomBar()
  if mode == "save" then saveDialog() elseif mode == "delete" then deleteDialog() end
  sendRing()
  if mode == "browse" then ui.drawToast(dt) end
  ui.finish()
end
`;

// ------------------------------------------------------------------ EDIT screen
export const ACC_EDIT_SCRIPT = String.raw`-- EDIT: the effects editor of the Advanced Command Center.
-- PAGE turns through HOME, FRONT, DRIVE, MOD and SPACE (or tap the tabs). The four EDIT encoders under the
-- screen set the four values at the bottom of the page: three deeper values this screen owns (its outputs
-- 1 to 12 drive the circuits) and one panel control. HOME shows the whole chain and sets the shared theme
-- and brightness. A recalled preset (inputs Slot and Recall, from the PRESETS screen) brings its values here.
local acc = require("lib/acc")
local bank = require("lib/bank")
local ui = require("lib/ui")
ui.toastY = H - 62

local PAGES = {"HOME", "FRONT", "DRIVE", "MOD", "SPACE"}
local PCOL = {"#e6ebf2", "#3ddc84", "#ff7a2f", "#b45cff", "#2b9bff"}
-- the four values at the bottom of each page: a deep value (its number) or a panel control
local SLOTS = {
  {{ctl = "GATE"}, {ctl = "OUTPUT"}, {set = "theme"}, {set = "dim"}},
  {{deep = 1}, {deep = 2}, {deep = 3}, {ctl = "OCTAVE"}},
  {{deep = 4}, {deep = 5}, {deep = 6}, {ctl = "BOOST"}},
  {{deep = 7}, {deep = 8}, {deep = 9}, {ctl = "WET"}},
  {{deep = 10}, {deep = 11}, {deep = 12}, {ctl = "ECHO"}},
}

local page = 1
local deep = {}
for k = 1, acc.NDEEP do deep[k] = outputValue(k) end
local deepDirty = true
local lastRecall = bank.lastRecall()
local stamp = -1
local presetName, presetColor = "", colors.dim
local flow = 0
local playing = false

local function hexCh(c, i)
  return tonumber(c:sub(i, i + 1), 16) / 255
end

-- a deep value changed: send it, and keep the file the PRESETS screen stores from up to date
local function sendDeep(k)
  output(k, deep[k])
  bank.writeDeep(deep)
end

local function showPreset(slot)
  if slot >= 1 and bank.used(slot) then
    presetName = string.format("%02d ", slot) .. bank.name(slot)
    presetColor = bank.color(slot)
  else
    presetName, presetColor = "", colors.dim
  end
end

-- a recall on the PRESETS screen: take the deep values kept with that preset
local function follow(slot)
  bank.load()
  stamp = bank.stamp()
  local d = bank.deepOf(slot)
  if d ~= nil then
    for k = 1, acc.NDEEP do
      deep[k] = d[k]
      output(k, deep[k])
    end
    deepDirty = true
    ui.toast("RECALLED " .. bank.name(slot))
  end
  showPreset(slot)
end

do
  bank.load()
  stamp = bank.stamp()
  local _, slot = bank.lastRecall()
  showPreset(slot)
end

-- one slot's value and how to change it
local function slotInfo(s)
  if s.deep then
    local d = acc.DEEP[s.deep]
    return d.name, deep[s.deep], acc.fmt(d, deep[s.deep])
  elseif s.ctl then
    return s.ctl, knob(s.ctl), valueText(s.ctl)
  elseif s.set == "theme" then
    return "THEME", (ui.set.theme - 1) / (#acc.THEMES - 1), acc.THEME_NAMES[ui.set.theme]
  end
  return "BRIGHT", (ui.set.dim - 0.3) / 0.7, math.floor(ui.set.dim * 100) .. "%"
end

local function turn(s, n)
  if s.deep then
    deep[s.deep] = acc.step(acc.DEEP[s.deep], deep[s.deep], n)
    sendDeep(s.deep)
  elseif s.ctl then
    setKnob(s.ctl, math.clamp(knob(s.ctl) + n * 0.02, 0, 1))
  elseif s.set == "theme" then
    ui.set.theme = (ui.set.theme - 1 + n) % #acc.THEMES + 1
    acc.saveSettings(ui.set)
    theme(acc.THEMES[ui.set.theme])
  else
    ui.set.dim = math.clamp(ui.set.dim + n * 0.05, 0.3, 1)
    acc.saveSettings(ui.set)
  end
end

on("encoder", "PAGE", function(e)
  page = (page - 1 + e.dir) % #PAGES + 1
end)
for k, name in ipairs({"EDIT 1", "EDIT 2", "EDIT 3", "EDIT 4"}) do
  on("encoder", name, function(e)
    turn(SLOTS[page][k], e.dir * e.steps)
  end)
end
on("input", "Recall", function(e)
  local n, slot = bank.lastRecall()
  lastRecall = n
  follow(math.floor(input("Slot") + 0.5))
end)
-- also watch the recall file, for places where screen to screen wiring is not live
on("timer", 300, function(e)
  ui.refresh()
  local n, slot = bank.lastRecall()
  if n ~= lastRecall then
    lastRecall = n
    follow(slot)
  end
  local s = bank.stamp()
  if s ~= stamp then
    stamp = s
    bank.load()
    showPreset(slot)
  end
  if deepDirty then
    bank.writeDeep(deep)
    deepDirty = false
  end
end)
on("preset", function(e)
  for k = 1, acc.NDEEP do deep[k] = outputValue(k) end
  deepDirty = true
end)

-- ---------------------------------------------------------------- drawing
local function tabs()
  local tw = W / #PAGES
  fillRect(0, 0, W, 16, colors.panel)
  for i, name in ipairs(PAGES) do
    local x = (i - 1) * tw
    if i == page then
      fillRect(x + 1, 0, tw - 2, 16, fade(PCOL[i], 0.9))
      text(name, x + tw / 2, 8, colors.bg, 9, "middle", "bold")
    else
      text(name, x + tw / 2, 8, fade(PCOL[i], 0.75), 9, "middle", "bold")
    end
    if tapped(x, 0, tw, 16) then page = i end
  end
  fillRect(0, 16, W, 1, fade(PCOL[page], 0.9))
end

-- the four values, one above each EDIT encoder
local function slots()
  local y0 = H - 40
  local sw = W / 4
  fillRect(0, y0 - 2, W, 42, colors.panel)
  for k, s in ipairs(SLOTS[page]) do
    local x = (k - 1) * sw
    local name, v, txt = slotInfo(s)
    local c = s.ctl and colors.fg or PCOL[page]
    if k > 1 then fillRect(x, y0 + 2, 1, 34, fade(colors.dim, 0.4)) end
    text(name, x + sw / 2, y0 + 3, colors.dim, 8, "center")
    text(txt, x + sw / 2, y0 + 13, c, 10, "center", "bold")
    ui.vbar(x + 8, y0 + 29, sw - 16, v, c)
    text("E" .. k, x + 4, y0 + 3, fade(colors.dim, 0.6), 6, "left")
    if tapped(x, y0, sw, 40) then turn(s, 1) end
  end
end

local function arrow(x, y, c)
  polygon({x, y - 3, x + 4, y, x, y + 3}, c, true)
end

-- HOME: the chain, what is on in each circuit, and its level
local function home(dt)
  local secs = acc.SECTIONS
  local bw, gap, y, h = 70, 8, 22, 100
  local x0 = (W - (bw * 4 + gap * 3)) / 2
  local lv = {ui.level("Front"), ui.level("Drive"), ui.level("Mod"), ui.level("Space")}
  flow = flow + dt * (0.5 + lv[4] * 2)
  for i, s in ipairs(secs) do
    local x = x0 + (i - 1) * (bw + gap)
    local on = footswitch(s.foot)
    local c = on and s.color or colors.dim
    fillRoundRect(x, y, bw, h, 4, on and fade(s.color, 0.12) or colors.panel)
    roundRect(x, y, bw, h, 4, fade(c, on and 0.9 or 0.5))
    text(s.name, x + bw / 2, y + 8, c, 9, "middle", "bold")
    local act = acc.active(i, deep)
    for k, fx in ipairs(s.fx) do
      local lit = on and act[k]
      local fy = y + 16 + (k - 1) * 11
      fillCircle(x + 8, fy + 4, 2, lit and s.color or fade(colors.dim, 0.5))
      text(fx, x + 14, fy, lit and colors.fg or fade(colors.dim, 0.8), 8, "left")
    end
    ui.vbar(x + 6, y + h - 8, bw - 12, on and lv[i] or 0, s.color)
    if i < 4 then
      local ax = x + bw + gap / 2
      local p = (flow + i * 0.3) % 1
      arrow(ax - 2, y + h / 2, fade(colors.fg, 0.4 + 0.6 * p))
    end
    if tapped(x, y, bw, h) then page = i + 1 end
  end
  if presetName ~= "" then
    text(presetName, W / 2, y + h + 7, presetColor, 9, "middle", "bold")
  end
end

-- a curve from a function over 0..1, in a box
local function curve(x, y, w, h, fn, c, n)
  local pts = {}
  for i = 0, n do
    local t = i / n
    pts[#pts + 1] = x + t * w
    pts[#pts + 1] = y + h - math.clamp(fn(t), 0, 1) * h
  end
  polyline(pts, c, 2)
end

local function box(x, y, w, h, title)
  ui.panel(x, y, w, h)
  text(title, x + 5, y + 4, mix(colors.dim, colors.fg, 0.35), 8, "left", "bold")
end

-- chips that show (and flip) DIP switches or switch positions
local function dipChips(label, names, x, y, cw, c)
  for k, n in ipairs(names) do
    local on = dip(label, k)
    ui.chip(n, x + (k - 1) * (cw + 3), y, cw, 12, c, on)
    if tapped(x + (k - 1) * (cw + 3), y, cw, 12) then setDip(label, k, not on) end
  end
end
local function switchChips(name, opts, x, y, cw, c)
  local pos = switch(name)
  for k, n in ipairs(opts) do
    ui.chip(n, x + (k - 1) * (cw + 3), y, cw, 12, c, pos == k)
    if tapped(x + (k - 1) * (cw + 3), y, cw, 12) then setSwitch(name, k) end
  end
end

local function frontPage()
  local c = PCOL[2]
  box(6, 22, 96, 92, "COMPRESSOR")
  local sus = knob("SUSTAIN")
  local thr = 0.2 + (1 - sus) * 0.6
  local ratio = 1 + sus * 7
  curve(12, 32, 84, 70, function(t)
    if t < thr then return t end
    return thr + (t - thr) / ratio
  end, c, 24)
  local g = knob("GATE") * 0.5
  line(12 + g * 84, 32, 12 + g * 84, 102, fade(colors.bad, 0.8), 1)
  text("GATE", 14 + g * 84, 92, colors.bad, 8, "left")
  box(108, 22, 98, 92, "WAH")
  local pos = knob("TREADLE")
  local mode = math.round(deep[3] * 2)
  if mode == 1 then pos = 0.5 + 0.5 * math.sin(time() * 3) end
  if mode == 2 then pos = math.clamp(ui.level("Front") * 1.6, 0, 1) end
  local q = 4 + deep[2] * 14
  curve(114, 32, 86, 70, function(t)
    local d = (t - (0.1 + pos * 0.8)) * q
    return 0.15 + 0.8 / (1 + d * d)
  end, c, 30)
  text(acc.DEEP[3].opts[mode + 1], 202, 26, colors.fg, 8, "right")
  box(212, 22, 94, 92, "SWITCHES")
  local labels = {"GATE", "COMP", "WAH", "WHAMMY"}
  for k = 1, 4 do
    local cx, cy = 217 + ((k - 1) % 2) * 44, 34 + ((k - 1) // 2) * 16
    local on = dip("FRONT OPT", k)
    ui.chip(labels[k], cx, cy, 42, 12, c, on)
    if tapped(cx, cy, 42, 12) then setDip("FRONT OPT", k, not on) end
  end
  text("OCTAVE " .. valueText("OCTAVE"), 218, 70, colors.fg, 8, "left")
  text("BLEND " .. valueText("BLEND"), 218, 80, colors.fg, 8, "left")
  local on = footswitch("FRONT")
  ui.chip(on and "FRONT ON" or "FRONT OFF", 218, 94, 83, 13, c, on)
  if tapped(218, 94, 83, 13) then setFootswitch("FRONT", not on) end
end

local function drivePage()
  local c = PCOL[3]
  local v = switch("VOICE")
  box(6, 22, 120, 92, "CLIPPING")
  local g = 1 + knob("GAIN") * (v == 3 and 14 or 8)
  curve(12, 32, 108, 70, function(t)
    local x = (t * 2 - 1) * g
    local y
    if v == 1 then y = x / (1 + math.abs(x)) * 1.2
    elseif v == 2 then y = math.clamp(x * 0.8, -0.85, 0.85)
    else y = math.clamp(x, -0.6, 0.6) * 1.4 end
    return 0.5 + y * 0.42
  end, c, 30)
  switchChips("VOICE", {"OD", "DIST", "FUZZ"}, 12, 100, 34, c)
  box(132, 22, 174, 92, "AMP AND EQ")
  local bass, treb = (deep[5] - 0.5) * 2, (deep[6] - 0.5) * 2
  local tone = knob("TONE")
  curve(138, 36, 162, 60, function(t)
    local lo = bass * math.exp(-t * 5) * 0.35
    local hi = treb * math.exp(-(1 - t) * 5) * 0.35
    local m = (t - 0.55) * 4
    local mid = (tone - 0.5) * 0.25 * math.exp(-m * m)
    return 0.5 + lo + hi + mid
  end, c, 32)
  line(138, 66, 300, 66, fade(colors.dim, 0.5), 1)
  text("AMP " .. acc.fmt(acc.DEEP[4], deep[4]), 138, 100, colors.fg, 8, "left")
  text("BOOST " .. valueText("BOOST"), 300, 100, colors.fg, 8, "right")
end

local function modPage()
  local c = PCOL[4]
  box(6, 22, 200, 92, "LFO")
  -- the wave the knobs ask for, scrolling at the rate (tremolo takes its shape from SHAPE)
  local hz = 0.1 * math.pow(80, knob("RATE"))
  local d = knob("DEPTH")
  local trem = switch("MOD TYPE") == 4
  local sq = deep[8]
  local pts = {}
  for i = 0, 47 do
    local ph = i / 47 * 2 + time() * hz
    local v = math.sin(ph * 6.283)
    if trem then v = math.clamp(v * (1 + sq * 6), -1, 1) end
    pts[#pts + 1] = 12 + i * 4
    pts[#pts + 1] = 59 - v * d * 22
  end
  line(12, 59, 200, 59, fade(colors.dim, 0.4), 1)
  polyline(pts, c, 2)
  -- the circuit's own LFO (input LFO) when it plays
  local l = math.clamp(input("LFO"), 0, 1)
  if l > 0 then playing = true end
  if playing then
    fillCircle(200, 81 - l * 44, 3, colors.fg)
    text("LIVE", 196, 26, colors.good, 8, "right", "bold")
  end
  switchChips("MOD TYPE", {"CHO", "PHA", "FLG", "TRM", "VIB"}, 12, 96, 35, c)
  box(212, 22, 94, 92, "MOTION")
  text("RATE " .. valueText("RATE"), 218, 36, colors.fg, 8, "left")
  text("DEPTH " .. valueText("DEPTH"), 218, 47, colors.fg, 8, "left")
  text("WET " .. valueText("WET"), 218, 58, colors.fg, 8, "left")
  local r = deep[9]
  ring(259, 90, 12, r, r > 0.02 and c or colors.dim, 3)
  text("RING", 259, 90, colors.fg, 8, "middle")
end

local function spacePage()
  local c = PCOL[5]
  box(6, 22, 200, 92, "ECHOES")
  local t = knob("TIME")
  local fb = knob("REPEATS")
  local gap = 8 + t * 30
  local lvl, px = 1, 14
  local mix = knob("ECHO")
  fillRect(px, 36, 2, 58, colors.fg)
  for k = 1, 16 do
    px = px + gap
    lvl = lvl * (0.25 + fb * 0.7)
    if px > 198 or lvl < 0.04 then break end
    local hh = 58 * lvl * (0.4 + mix)
    fillRect(px, 94 - hh, 3, hh, dip("SPACE OPT", 1) and colors.warn or c)
  end
  text(valueText("TIME"), 200, 28, colors.fg, 8, "right")
  if input("Beat") > 0.5 then fillCircle(200, 40, 3, colors.bad) end
  box(212, 22, 94, 92, "REVERB")
  local vt = acc.fmt(acc.DEEP[10], deep[10])
  text(vt, 259, 40, c, 10, "middle", "bold")
  local tail = {}
  for i = 0, 20 do
    tail[#tail + 1] = 218 + i * 4
    tail[#tail + 1] = 102 - math.exp(-i / (4 + deep[11] * 6)) * 48
  end
  polyline(tail, c, 2)
  if not footswitch("FREEZE") then text("FROZEN", 259, 54, colors.warn, 9, "middle", "bold") end
end

local function spaceSwitches()
  dipChips("SPACE OPT", {"LOFI", "SLICE", "DOT", "WOB"}, 12, 98, 40, PCOL[5])
end

function draw(dt)
  clear()
  tabs()
  if page == 1 then home(dt)
  elseif page == 2 then frontPage()
  elseif page == 3 then drivePage()
  elseif page == 4 then modPage()
  else
    spacePage()
    spaceSwitches()
  end
  slots()
  -- the PAGE ring shows the page in its colour
  local pc = PCOL[page]
  output("Page", (page - 1) / (#PAGES - 1))
  output("Page R", math.round(hexCh(pc, 2), 2))
  output("Page G", math.round(hexCh(pc, 4), 2))
  output("Page B", math.round(hexCh(pc, 6), 2))
  ui.drawToast(dt)
  ui.finish()
end
`;

/** The pedal's starting files: the code files both screens require, and the factory presets. */
export function accFiles() {
  return {
    'lib/acc.lua': ACC_LIB,
    'lib/bank.lua': BANK_LIB,
    'lib/ui.lua': UI_LIB,
    'presets/factory.txt': factoryText(),
  };
}
