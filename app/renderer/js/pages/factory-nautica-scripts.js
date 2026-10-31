// Screen scripts of the Nautica XL Pedal Factory template (factory-showcase-nautica.js). Plain screen script code
// (docs/screen-scripts.md). The shared code file nx.lua holds the block library, the factory presets and the
// helpers; the MAIN screen runs the unit. The screens talk through the pedal's files: MAIN writes nx/out.txt
// (every circuit value, each screen sends its slice to the circuit) and nx/ui.txt (what the small screens show);
// the side screen and the strips append commands to nx/cmd.txt, which MAIN reads every frame. User presets are
// files too (presets/<n>.txt). Every screen skips its frame when nothing it shows changed.

// ------------------------------------------------------------------ nx.lua (DATA = the generated tables)
export const nxLib = (DATA) => `-- nx.lua: the Nautica XL library shared by all its screens
local M = {}
${DATA}
M.MODES = {"STOMP", "SCENE", "PRESET"}
M.MODE_COL = {"#2ee6d6", "#ffd23f", "#ff8a3d"}
M.SCENE_NAMES = {"VERSE", "CHORUS", "LEAD", "CLEAN", "AMBIENT", "CRUNCH", "SOLO", "OUTRO"}
M.SCENE_COLS = {"#2ee6d6", "#ff8a3d", "#ff4b4b", "#3fb6ff", "#a98bff", "#ffd23f", "#46d36f", "#ff5fb0"}
M.BANKS = {"A", "B", "C", "D"}
M.PER_BANK = 7
M.NPRE = 28
M.STRIPS = {"PRESET & SCENE", "LEVELS", "FOCUSED BLOCK", "TEMPO & TUNER", "PEDALS", "SIGNAL PATH"}
M.FS_NAMES = {"FS 1", "FS 2", "FS 3", "FS 4", "FS 5", "FS 6", "FS 7", "FS 8", "FS 9", "FS 10", "FS 11", "FS 12", "FS 13", "FS 14", "EXP 1 SW", "EXP 2 SW", "EXT FS 1", "EXT FS 2", "EXT FS 3", "EXT FS 4"}
M.EXP_NAMES = {"EXP 1", "EXP 2", "EXT EXP 1", "EXT EXP 2"}
M.SIDE = {"e1", "e2", "x", "y", "s1", "s2"}
M.SIDE_NAMES = {e1 = "ENCODER 1", e2 = "ENCODER 2", x = "XY PAD X", y = "XY PAD Y", s1 = "SLIDER 1", s2 = "SLIDER 2"}
M.ROUTES = {"SERIAL", "PARALLEL", "DUAL"}
M.XFO = {"ASSIGNED SWITCH", "TEMPO PULSE", "TUNER ON", "SCENE 2+ ACTIVE", "EXP 1 ON", "EXP 2 ON"}
M.XEO = {"EXP 1", "EXP 2", "XY PAD X", "XY PAD Y", "SLIDER 1", "SLIDER 2", "MASTER"}

function M.clamp(v, a, b) return math.max(a, math.min(b, v)) end
function M.r3(v) return math.floor(v * 1000 + 0.5) / 1000 end
function M.cut(s, n)
  s = tostring(s or "")
  if #s > n then return s:sub(1, n - 1) .. "." end
  return s
end
-- a knob position (0 to 1) in its own units, and as text
function M.val(k, pos)
  if k.lg then return k.lo * (k.hi / k.lo) ^ pos end
  return k.lo + (k.hi - k.lo) * pos
end
function M.fmt(k, pos)
  local v = M.val(k, pos)
  local f = k.f
  if k.nm then return k.nm[math.floor(v + 0.5) + 1] or "" end
  if f == "ms" then
    if v >= 1000 then return string.format("%.2fs", v / 1000) end
    return math.floor(v + 0.5) .. "ms"
  elseif f == "db" then return (v > 0 and "+" or "") .. string.format("%.1fdB", v)
  elseif f == "st" then local n = math.floor(v + 0.5) return (n > 0 and "+" or "") .. n .. "st"
  elseif f == "ct" then local n = math.floor(v + 0.5) return (n > 0 and "+" or "") .. n .. "c" end
  return math.floor(pos * 100 + 0.5) .. "%"
end
function M.model(st, s)
  local sl = st.slots[s]
  return M.SLOTS[s].m[sl.m] or M.SLOTS[s].m[1]
end
function M.presetName(pi, user)
  if user and user[pi] then return user[pi] end
  local p = M.PRESETS[pi]
  return p and p.name or nil
end
function M.presetLabel(pi, name)
  return M.BANKS[math.floor((pi - 1) / M.PER_BANK) + 1] .. ((pi - 1) % M.PER_BANK + 1) .. "  " .. (name or "EMPTY RIG")
end

-- key = value lines (the screens' shared files), parsed once per new content
local kvCache = {}
function M.readKV(path)
  local s = fs.read(path)
  if not s then return nil, false end
  local c = kvCache[path]
  if c and c.s == s then return c.t, false end
  local t = {}
  for _, line in ipairs(s:split("\\n")) do
    local i = string.find(line, "=")
    if i then t[line:sub(1, i - 1)] = line:sub(i + 1) end
  end
  kvCache[path] = {s = s, t = t}
  return t, true
end
function M.parts(s) return (s or ""):split("|") end
-- a command for MAIN (the side screen and the strips)
function M.lvl(v)
  if v <= 0.004 then return 0 end
  return M.clamp((20 * math.log(v) / math.log(10) + 48) / 48, 0, 1)
end
function M.cmd(s) fs.append("nx/cmd.txt", s .. "\\n") end

-- assignments are short texts: "auto", "blk:5", "scn:3", "par:5:2" ...
function M.split2(a)
  local p = (a or "auto"):split(":")
  return p[1], tonumber(p[2]), tonumber(p[3])
end
function M.stompSlots(st)
  local list = {}
  for s = 1, 14 do list[s] = s end
  return list
end
-- what footswitch i (1 to 20) does now
function M.fsFunc(st, i)
  local mode = st.mode
  if i <= 14 then
    if mode == 2 and i <= 8 then return "scn:" .. i end
    if mode == 3 then
      if i <= 7 then return "prs:" .. i end
      if i == 8 then return "bdn" end
      if i == 14 then return "bup" end
      return "scn:" .. (i - 8)
    end
  end
  local a = st.fs[i] or "auto"
  if a ~= "auto" then return a end
  if i == 15 or i == 16 then return "expb:" .. (i - 14) end
  if i <= 14 then return "blk:" .. (M.stompSlots(st)[i] or 0) end
  return "none"
end
function M.expTarget(st, i)
  local a = st.exp[i] or "none"
  local t, s, k = M.split2(a)
  if t == "none" then return nil end
  if t == "vol" then return {vol = true, name = "VOLUME"} end
  if t == "par" and M.SLOTS[s] then
    local m = M.model(st, s)
    if m.k[k] then return {s = s, k = k, name = M.SLOTS[s].id .. " " .. m.k[k].l} end
    return nil
  end
  if i == 1 then
    local m = M.model(st, 10)
    if m.wah then return {s = 10, k = 1, blk = 10, name = "B2 WAH"} end
    return {vol = true, name = "VOLUME"}
  elseif i == 2 then
    if st.slots[6].on == 1 then return {s = 6, k = 3, name = "A6 DELAY MIX"} end
    return {s = 7, k = 2, name = "A7 REVERB MIX"}
  end
  return nil
end
function M.expOn(st, i)
  local t = M.expTarget(st, i)
  if t and t.blk then return st.slots[t.blk].on == 1 end
  return (st.eon[i] or 1) == 1
end
function M.sideTarget(st, key, fs, fk)
  local t, s, k = M.split2(st.side[key] or "auto")
  if t == "none" then return nil end
  if t == "alvl" then return {mix = "a", name = "PATH A LEVEL"} end
  if t == "blvl" then return {mix = "b", name = "PATH B LEVEL"} end
  if t == "par" and M.SLOTS[s] then
    local m = M.model(st, s)
    if m.k[k] then return {s = s, k = k, name = M.SLOTS[s].id .. " " .. m.k[k].l} end
    return nil
  end
  local m = M.model(st, fs)
  local n = #m.k
  if n == 0 then return nil end
  local i = 1
  if key == "e1" then i = M.clamp(fk or 1, 1, n)
  elseif key == "e2" then
    i = math.min(2, n)
    for j, kk in ipairs(m.k) do if kk.l == "MIX" then i = j end end
  elseif key == "y" then i = math.min(2, n)
  elseif key == "s1" then i = math.min(3, n)
  elseif key == "s2" then i = math.min(4, n) end
  return {s = fs, k = i, name = M.SLOTS[fs].id .. " " .. m.k[i].l}
end
function M.fsInfo(st, i, user, tuner)
  local t, a = M.split2(M.fsFunc(st, i))
  local W = "#e8ecf3"
  if t == "blk" then
    if not M.SLOTS[a] then return "", "", "#2a2f38", false end
    local m = M.model(st, a)
    return m.s, M.SLOTS[a].id .. " " .. M.SLOTS[a].s, M.SLOTS[a].c, st.slots[a].on == 1
  elseif t == "scn" then return st.scn[a] or M.SCENE_NAMES[a], "SCENE " .. a, M.SCENE_COLS[a], st.sc == a
  elseif t == "prs" then
    local bank = math.floor((st.pi - 1) / M.PER_BANK)
    local pi = bank * M.PER_BANK + a
    return M.presetName(pi, user) or "EMPTY RIG", M.BANKS[bank + 1] .. a, "#ff8a3d", st.pi == pi
  elseif t == "pup" then return "PRESET UP", "PRESET", W, false
  elseif t == "pdn" then return "PRESET DOWN", "PRESET", W, false
  elseif t == "bup" then return "BANK UP", "BANK", W, false
  elseif t == "bdn" then return "BANK DOWN", "BANK", W, false
  elseif t == "tap" then return "TAP", math.floor(st.g.bpm + 0.5) .. " BPM", "#ff3b5c", false
  elseif t == "tun" then return "TUNER", "TUNER", "#46d36f", tuner
  elseif t == "mode" then return "NEXT MODE", "MODE", W, false
  elseif t == "hold" then return "FREEZE", "HOLD", "#a98bff", st.hold == 1
  elseif t == "xfs" then return "EXT FS OUT", "CONTROL", "#ffd23f", false
  elseif t == "expb" then
    local e = M.expTarget(st, a)
    if e and e.blk then return M.model(st, e.blk).s, "EXP " .. a .. " + BLOCK", "#2ee6d6", M.expOn(st, a) end
    return "EXP " .. a, "EXP " .. a .. " ON/OFF", "#2ee6d6", M.expOn(st, a)
  elseif t == "par" then
    local _, ss, kk = M.split2(M.fsFunc(st, i))
    if not M.SLOTS[ss] then return "", "", "#2a2f38", false end
    local m = M.model(st, ss)
    if not m.k[kk] then return "", "", "#2a2f38", false end
    return m.k[kk].l, M.SLOTS[ss].id .. " " .. m.s, M.SLOTS[ss].c, (st.slots[ss].v[kk] or 0) > 0.5
  end
  return "", "", "#2a2f38", false
end

-- the circuit values for a state (by output name)
function M.compute(st, ex)
  local v = {}
  for _, name in ipairs(M.OUTS) do v[name] = M.OUTDEF[name] end
  for s = 1, 16 do
    for _, m in ipairs(M.SLOTS[s].m) do
      for _, o in ipairs(m.on) do v[o] = 0 end
    end
  end
  local over = {}
  local vol = 1
  for i = 1, 4 do
    local t = M.expTarget(st, i)
    if t and M.expOn(st, i) and ex.exp[i] then
      if t.vol then vol = math.min(vol, ex.exp[i])
      elseif ex.moved[i] then over[t.s * 100 + t.k] = ex.exp[i] end
    end
  end
  for s = 1, 16 do
    local sl = st.slots[s]
    local m = M.model(st, s)
    for _, o in ipairs(m.on) do if sl.on == 1 then v[o] = 1 end end
    if m.set then for name, x in pairs(m.set) do v[name] = x end end
    for j, k in ipairs(m.k) do
      local p = over[s * 100 + j] or sl.v[j] or k.d
      if k.g then p = p * sl.on end
      v[k.o] = M.r3(p)
    end
  end
  if st.g.sync == 1 then
    local beat = 60000 / st.g.bpm
    local k = M.SLOTS[6].m[1].k[1]
    v["Delay time"] = M.r3(M.clamp(math.log(beat / k.lo) / math.log(k.hi / k.lo), 0, 1))
  end
  local a, b = st.mix.a, st.mix.b
  local r = st.route
  v["B from A"] = r == 1 and 1 or 0
  v["B from input"] = r == 2 and 1 or 0
  v["B from aux"] = r == 3 and 1 or 0
  v["A level"] = r == 1 and 0 or M.r3(a * (r == 2 and 0.25 or 0.5))
  v["B level"] = M.r3(b * (r == 2 and 0.25 or 0.5))
  v["Vol pedal"] = M.r3(vol)
  v["Tuner mute"] = ex.tuner and 1 or 0
  v["Hold"] = st.hold
  v["Gtr gain"] = M.r3((st.g.gtr + 24) / 36)
  v["Aux gain"] = M.r3((st.g.aux + 24) / 36)
  v["Out 3 src"] = st.g.o3
  v["Out 4 src"] = st.g.o4
  for _, p in ipairs(M.PAGE_LEDS) do v["LED " .. p[1]] = (ex.page == p[2]) and 1 or 0 end
  v["LED MODE"] = ({0.35, 0.7, 1})[st.mode] or 1
  return v
end

-- a preset as text (presets/<n>.txt), and back
local function csv(t) local o = {} for i, x in ipairs(t) do o[i] = tostring(x) end return table.concat(o, ",") end
function M.presetText(p)
  local L = {"name=" .. p.name, "route=" .. p.route, "mix=" .. p.mix.a .. "," .. p.mix.b, "sc=" .. p.sc, "hold=" .. p.hold,
    "scn=" .. csv(p.scn), "fs=" .. csv(p.fs), "exp=" .. csv(p.exp), "eon=" .. csv(p.eon)}
  local sd = {}
  for i, k in ipairs(M.SIDE) do sd[i] = p.side[k] end
  L[#L + 1] = "side=" .. csv(sd)
  for s = 1, 16 do
    local sl = p.slots[s]
    L[#L + 1] = "s" .. s .. "=" .. sl.m .. "," .. sl.on .. "," .. table.concat(sl.v, ";")
  end
  for c = 1, 8 do
    local sc = p.scenes[c]
    local ons, vs = {}, {}
    for s = 1, 16 do ons[s] = sc.on[s]; vs[s] = table.concat(sc.v[s], ";") end
    L[#L + 1] = "c" .. c .. "=" .. table.concat(ons, ",") .. "|" .. table.concat(vs, "/")
  end
  return table.concat(L, "\\n")
end
local function nums(s, sep)
  local o = {}
  if not s or s == "" then return o end
  for i, x in ipairs(s:split(sep)) do o[i] = tonumber(x) or 0 end
  return o
end
function M.presetParse(s)
  if not s then return nil end
  local t = {}
  for _, line in ipairs(s:split("\\n")) do
    local i = string.find(line, "=")
    if i then t[line:sub(1, i - 1)] = line:sub(i + 1) end
  end
  if not t.name or not t.s16 then return nil end
  local mx = nums(t.mix, ",")
  local p = {name = t.name, route = tonumber(t.route) or 1, mix = {a = mx[1] or 1, b = mx[2] or 1}, sc = tonumber(t.sc) or 1, hold = tonumber(t.hold) or 0,
    scn = (t.scn or ""):split(","), fs = (t.fs or ""):split(","), exp = (t.exp or ""):split(","), eon = nums(t.eon, ","), side = {}, slots = {}, scenes = {}}
  local sd = (t.side or ""):split(",")
  for i, k in ipairs(M.SIDE) do p.side[k] = sd[i] or "auto" end
  for s = 1, 16 do
    local f = (t["s" .. s] or "1,0,"):split(",")
    p.slots[s] = {m = tonumber(f[1]) or 1, on = tonumber(f[2]) or 0, v = nums(f[3], ";")}
  end
  for c = 1, 8 do
    local f = (t["c" .. c] or ""):split("|")
    local ons = nums(f[1], ",")
    local vs = (f[2] or ""):split("/")
    local sc = {on = {}, v = {}}
    for s = 1, 16 do sc.on[s] = ons[s] or p.slots[s].on; sc.v[s] = vs[s] and nums(vs[s], ";") or p.slots[s].v end
    p.scenes[c] = sc
  end
  return p
end
return M
`;

// ------------------------------------------------------------------ MAIN (560 x 250)
export const MAIN_SCRIPT = `-- Nautica XL main screen: runs the unit. Pages: SIGNAL CHAIN, BLOCK, LIBRARY, SCENES,
-- PRESETS, TUNER, ASSIGN, I/O, GLOBAL. Tap a block to select it, tap it again to edit it.
-- The 10 dials edit the focused block. Presets are files (presets/<n>.txt).
local N = require("nx")
local SLOTS, clamp, cut = N.SLOTS, N.clamp, N.cut
-- the pages are laid out on 560 x 250 and scaled to the canvas
local SC = W / 560
local W, H = 560, 250

-- ---------------------------------------------------------------- state
local function copy(t)
  local o = {}
  for k, v in pairs(t) do o[k] = type(v) == "table" and copy(v) or v end
  return o
end
local function snapshot(slots)
  local sc = {on = {}, v = {}}
  for s = 1, 16 do sc.on[s] = slots[s].on; sc.v[s] = copy(slots[s].v) end
  return sc
end
-- a factory preset as a live preset
local function factory(pi)
  local P = N.PRESETS[pi]
  local slots = {}
  for s = 1, 16 do
    local spec = P and P.s[s]
    local mi = spec and spec[1] or 1
    local m = SLOTS[s].m[mi] or SLOTS[s].m[1]
    local v = {}
    for j, k in ipairs(m.k) do v[j] = k.d end
    if m.dv then for j, x in pairs(m.dv) do v[j] = x end end
    if spec and spec[3] then for j, x in pairs(spec[3]) do v[j] = x end end
    slots[s] = {m = mi, on = spec and spec[2] or 0, v = v}
  end
  local scenes = {}
  for c = 1, 8 do
    local sc = snapshot(slots)
    local o = P and P.sc and P.sc[c]
    if o then for s, x in pairs(o) do
      if x[1] ~= nil then sc.on[s] = x[1] end
      if x[2] then for j, val in pairs(x[2]) do sc.v[s][j] = val end end
    end end
    scenes[c] = sc
  end
  local fs = {}
  for i = 1, 20 do fs[i] = "auto" end
  fs[17], fs[18], fs[19], fs[20] = "pup", "pdn", "tap", "hold"
  return {name = P and P.name or "EMPTY RIG", route = P and P.route or 1, mix = {a = P and P.ma or 1, b = P and P.mb or 1}, sc = 1, hold = 0,
    scn = copy(N.SCENE_NAMES), fs = fs, exp = {"auto", "auto", "none", "none"}, eon = {1, 1, 1, 1},
    side = {e1 = "auto", e2 = "auto", x = "auto", y = "auto", s1 = "alvl", s2 = "blvl"}, slots = slots, scenes = scenes}
end
local st = load("nx", nil)
local user = {} -- names of the user presets on file
local function scanUser()
  user = {}
  for pi = 1, N.NPRE do
    local s = fs.read("presets/" .. pi .. ".txt")
    if s then
      local i = string.find(s, "\\n")
      user[pi] = (i and s:sub(6, i - 1)) or s:sub(6)
    end
  end
end
scanUser()
local function applyPreset(p, pi)
  for _, k in ipairs({"name", "route", "mix", "sc", "hold", "scn", "fs", "exp", "eon", "side", "slots", "scenes"}) do st[k] = type(p[k]) == "table" and copy(p[k]) or p[k] end
  st.pi = pi
  local sc = st.scenes[st.sc] or st.scenes[1]
  for s = 1, 16 do st.slots[s].on = sc.on[s]; st.slots[s].v = copy(sc.v[s]) end
end
local function loadPreset(pi)
  pi = (pi - 1) % N.NPRE + 1
  local p = N.presetParse(fs.read("presets/" .. pi .. ".txt"))
  applyPreset(p or factory(pi), pi)
  st.sc = 1
  local sc = st.scenes[1]
  for s = 1, 16 do st.slots[s].on = sc.on[s]; st.slots[s].v = copy(sc.v[s]) end
  if st.g.dmode > 0 then st.mode = st.g.dmode end
end
if type(st) ~= "table" or not st.slots or #st.slots ~= 16 then
  st = {pi = 1, mode = 1, g = {bpm = 120, sync = 0, ref = 440, theme = 1, strip1 = 1, strip2 = 2, fsB = 2, dmode = 0, tapLed = 1, gtr = 0, aux = 0, o3 = 0, o4 = 0, xfo = 1, xeo = 1}}
  loadPreset(1)
end
local function keep() st.scenes[st.sc] = snapshot(st.slots) end
local function recall(i)
  keep()
  local sc = st.scenes[i]
  for s = 1, 16 do st.slots[s].on = sc.on[s]; st.slots[s].v = copy(sc.v[s]) end
  st.sc = i
end
local function savePreset(pi)
  keep()
  local p = {name = st.name, route = st.route, mix = st.mix, sc = st.sc, hold = st.hold, scn = st.scn, fs = st.fs, exp = st.exp, eon = st.eon, side = st.side, slots = st.slots, scenes = st.scenes}
  local ok = pcall(fs.write, "presets/" .. pi .. ".txt", N.presetText(p))
  scanUser()
  return ok
end

-- ---------------------------------------------------------------- navigation and editing
local page, cur, pp, fk = "rig", 1, 0, 1 -- cur: focused slot, fk: focused knob
local lcat, lscr, bank, psel, asel, lscr2, gsel, isel = 1, 0, 0, 1, 1, 0, 1, 1
local prevPage = "rig"
local tuner = false
local msg, msgT = "", 0
local dirty, outDirty = true, true
local moved = {false, false, false, false}
local syncing = {}
local function flash(t, s) msg = t; msgT = time() + (s or 1.3); dirty = true end
local function changed() dirty = true; outDirty = true end
local function syncKnobs()
  local m = N.model(st, cur)
  for i = 1, 10 do
    local k = m.k[pp * 10 + i]
    local v = k and (st.slots[cur].v[pp * 10 + i] or k.d) or 0.5
    syncing[tostring(i)] = v
    setKnob(tostring(i), v)
  end
end
local function focus(s)
  if cur ~= s then cur = s; pp = 0; fk = 1; syncKnobs() end
  dirty = true
end
local function setVal(s, j, pos)
  local m = N.model(st, s)
  if not m.k[j] then return end
  st.slots[s].v[j] = N.r3(clamp(pos, 0, 1))
  keep(); changed()
end
local function toggleSlot(s)
  st.slots[s].on = 1 - st.slots[s].on
  keep(); changed()
end
local function setModel(s, mi)
  local m = SLOTS[s].m[mi]
  local v = {}
  for j, k in ipairs(m.k) do v[j] = k.d end
  if m.dv then for j, x in pairs(m.dv) do v[j] = x end end
  st.slots[s] = {m = mi, on = 1, v = v}
  for c = 1, 8 do st.scenes[c].on[s] = 1; st.scenes[c].v[s] = copy(v) end
  changed()
  if s == cur then fk = 1; pp = 0; syncKnobs() end
end
local function setTuner(on)
  if on and not tuner then prevPage = page end
  tuner = on
  page = on and "tun" or (prevPage ~= "tun" and prevPage or "rig")
  changed()
end
-- toggle: a shortcut button pressed again goes back to the signal chain
local function openPage(p, toggle)
  if p == "tun" then return setTuner(not tuner) end
  if tuner then tuner = false; outDirty = true end
  if toggle and page == p and p ~= "rig" then p = "rig" end
  if p == "lib" then lcat = 1; lscr = 0 end
  if p == "pre" then bank = math.floor((st.pi - 1) / N.PER_BANK); psel = st.pi end
  page = p
  changed()
end
local taps = {}
local function tap()
  local now = time()
  local keepT = {}
  for _, t in ipairs(taps) do if now - t < 2.5 then keepT[#keepT + 1] = t end end
  taps = keepT
  taps[#taps + 1] = now
  if #taps < 2 then return end
  local ms = (taps[#taps] - taps[1]) / (#taps - 1) * 1000
  if ms < 200 or ms > 2000 then return end
  st.g.bpm = math.floor(60000 / ms + 0.5)
  local k = SLOTS[6].m[1].k[1]
  if st.g.sync == 0 then st.slots[6].v[1] = N.r3(clamp(math.log(ms / k.lo) / math.log(k.hi / k.lo), 0, 1)); keep() end
  changed()
  flash("TAP  " .. st.g.bpm .. " BPM", 0.9)
end
local xfsDown = 0
local function nextMode()
  st.mode = st.mode % 3 + 1
  changed()
  flash(N.MODES[st.mode] .. " MODE", 0.8)
end
local function runFs(i)
  local t, a, b = N.split2(N.fsFunc(st, i))
  if t == "blk" and SLOTS[a] then toggleSlot(a)
  elseif t == "scn" then recall(a); changed(); syncKnobs(); flash("SCENE " .. a .. "  " .. (st.scn[a] or ""), 0.8)
  elseif t == "prs" then keep(); loadPreset(math.floor((st.pi - 1) / N.PER_BANK) * N.PER_BANK + a); changed(); syncKnobs(); flash(N.presetLabel(st.pi, st.name))
  elseif t == "pup" or t == "pdn" then keep(); loadPreset(st.pi + (t == "pup" and 1 or -1)); changed(); syncKnobs(); flash(N.presetLabel(st.pi, st.name))
  elseif t == "bup" or t == "bdn" then
    keep()
    local nb = (math.floor((st.pi - 1) / N.PER_BANK) + (t == "bup" and 1 or -1)) % #N.BANKS
    loadPreset(nb * N.PER_BANK + (st.pi - 1) % N.PER_BANK + 1); changed(); syncKnobs(); flash("BANK " .. N.BANKS[nb + 1])
  elseif t == "tap" then tap()
  elseif t == "tun" then setTuner(not tuner)
  elseif t == "mode" then nextMode()
  elseif t == "hold" then st.hold = 1 - st.hold; changed()
  elseif t == "expb" then
    local e = N.expTarget(st, a)
    if e and e.blk then toggleSlot(e.blk) else st.eon[a] = 1 - (st.eon[a] or 1); changed() end
    flash(N.EXP_NAMES[a] .. (N.expOn(st, a) and " ON" or " OFF"), 0.7)
  elseif t == "par" and SLOTS[a] then
    local m = N.model(st, a)
    if m.k[b] then setVal(a, b, (st.slots[a].v[b] or 0) > 0.5 and 0 or 1) end
  elseif t == "xfs" and st.g.xfo == 1 then xfsDown = time() + 0.3; outDirty = true end
end

-- every control press: latching buttons and footswitches change on each press
local BUTTONS = {LIBRARY = "lib", AMP = "blk", PRESETS = "pre", SCENES = "scn", TUNER = "tun", ASSIGN = "asg", ["I/O"] = "io", GLOBAL = "glb"}
on("change", function(e)
  local n = e.name
  if e.kind == "knob" and syncing[n] ~= nil then
    if math.abs(e.value - syncing[n]) < 0.0005 then syncing[n] = nil return end
    syncing[n] = nil
  end
  if n:sub(1, 3) == "FS " then return runFs(tonumber(n:sub(4))) end
  if n == "EXP 1 SW" then return runFs(15) end
  if n == "EXP 2 SW" then return runFs(16) end
  if n == "MODE" then return nextMode() end
  if n == "TAP" then return tap() end
  if n == "EXP 1" then moved[1] = true; outDirty = true return end
  if n == "EXP 2" then moved[2] = true; outDirty = true return end
  if n == "HOLD" then st.hold = 1 - st.hold; changed() return end
  if n == "MASTER" or n == "PHONES" or n == "XLR" or n == "MUTE" then dirty = true return end
  if BUTTONS[n] then
    if n == "AMP" then focus(3) end
    return openPage(BUTTONS[n], true)
  end
  local k = tonumber(n)
  if e.kind == "knob" and k then
    local j = pp * 10 + k
    if N.model(st, cur).k[j] then fk = j; setVal(cur, j, e.value) end
  end
end)
-- EXT FS jacks (screen inputs): a press is a rising edge
on("input", function(e)
  if e.port <= 4 then
    if e.value > 0.5 and (e.old or 0) <= 0.5 then runFs(16 + e.port) end
  else moved[e.port - 2] = true; outDirty = true end
end)

-- commands from the side screen and the strips (nx/cmd.txt)
local nav
local function commands()
  local s = fs.read("nx/cmd.txt")
  if not s or s == "" then return end
  fs.write("nx/cmd.txt", "")
  for _, line in ipairs(s:split("\\n")) do
    local p = line:split(" ")
    local c = p[1]
    if c == "nav" then nav(p[2])
    elseif c == "set" then setVal(tonumber(p[2]), tonumber(p[3]), tonumber(p[4]))
    elseif c == "mix" then st.mix[p[2]] = N.r3(clamp(tonumber(p[3]) * 2, 0, 2)); changed()
    elseif c == "focus" then focus(tonumber(p[2]))
    elseif c == "fk" then fk = tonumber(p[2]); dirty = true
    elseif c == "scene" then recall(tonumber(p[2])); changed(); syncKnobs()
    elseif c == "strip" then st.g["strip" .. p[2]] = tonumber(p[3]); changed()
    elseif c == "tap" then tap() end
  end
end

-- ---------------------------------------------------------------- assignments, I/O, global
local ASG = {}
for i = 1, 20 do ASG[#ASG + 1] = {kind = "fs", i = i, name = N.FS_NAMES[i]} end
for i = 1, 4 do ASG[#ASG + 1] = {kind = "exp", i = i, name = N.EXP_NAMES[i]} end
for _, k in ipairs(N.SIDE) do ASG[#ASG + 1] = {kind = "side", k = k, name = N.SIDE_NAMES[k]} end
ASG[#ASG + 1] = {kind = "xfo", name = "EXT FS OUT"}
ASG[#ASG + 1] = {kind = "xeo", name = "EXT EXP OUT"}
local function params()
  local out = {}
  for s = 1, 16 do
    local m = N.model(st, s)
    for j, k in ipairs(m.k) do out[#out + 1] = {SLOTS[s].id .. " " .. m.s .. " " .. k.l, s .. ":" .. j} end
  end
  return out
end
local function choices(it)
  local o = {}
  if it.kind == "fs" then
    o = {{"AUTO", "auto"}, {"NONE", "none"}}
    for s = 1, 16 do o[#o + 1] = {"BLOCK " .. SLOTS[s].id .. " " .. N.model(st, s).s, "blk:" .. s} end
    for c = 1, 8 do o[#o + 1] = {"SCENE " .. c .. " " .. (st.scn[c] or ""), "scn:" .. c} end
    for _, x in ipairs({{"PRESET UP", "pup"}, {"PRESET DOWN", "pdn"}, {"BANK UP", "bup"}, {"BANK DOWN", "bdn"}, {"TAP TEMPO", "tap"}, {"TUNER", "tun"}, {"NEXT MODE", "mode"}, {"FREEZE", "hold"}, {"EXP 1 ON/OFF", "expb:1"}, {"EXP 2 ON/OFF", "expb:2"}, {"EXT FS OUT", "xfs"}}) do o[#o + 1] = x end
    for _, p in ipairs(params()) do o[#o + 1] = {"TOGGLE " .. p[1], "par:" .. p[2]} end
  elseif it.kind == "exp" then
    o = {{"AUTO", "auto"}, {"NONE", "none"}, {"VOLUME PEDAL", "vol"}}
    for _, p in ipairs(params()) do o[#o + 1] = {p[1], "par:" .. p[2]} end
  elseif it.kind == "side" then
    o = {{"AUTO (FOCUSED BLOCK)", "auto"}, {"NONE", "none"}, {"PATH A LEVEL", "alvl"}, {"PATH B LEVEL", "blvl"}}
    for _, p in ipairs(params()) do o[#o + 1] = {p[1], "par:" .. p[2]} end
  else
    local L = it.kind == "xfo" and N.XFO or N.XEO
    for i, l in ipairs(L) do o[#o + 1] = {l, i} end
  end
  return o
end
local function current(it)
  if it.kind == "fs" then return st.fs[it.i] or "auto" end
  if it.kind == "exp" then return st.exp[it.i] or "none" end
  if it.kind == "side" then return st.side[it.k] or "auto" end
  return st.g[it.kind]
end
local function shortOf(it)
  if it.kind == "fs" then
    local m = st.mode
    st.mode = 1
    local l = N.fsInfo(st, it.i, user, tuner)
    st.mode = m
    local a = st.fs[it.i] or "auto"
    if a == "auto" then return l ~= "" and ("AUTO: " .. l) or "AUTO" end
    return l ~= "" and l or "NONE"
  elseif it.kind == "exp" then local t = N.expTarget(st, it.i) return t and t.name or "NONE"
  elseif it.kind == "side" then local t = N.sideTarget(st, it.k, cur, fk) local a = st.side[it.k] return a == "auto" and "AUTO" or (t and t.name or "NONE") end
  return (it.kind == "xfo" and N.XFO or N.XEO)[st.g[it.kind]] or ""
end
local function pick(it, v)
  if it.kind == "fs" then st.fs[it.i] = v
  elseif it.kind == "exp" then st.exp[it.i] = v
  elseif it.kind == "side" then st.side[it.k] = v
  else st.g[it.kind] = v end
  changed()
  page = "asg"
end
local function dbF(v) return (v > 0 and "+" or "") .. string.format("%.1f dB", v) end
local GLOBAL = {
  {"TEMPO", "bpm", 40, 240, 1, function(v) return math.floor(v + 0.5) .. " BPM" end},
  {"DELAY TEMPO SYNC", "sync", nil, nil, nil, {"OFF", "ON"}},
  {"TUNER REFERENCE", "ref", 432, 446, 1, function(v) return v .. " Hz" end},
  {"SCREEN THEME", "theme", nil, nil, nil, {"OCEAN", "MIDNIGHT", "DAYLIGHT"}},
  {"TOP STRIP 1", "strip1", nil, nil, nil, N.STRIPS, 1},
  {"TOP STRIP 2", "strip2", nil, nil, nil, N.STRIPS, 1},
  {"SWITCH DISPLAYS", "fsB", nil, nil, nil, {"DIM", "NORMAL", "BRIGHT"}, 1},
  {"MODE ON PRESET LOAD", "dmode", nil, nil, nil, {"KEEP", "STOMP", "SCENE", "PRESET"}},
  {"TAP TEMPO LED", "tapLed", nil, nil, nil, {"OFF", "ON"}},
  {"EXT FS OUT", "xfo", nil, nil, nil, N.XFO, 1},
  {"EXT EXP OUT", "xeo", nil, nil, nil, N.XEO, 1},
}
local function gValue(r)
  local v = st.g[r[2]]
  if type(r[6]) == "table" then return r[6][r[7] and v or (v + 1)] or "" end
  return r[6](v)
end
local function gStep(r, d)
  local v = st.g[r[2]]
  if type(r[6]) == "table" then
    local n = #r[6]
    if r[7] then st.g[r[2]] = (v - 1 + d) % n + 1 else st.g[r[2]] = (v + d) % n end
  else st.g[r[2]] = clamp(v + d * r[5], r[3], r[4]) end
  changed()
end
local IO = {
  {"GUITAR IN GAIN", "gtr", -24, 12, 0.5, dbF}, {"AUX IN GAIN", "aux", -24, 12, 0.5, dbF},
  {"ROUTING", "route"}, {"PATH A LEVEL", "a"}, {"PATH B LEVEL", "b"},
  {"OUT 3 SOURCE", "o3", nil, nil, nil, {"PATH A", "DRY DI"}}, {"OUT 4 SOURCE", "o4", nil, nil, nil, {"PATH B", "DRY DI"}},
}
local function ioValue(r)
  if r[2] == "route" then return N.ROUTES[st.route] end
  if r[2] == "a" or r[2] == "b" then return math.floor(st.mix[r[2]] * 100 + 0.5) .. "%" end
  if r[6] and type(r[6]) == "table" then return r[6][st.g[r[2]] + 1] end
  return r[6](st.g[r[2]])
end
local function ioStep(r, d)
  if r[2] == "route" then st.route = (st.route - 1 + d) % 3 + 1
  elseif r[2] == "a" or r[2] == "b" then st.mix[r[2]] = N.r3(clamp(st.mix[r[2]] + d * 0.05, 0, 2))
  elseif type(r[6]) == "table" then st.g[r[2]] = (st.g[r[2]] + d) % #r[6]
  else st.g[r[2]] = clamp(st.g[r[2]] + d * r[5], r[3], r[4]) end
  changed()
end

-- jack guide: IDENTIFY blinks a jack's bar LED. MAIN writes nx/id.txt (seq,key,guide open); the I/O rail
-- screens blink that jack for 3 s from the moment the seq changes, and write their levels to nx/lv1.txt and
-- nx/lv2.txt while the guide is open
local jsel, idKey, idUntil, idSeq, lastIdS = 1, "", 0, 0, ""
local function writeId()
  local s = idSeq .. "," .. idKey .. "," .. (page == "jck" and 1 or 0)
  if s ~= lastIdS then lastIdS = s; pcall(fs.write, "nx/id.txt", s) end
end
local function identify(k)
  for i, j in ipairs(N.JACKS) do if j[1] == k then jsel = i end end
  if idKey == k and time() < idUntil then idKey = "" else idSeq = idSeq + 1; idKey = k; idUntil = time() + 3 end
  writeId()
  dirty = true
end
local LOOP_SLOT = {16, 8, 14, 15}
local function jackRoute(k)
  local g = st.g
  if k == "gtr" then return "GAIN " .. dbF(g.gtr) end
  if k == "aux" then return "GAIN " .. dbF(g.aux) end
  if k == "phones" then return "MAIN, PHONES DIAL" end
  if k == "xlr" then return "MAIN, XLR DIAL" end
  if k == "xfo" then return N.XFO[g.xfo] or "" end
  if k == "xeo" then return N.XEO[g.xeo] or "" end
  if k:sub(1, 2) == "xf" then return shortOf(ASG[16 + tonumber(k:sub(3, 3))]) end
  if k:sub(1, 2) == "xe" then return shortOf(ASG[22 + tonumber(k:sub(3, 3))]) end
  local c, n = k:sub(1, 1), tonumber(k:sub(2, 2))
  if (c == "s" or c == "r") and n then
    local sl = LOOP_SLOT[n]
    local on = st.slots[sl].on
    return SLOTS[sl].id .. " " .. N.model(st, sl).s .. ((on == 1 or on == true) and "" or " (OFF)")
  end
  if c == "o" and n then
    if n <= 2 then return "MAIN, MASTER DIAL" end
    if n == 3 then return g.o3 == 0 and "PATH A" or "DRY DI" end
    return g.o4 == 0 and "PATH B" or "DRY DI"
  end
  return ""
end

-- the side screen nav (HOME BACK SAVE UP DOWN, the select encoder: up / down / enter)
local BACK = {lib = "rig", blk = "rig", scn = "rig", pre = "rig", tun = "rig", asg = "rig", asgl = "asg", io = "rig", jck = "io", glb = "rig", rig = "rig"}
nav = function(key)
  dirty = true
  if key == "home" then if tuner then setTuner(false) end page = "rig" return end
  if key == "back" then if page == "tun" then return setTuner(false) end page = BACK[page] or "rig" return end
  if key == "save" then if savePreset(st.pi) then flash("SAVED  " .. N.presetLabel(st.pi, st.name), 1.4) else flash("MEMORY FULL") end return end
  local d = key == "up" and -1 or (key == "down" and 1 or 0)
  if page == "rig" then
    if key == "enter" then page = "blk" else focus((cur - 1 + d) % 16 + 1) end
  elseif page == "blk" then
    local m = N.model(st, cur)
    if key == "enter" then pp = (pp + 1) % math.max(1, math.ceil(#m.k / 10)); syncKnobs()
    else fk = clamp(fk + d, 1, math.max(1, #m.k)) end
  elseif page == "lib" then
    local list = SLOTS[cur].m
    if key == "enter" then setModel(cur, lcat); page = "blk" else lcat = clamp(lcat + d, 1, #list) end
  elseif page == "scn" then if key == "enter" then recall(psel); changed() else psel = (psel - 1 + d) % 8 + 1 end
  elseif page == "pre" then
    if key == "enter" then keep(); loadPreset(psel); changed(); syncKnobs()
    else psel = (psel - 1 + d) % N.NPRE + 1; bank = math.floor((psel - 1) / N.PER_BANK) end
  elseif page == "tun" then st.g.ref = clamp(st.g.ref - d, 432, 446); changed()
  elseif page == "asg" then if key == "enter" then page = "asgl"; lscr2 = 0 else asel = (asel - 1 + d) % #ASG + 1 end
  elseif page == "asgl" then
    local list = choices(ASG[asel])
    if key == "enter" then pick(ASG[asel], list[gsel][2]) else gsel = clamp(gsel + d, 1, #list); lscr2 = clamp(gsel - 7, 0, math.max(0, #list - 28)) end
  elseif page == "glb" then if key == "enter" then gStep(GLOBAL[gsel], 1) else gsel = (gsel - 1 + d) % #GLOBAL + 1 end
  elseif page == "io" then if key == "enter" then ioStep(IO[isel], 1) else isel = (isel - 1 + d) % #IO + 1 end
  elseif page == "jck" then if key == "enter" then identify(N.JACKS[jsel][1]) else jsel = (jsel - 1 + d) % #N.JACKS + 1 end end
end

-- ---------------------------------------------------------------- drawing
local THEMES = {
  {bg = "#060b11", panel = "#0f1821", panel2 = "#162330", line = "#21303f", text = "#eaf2f8", dim = "#7790a3", acc = "#2ee6d6", head = "#0a121a", ink = "#05090d"},
  {bg = "#020304", panel = "#0b0d11", panel2 = "#13161c", line = "#1e232c", text = "#cfd6e2", dim = "#5c6678", acc = "#ff8a3d", head = "#06070a", ink = "#020304"},
  {bg = "#e9eef3", panel = "#ffffff", panel2 = "#dde4ec", line = "#c2ccd8", text = "#121a24", dim = "#5f6c7d", acc = "#0b8f86", head = "#d3dce6", ink = "#0b1118"},
}
local th = THEMES[1]
local hits = {}
local function hit(x, y, w, h, f) hits[#hits + 1] = {x, y, w, h, f} end
local function T(s, x, y, c, size, align) text(s, x, y, c or th.text, size or 7, align or "left", "sans") end
local function Tm(s, x, y, c, size) text(s, x, y, c or th.text, size or 7, "middle", "sans") end
local function chip(x, y, w, h, label, on, col, f, size)
  fillRoundRect(x, y, w, h, h / 2.6, on and (col or th.acc) or th.panel2)
  roundRect(x, y, w, h, h / 2.6, col or th.line)
  Tm(cut(label, math.floor(w / ((size or 5.6) * 0.62))), x + w / 2, y + h / 2, on and th.ink or th.text, size or 5.6)
  if f then hit(x, y, w, h, f) end
end
local PAGE_NAMES = {rig = "SIGNAL CHAIN", lib = "BLOCK LIBRARY", blk = "BLOCK", scn = "SCENES", pre = "PRESETS", tun = "TUNER", asg = "ASSIGN", asgl = "ASSIGN", io = "I/O ROUTING", jck = "JACK GUIDE", glb = "GLOBAL"}
local function header()
  fillRect(0, 0, W, 19, th.head)
  fillRect(0, 19, W, 1, th.line)
  text(cut(N.presetLabel(st.pi, st.name), 26), 8, 4, th.text, 9, "left", "condensed")
  hit(0, 0, 170, 19, function() openPage("pre") end)
  fillCircle(184, 9.5, 3.2, N.SCENE_COLS[st.sc])
  T("SCENE " .. st.sc .. " " .. cut(st.scn[st.sc] or "", 9), 191, 6.5, th.text, 6)
  hit(176, 0, 100, 19, function() openPage("scn") end)
  Tm(PAGE_NAMES[page] or "", 340, 10, th.acc, 6.4)
  chip(420, 3.5, 58, 12, N.MODES[st.mode], true, N.MODE_COL[st.mode], nextMode, 5.4)
  T(math.floor(st.g.bpm + 0.5) .. " BPM", W - 8, 6.5, th.dim, 6.2, "right")
  hit(484, 0, 76, 19, function() openPage("glb") end)
end
local function arcPos(cx, cy, r, pos, col, w)
  arc(cx, cy, r, -135, 135, th.line, w)
  if pos > 0.004 then arc(cx, cy, r, -135, -135 + 270 * pos, col, w) end
end
-- a touch dial: tap = focus, drag up / down = change, wheel = steps
local drag = nil
local function dialHit(x, y, w, h, j)
  hit(x, y, w, h, function(px, py) fk = j; drag = {j = j, y = py, v = st.slots[cur].v[j] or 0} end)
end
local TW, TH = 54, 36
local function TX(i) return 42 + (i - 1) * 61 end
local function TY(r) return r == 1 and 50 or 104 end
local function rig()
  local r = st.route
  chip(8, 25, 70, 13, "ROUTE " .. N.ROUTES[r], false, nil, function() st.route = st.route % 3 + 1; changed(); flash("ROUTING  " .. N.ROUTES[st.route], 0.8) end, 5.4)
  T(({"A then B", "A and B side by side", "A from GUITAR, B from AUX"})[r], 86, 28.5, th.dim, 5.2)
  T("A " .. math.floor(st.mix.a * 100 + 0.5) .. "%  B " .. math.floor(st.mix.b * 100 + 0.5) .. "%", W - 8, 28.5, th.dim, 5.2, "right")
  local yA, yB = TY(1) + TH / 2, TY(2) + TH / 2
  local ym = (yA + yB) / 2
  local xs, xe = TX(1) - 8, TX(8) + TW + 8
  local pts
  if r == 1 then
    polyline({14, ym, 24, ym, 24, yA, xe, yA, xe, ym, xs, ym, xs, yB, xe, yB, xe, ym, W - 14, ym}, th.line, 2)
  elseif r == 2 then
    polyline({14, ym, 24, ym, 24, yA, xe, yA, xe, ym, W - 14, ym}, th.line, 2)
    polyline({24, ym, 24, yB, xe, yB, xe, ym}, th.line, 2)
  else
    polyline({14, yA, xe, yA, xe, ym, W - 14, ym}, th.line, 2)
    polyline({14, yB, xe, yB, xe, ym}, th.line, 2)
  end
  circle(W - 12, ym, 4.4, th.dim, 1.2)
  Tm("OUT", W - 12, ym + 11, th.dim, 4.6)
  if r == 3 then Tm("GTR", 14, yA - 8, th.dim, 4.6); Tm("AUX", 14, yB - 8, th.dim, 4.6)
  else circle(12, ym, 4.4, th.dim, 1.2); Tm("IN", 12, ym + 11, th.dim, 4.6) end
  for s = 1, 16 do
    local row, i = s <= 8 and 1 or 2, (s - 1) % 8 + 1
    local x, y = TX(i), TY(row)
    local sl, m, S = st.slots[s], N.model(st, s), SLOTS[s]
    if sl.on == 1 then fillRoundRect(x, y, TW, TH, 5, S.c) else fillRoundRect(x, y, TW, TH, 5, th.panel) end
    roundRect(x, y, TW, TH, 5, S.c, 1.2)
    Tm(cut(m.s, 9), x + TW / 2, y + 12, sl.on == 1 and th.ink or S.c, 6.4)
    Tm(S.s .. (sl.on == 1 and "" or " OFF"), x + TW / 2, y + 24, sl.on == 1 and th.ink or th.dim, 4.8)
    T(S.id, x + 3, y - 8, th.dim, 4.4)
    if s == cur then roundRect(x - 3, y - 3, TW + 6, TH + 6, 7, th.text, 1.6) end
    hit(x - 3, y - 3, TW + 6, TH + 6, function() if cur == s then page = "blk" else focus(s) end dirty = true end)
  end
  -- the focused block: 10 parameters (the dials)
  local y0 = 150
  local sl, m, S = st.slots[cur], N.model(st, cur), SLOTS[cur]
  fillRoundRect(6, y0, W - 12, H - y0 - 6, 7, th.panel)
  fillRect(6, y0, 4, H - y0 - 6, S.c)
  T(S.id .. "  " .. m.n:upper(), 16, y0 + 5, S.c, 6.6)
  chip(220, y0 + 3, 40, 12, sl.on == 1 and "ON" or "OFF", sl.on == 1, S.c, function() toggleSlot(cur) end, 5.4)
  chip(266, y0 + 3, 46, 12, "EDIT", false, nil, function() page = "blk"; dirty = true end, 5.4)
  T("DIALS 1-10", W - 14, y0 + 5, th.dim, 5.2, "right")
  local cw, ch = (W - 24) / 5, (H - y0 - 26) / 2
  for i = 1, 10 do
    local j = pp * 10 + i
    local k = m.k[j]
    local x, y = 12 + ((i - 1) % 5) * cw, y0 + 19 + math.floor((i - 1) / 5) * ch
    fillRoundRect(x + 1, y + 1, cw - 2, ch - 2, 4, th.panel2)
    Tm(tostring(i), x + 10, y + 9, th.dim, 5)
    if k then
      local pos = sl.v[j] or k.d
      if fk == j then roundRect(x + 1, y + 1, cw - 2, ch - 2, 4, S.c, 1) end
      T(cut(k.l, 12), x + 18, y + 5.5, fk == j and S.c or th.dim, 5.4)
      text(cut(N.fmt(k, pos), 9), x + 18, y + ch / 2 + 1, th.text, 8.6, "left", "condensed")
      arcPos(x + cw - 16, y + ch / 2 + 2, 8.5, pos, S.c, 2.4)
      dialHit(x, y, cw, ch, j)
    end
  end
end
local function blk()
  local sl, m, S = st.slots[cur], N.model(st, cur), SLOTS[cur]
  local np = math.max(1, math.ceil(#m.k / 10))
  fillRect(0, 20, W, 30, fade(S.c, 0.14))
  fillRect(0, 20, 5, 30, S.c)
  text(cut(m.n:upper(), 24), 12, 23, th.text, 11, "left", "condensed")
  T(S.id .. "  " .. S.t, 12, 40, S.c, 5.4)
  chip(250, 26, 40, 16, sl.on == 1 and "ON" or "OFF", sl.on == 1, S.c, function() toggleSlot(cur) end)
  chip(296, 26, 52, 16, "MODEL", false, nil, function() lcat = sl.m; page = "lib"; dirty = true end)
  chip(354, 26, 52, 16, "TO EXP 1", false, nil, function() st.exp[1] = "par:" .. cur .. ":" .. fk; changed(); flash("EXP 1  " .. S.id .. " " .. (m.k[fk] and m.k[fk].l or ""), 1) end, 5.2)
  chip(412, 26, 52, 16, "TO EXP 2", false, nil, function() st.exp[2] = "par:" .. cur .. ":" .. fk; changed(); flash("EXP 2  " .. S.id .. " " .. (m.k[fk] and m.k[fk].l or ""), 1) end, 5.2)
  chip(470, 26, 82, 16, "PAGE " .. (pp + 1) .. " / " .. np, false, nil, function() pp = (pp + 1) % np; syncKnobs(); dirty = true end, 5.4)
  local cw, ch = (W - 16) / 5, 96
  for i = 1, 10 do
    local j = pp * 10 + i
    local k = m.k[j]
    local x, y = 8 + ((i - 1) % 5) * cw, 54 + math.floor((i - 1) / 5) * ch
    fillRoundRect(x + 2, y + 2, cw - 4, ch - 4, 6, th.panel)
    if not k then Tm(tostring(i), x + cw / 2, y + ch / 2, th.line, 7)
    else
      local pos = sl.v[j] or k.d
      if fk == j then roundRect(x + 2, y + 2, cw - 4, ch - 4, 6, S.c, 1.4) end
      Tm(cut(k.l, 12), x + cw / 2, y + 12, fk == j and S.c or th.dim, 6.4)
      arcPos(x + cw / 2, y + 52, 22, pos, S.c, 5)
      local a = (-135 + 270 * pos) * math.pi / 180
      fillCircle(x + cw / 2 + math.sin(a) * 22, y + 52 - math.cos(a) * 22, 3, th.text)
      text(cut(N.fmt(k, pos), 9), x + cw / 2, y + 52, th.text, 10, "middle", "condensed")
      Tm(tostring(i), x + cw / 2, y + 84, th.dim, 5)
      dialHit(x, y, cw, ch, j)
    end
  end
end
local function lib()
  local S = SLOTS[cur]
  T("MODELS FOR " .. S.id .. "  " .. S.t, 8, 25, th.text, 6.4)
  T(#S.m .. " MODELS", W - 8, 25, th.dim, 5.2, "right")
  local cols, cw, chh = 3, (W - 16) / 3, 30
  for i, m in ipairs(S.m) do
    local c, r = (i - 1) % cols, math.floor((i - 1) / cols)
    local x, y = 8 + c * cw, 38 + r * (chh + 4)
    if y + chh <= H - 4 then
      local loaded = st.slots[cur].m == i
      fillRoundRect(x, y, cw - 4, chh, 5, loaded and S.c or th.panel)
      roundRect(x, y, cw - 4, chh, 5, lcat == i and th.text or S.c, lcat == i and 1.4 or 0.6)
      T(cut(m.n:upper(), 22), x + 7, y + 6, loaded and th.ink or th.text, 6.2)
      T(loaded and "LOADED" or S.s, x + 7, y + 18, loaded and th.ink or th.dim, 4.8)
      hit(x, y, cw - 4, chh, function() setModel(cur, i); page = "blk"; flash(S.id .. "  " .. m.n, 0.9) end)
    end
  end
end
local function scn()
  T("TAP A SCENE TO RECALL IT, ITS NAME TO RENAME IT", 8, 26, th.dim, 5.6)
  chip(W - 104, 23, 96, 14, "COPY TO NEXT SCENE", false, nil, function() keep(); local j = st.sc % 8 + 1; st.scenes[j] = copy(st.scenes[st.sc]); st.sc = j; changed(); flash("COPIED TO SCENE " .. j, 0.9) end, 5.2)
  local POOL = {"VERSE", "CHORUS", "LEAD", "CLEAN", "AMBIENT", "CRUNCH", "SOLO", "OUTRO", "INTRO", "BRIDGE", "RHYTHM", "BREAK", "BOOST"}
  for i = 1, 8 do
    local x, y = 6 + ((i - 1) % 4) * 137, 42 + math.floor((i - 1) / 4) * 102
    local active, col = st.sc == i, N.SCENE_COLS[i]
    fillRoundRect(x, y, 131, 96, 8, active and col or th.panel)
    roundRect(x, y, 131, 96, 8, psel == i and th.text or th.line, psel == i and 1.6 or 1)
    fillRect(x + 4, y, 123, 6, col)
    text(tostring(i), x + 12, y + 14, active and th.ink or th.text, 22, "left", "condensed")
    T(cut(st.scn[i] or "", 14), x + 12, y + 52, active and th.ink or col, 8)
    local ons = 0
    for s = 1, 16 do if st.scenes[i].on[s] == 1 then ons = ons + 1 end end
    T(active and "ACTIVE" or (ons .. " OF 16 BLOCKS ON"), x + 12, y + 74, active and th.ink or th.dim, 5.6)
    hit(x, y, 131, 96, function() psel = i; recall(i); changed(); syncKnobs() end)
    hit(x + 6, y + 48, 110, 20, function()
      local n = 1
      for k, p in ipairs(POOL) do if p == st.scn[i] then n = k end end
      st.scn[i] = POOL[n % #POOL + 1]; changed()
    end)
  end
end
local function pre()
  for i, b in ipairs(N.BANKS) do chip(8 + (i - 1) * 70, 23, 64, 15, "BANK " .. b, i - 1 == bank, nil, function() bank = i - 1; dirty = true end, 5.8) end
  chip(W - 186, 23, 86, 15, "SAVE HERE", false, th.acc, function() if savePreset(psel) then flash("SAVED  " .. N.presetLabel(psel, st.name), 1.4) else flash("MEMORY FULL") end end, 5.6)
  chip(W - 94, 23, 86, 15, "LOAD", true, nil, function() keep(); loadPreset(psel); changed(); syncKnobs(); flash(N.presetLabel(st.pi, st.name)) end, 5.6)
  for r = 1, N.PER_BANK do
    local pi = bank * N.PER_BANK + r
    local y = 44 + (r - 1) * 29
    local active, sel = st.pi == pi, psel == pi
    fillRoundRect(6, y, W - 12, 26, 5, active and th.acc or th.panel)
    roundRect(6, y, W - 12, 26, 5, sel and th.text or th.line, sel and 1.4 or 0.8)
    text(N.BANKS[bank + 1] .. r, 16, y + 7, active and th.ink or th.acc, 10, "left", "condensed")
    local nm = N.presetName(pi, user)
    T(nm or "EMPTY RIG", 46, y + 9, active and th.ink or (nm and th.text or th.dim), 7.2)
    T(active and "LOADED" or (user[pi] and "USER FILE" or (N.PRESETS[pi] and "FACTORY" or "")), W - 18, y + 10, active and th.ink or th.dim, 5.4, "right")
    hit(6, y, W - 12, 26, function()
      if psel == pi then keep(); loadPreset(pi); changed(); syncKnobs(); flash(N.presetLabel(st.pi, st.name)) end
      psel = pi; dirty = true
    end)
  end
  T(string.format("%d KB FREE IN THE PEDAL'S FILES", fs.free() // 1024), 8, H - 8, th.dim, 4.8)
end
local function tun()
  T("OUTPUT MUTED  ·  BACK OR HOLD TAP TO EXIT", 8, 26, th.acc, 5.6)
  chip(W - 128, 23, 120, 15, "REF " .. st.g.ref .. " Hz  ·  TAP +", false, nil, function() st.g.ref = st.g.ref >= 446 and 432 or st.g.ref + 1; changed() end, 5.2)
  local f = audio.pitch("GUITAR IN")
  local note, cents = "-", 0
  if f > 20 then
    local n = 12 * math.log(f / st.g.ref) / math.log(2) + 69
    local r = math.floor(n + 0.5)
    cents = (n - r) * 100
    note = ({"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"})[r % 12 + 1]
  end
  local ok = note ~= "-" and math.abs(cents) < 3
  text(note, W / 2, 92, note == "-" and th.dim or (ok and "#46d36f" or th.text), 64, "middle", "condensed")
  local pos = math.floor(clamp(cents / 50, -1, 1) * 12 + 0.5)
  for i = -12, 12 do
    local lit = note ~= "-" and (i == pos or (ok and i == 0))
    local hh = i == 0 and 30 or (i % 4 == 0 and 22 or 14)
    fillRoundRect(W / 2 + i * 18 - 2, (i == 0 and 150 or 154), 4, hh, 1.5, lit and (ok and "#46d36f" or (math.abs(i) > 6 and "#ff3b30" or th.acc)) or th.line)
  end
  Tm(note ~= "-" and (cents >= 0 and "+" or "") .. string.format("%.1f cents  ·  %.1f Hz", cents, f) or "PLAY A SINGLE NOTE", W / 2, 204, th.dim, 8)
end
local function asg()
  local function sec(y, t) T(t, 8, y, th.acc, 5.4) end
  local function cell(idx, x, y, cw)
    local it = ASG[idx]
    fillRoundRect(x, y, cw - 4, 24, 4, th.panel)
    roundRect(x, y, cw - 4, 24, 4, asel == idx and th.text or th.line, asel == idx and 1.4 or 0.8)
    T(it.name, x + 6, y + 3, th.dim, 4.8)
    T(cut(shortOf(it), math.floor((cw - 12) / 3.7)), x + 6, y + 12, th.text, 5.8)
    hit(x, y, cw - 4, 24, function()
      asel = idx; page = "asgl"
      local list, c = choices(it), current(it)
      gsel = 1
      for k, ch in ipairs(list) do if ch[2] == c then gsel = k end end
      lscr2 = clamp(gsel - 7, 0, math.max(0, #list - 28))
      dirty = true
    end)
  end
  sec(24, "FLOOR FOOTSWITCHES (STOMP MODE)")
  local c7 = (W - 12) / 7
  for i = 1, 14 do cell(i, 8 + ((i - 1) % 7) * c7, 32 + math.floor((i - 1) / 7) * 27, c7) end
  sec(92, "TREADLE SWITCHES AND EXT FOOTSWITCHES")
  local c6 = (W - 12) / 6
  for i = 15, 20 do cell(i, 8 + (i - 15) * c6, 100, c6) end
  sec(132, "EXPRESSION PEDALS")
  for i = 21, 24 do cell(i, 8 + (i - 21) * ((W - 12) / 4), 140, (W - 12) / 4) end
  sec(172, "SIDE SCREEN CONTROLS")
  for i = 25, 30 do cell(i, 8 + (i - 25) * c6, 180, c6) end
  sec(210, "CONTROL OUTPUTS")
  for i = 31, 32 do cell(i, 8 + (i - 31) * ((W - 12) / 2), 218, (W - 12) / 2) end
end
local function asgl()
  local it = ASG[asel]
  local list, c = choices(it), current(it)
  T("CHOOSE A FUNCTION FOR " .. it.name, 8, 25, th.text, 6.2)
  chip(W - 66, 22, 58, 14, "BACK", false, nil, function() page = "asg"; dirty = true end, 5.6)
  local rows, cw = 14, (W - 16) / 2
  for col = 0, 1 do for r = 1, rows do
    local idx = lscr2 + col * rows + r
    local ch = list[idx]
    if ch then
      local x, y = 8 + col * cw, 40 + (r - 1) * 14.6
      local on = ch[2] == c
      fillRoundRect(x, y, cw - 4, 13.4, 3, on and th.acc or th.panel)
      if gsel == idx then roundRect(x, y, cw - 4, 13.4, 3, th.text, 1) end
      T(cut(ch[1], 44), x + 7, y + 3.5, on and th.ink or th.text, 6)
      hit(x, y, cw - 4, 13.4, function() pick(it, ch[2]); flash(it.name .. "  " .. ch[1], 1) end)
    end
  end end
  if #list > 28 then T((lscr2 + 1) .. "-" .. math.min(#list, lscr2 + 28) .. " OF " .. #list .. "  ·  WHEEL", W - 10, H - 9, th.dim, 5, "right") end
end
local function io()
  T("INPUTS, PATHS AND OUTPUTS", 8, 24, th.acc, 5.6)
  for i, r in ipairs(IO) do
    local y = 34 + (i - 1) * 29
    fillRoundRect(6, y, 270, 25, 4, th.panel)
    roundRect(6, y, 270, 25, 4, isel == i and th.text or th.line, isel == i and 1.4 or 0.8)
    T(r[1], 12, y + 3, th.dim, 5)
    T(ioValue(r), 12, y + 12, th.text, 6.8)
    T("-     +", 266, y + 9, th.dim, 7, "right")
    hit(6, y, 270, 25, function(x) isel = i; ioStep(r, x < 240 and 1 or (x < 254 and -1 or 1)) end)
  end
  local x0 = 290
  T("OUTPUT ROUTING", x0, 24, th.acc, 5.6)
  local rows = {{"OUT 1 L/R", "MAIN, MASTER DIAL"}, {"OUT 2 L/R", "MAIN, MASTER DIAL"}, {"OUT 3 L/R", st.g.o3 == 0 and "PATH A" or "DRY DI"},
    {"OUT 4 L/R", st.g.o4 == 0 and "PATH B" or "DRY DI"}, {"PHONES", "MAIN, PHONES DIAL"}, {"XLR", "MAIN, XLR DIAL"},
    {"SEND / RETURN 1", "B8: MASTER LOOP, IN SERIES"}, {"SEND / RETURN 2", "A8: PRE AMP SEND, MIXED IN"}, {"SEND / RETURN 3+4", "B6, B7: AUX LOOPS, MIXED IN"}}
  for i, r in ipairs(rows) do
    local y = 34 + (i - 1) * 23
    fillRoundRect(x0, y, W - x0 - 6, 20, 4, th.panel)
    T(r[1], x0 + 6, y + 6, th.text, 6)
    T(r[2], W - 12, y + 6.5, th.dim, 5.4, "right")
  end
  chip(206, 21, 66, 11, "JACK GUIDE", false, nil, function() page = "jck"; dirty = true end, 4.8)
end
local JCOL = {i = "#2ee6d6", o = "#46d36f", l = "#ffb340", c = "#b58bff"}
local function jkind(k)
  if k == "gtr" or k == "aux" then return "i" end
  if k:sub(1, 1) == "x" and k ~= "xlr" then return "c" end
  if (k:sub(1, 1) == "s" or k:sub(1, 1) == "r") and tonumber(k:sub(2, 2)) then return "l" end
  return "o"
end
local function jck()
  local lv1 = N.readKV("nx/lv1.txt") or {}
  local lv2 = N.readKV("nx/lv2.txt") or {}
  -- two tabs of 14 jacks (the canvas is 480 px wide: one wide column keeps the text readable)
  local pg = jsel <= 14 and 1 or 2
  chip(8, 22, 112, 11, "INPUTS & OUTPUTS", pg == 1, nil, function() jsel = 1; dirty = true end, 5.2)
  chip(124, 22, 112, 11, "LOOPS & CONTROL", pg == 2, nil, function() jsel = 15; dirty = true end, 5.2)
  T("IDENTIFY BLINKS THE JACK'S LED FOR 3 S", W - 8, 25, th.dim, 5, "right")
  local active = idKey ~= "" and time() < idUntil
  local blinkOn = math.floor((idUntil - time()) / 0.125) % 2 == 0
  local x, cw, rh = 6, W - 12, 14.6
  for i = (pg - 1) * 14 + 1, math.min(#N.JACKS, pg * 14) do
    local j = N.JACKS[i]
    local y = 36 + ((i - 1) % 14) * rh
    local hh, k = rh - 1.6, j[1]
    local yc = y + hh / 2
    local on = active and idKey == k
    local col = JCOL[jkind(k)]
    fillRoundRect(x, y, cw, hh, 3, on and fade(th.acc, 0.22) or th.panel)
    roundRect(x, y, cw, hh, 3, on and th.acc or (jsel == i and th.text or th.line), (on or jsel == i) and 1.2 or 0.6)
    fillCircle(x + 6, yc, 2.3, col)
    T(j[2], x + 13, yc - 3.4, th.text, 5.8)
    T(cut(j[3], 32), x + 92, yc - 3, th.dim, 5.2)
    T(cut(jackRoute(k), 28), x + 250, yc - 3, on and th.text or th.acc, 5.2)
    local q = tonumber(lv1[k] or lv2[k] or "0") or 0
    fillRoundRect(x + 400, yc - 2.2, 50, 4.4, 1.6, fade("#000000", 0.5))
    if q > 0 then fillRoundRect(x + 400, yc - 2.2, math.min(50, q * 5), 4.4, 1.6, q > 10 and "#ff3b30" or col) end
    local bx, bw = x + 470, 72
    fillRoundRect(bx, y + 1.4, bw, hh - 2.8, 3, on and fade(th.acc, blinkOn and 1 or 0.35) or th.panel2)
    roundRect(bx, y + 1.4, bw, hh - 2.8, 3, on and th.acc or th.line, 0.7)
    Tm(on and "STOP" or "IDENTIFY", bx + bw / 2, yc, on and th.ink or th.text, 5.4)
    hit(x, y, bx - x - 2, hh, function() jsel = i; dirty = true end)
    hit(bx, y, bw, hh, function() identify(k) end)
  end
end
local PAGES = {rig = rig, blk = blk, lib = lib, scn = scn, pre = pre, tun = tun, asg = asg, asgl = asgl, io = io, jck = jck, glb = glb}

-- ---------------------------------------------------------------- pointer
on("touch", function(e)
  drag = nil
  local x, y = e.x / SC, e.y / SC
  for i = #hits, 1, -1 do
    local h = hits[i]
    if x >= h[1] and x <= h[1] + h[3] and y >= h[2] and y <= h[2] + h[4] then h[5](x, y) break end
  end
  dirty = true
end)
on("drag", function(e)
  local y = e.y / SC
  if drag and math.abs(y - drag.y) > 2 then setVal(cur, drag.j, drag.v - (y - drag.y) / 90); syncKnobs() end
end)
on("release", function(e) drag = nil end)
on("wheel", function(e)
  if page == "asgl" then
    local n = #choices(ASG[asel])
    lscr2 = clamp(lscr2 - e.d * 2, 0, math.max(0, n - 28)); dirty = true
    return
  end
  if (page == "blk" or page == "rig") and drag == nil then
    setVal(cur, fk, (st.slots[cur].v[fk] or 0) + e.d * 0.02); syncKnobs()
    return
  end
  nav(e.d > 0 and "up" or "down")
end)

-- ---------------------------------------------------------------- the circuit and the other screens
local lastOut, lastUi, outT = "", "", 0
local mine = {}
local function writeBus()
  local ex = {exp = {knob("EXP 1"), knob("EXP 2"), input(5), input(6)}, moved = moved, tuner = tuner, page = page}
  local v = N.compute(st, ex)
  local vals = {}
  for i, name in ipairs(N.OUTS) do vals[i] = v[name] end
  -- this screen sends its own slice (1 to 13) straight away, the others read nx/out.txt
  for i = 1, 13 do
    if mine[i] ~= vals[i] then mine[i] = vals[i]; output(i, vals[i]) end
  end
  local s = table.concat(vals, ",")
  if s ~= lastOut then lastOut = s; pcall(fs.write, "nx/out.txt", s) end
end
local function writeUi()
  local L = {"pl=" .. N.presetLabel(st.pi, st.name), "sc=" .. st.sc, "scn=" .. table.concat(st.scn, ","), "mode=" .. st.mode, "bpm=" .. st.g.bpm,
    "th=" .. st.g.theme, "strip=" .. st.g.strip1 .. "," .. st.g.strip2, "fsB=" .. st.g.fsB, "route=" .. st.route, "cur=" .. cur, "fk=" .. fk}
  for i = 1, 16 do
    local l, sub, c, lit = N.fsInfo(st, i, user, tuner)
    L[#L + 1] = "fs" .. i .. "=" .. l .. "|" .. sub .. "|" .. c .. "|" .. (lit and 1 or 0)
  end
  for i = 1, 4 do
    local t = N.expTarget(st, i)
    L[#L + 1] = "e" .. i .. "=" .. (t and t.name or "NOT ASSIGNED") .. "|" .. (N.expOn(st, i) and 1 or 0)
  end
  for s = 1, 16 do
    local m = N.model(st, s)
    L[#L + 1] = "sl" .. s .. "=" .. m.s .. "|" .. SLOTS[s].c .. "|" .. st.slots[s].on
  end
  local m = N.model(st, cur)
  local fkL = {}
  for j = 1, math.min(5, #m.k) do fkL[j] = m.k[j].l .. ":" .. N.fmt(m.k[j], st.slots[cur].v[j] or m.k[j].d) end
  L[#L + 1] = "foc=" .. SLOTS[cur].id .. "|" .. m.s .. "|" .. SLOTS[cur].c .. "|" .. table.concat(fkL, ";")
  for _, k in ipairs(N.SIDE) do
    local t = N.sideTarget(st, k, cur, fk)
    local pos, vt = 0, ""
    if t and t.mix then pos = st.mix[t.mix] / 2; vt = math.floor(st.mix[t.mix] * 100 + 0.5) .. "%"
    elseif t then local kk = N.model(st, t.s).k[t.k]; pos = st.slots[t.s].v[t.k] or kk.d; vt = N.fmt(kk, pos) end
    L[#L + 1] = "sd_" .. k .. "=" .. (t and t.name or "NONE") .. "|" .. pos .. "|" .. vt .. "|" .. (t and t.s or 0) .. "|" .. (t and t.k or 0)
  end
  local s = table.concat(L, "\\n")
  if s ~= lastUi then lastUi = s; pcall(fs.write, "nx/ui.txt", s) end
end

local lastExp = ""
function update(dt)
  commands()
  -- the pedals and the EXT FS OUT pulse change the circuit without touching the state
  local e = knob("EXP 1") .. "," .. knob("EXP 2") .. "," .. input(5) .. "," .. input(6)
  if e ~= lastExp then lastExp = e; outDirty = true end
  local g = st.g
  local beat = time() % (60 / g.bpm) < 0.07
  local led = tuner or (g.tapLed == 1 and beat)
  -- EXT FS OUT and EXT EXP OUT (outputs 15 and 16 of this screen are not in the bus)
  local xf = false
  if g.xfo == 1 then xf = time() < xfsDown elseif g.xfo == 2 then xf = beat elseif g.xfo == 3 then xf = tuner
  elseif g.xfo == 4 then xf = st.sc > 1 else xf = N.expOn(st, g.xfo - 4) end
  output("LED TAP", led)
  output("FS out", xf)
  local xe = ({knob("EXP 1"), knob("EXP 2")})[g.xeo]
  if g.xeo == 7 then xe = knob("MASTER") end
  if not xe then
    local t = N.sideTarget(st, ({"x", "y", "s1", "s2"})[g.xeo - 2], cur, fk)
    xe = 0
    if t and t.mix then xe = st.mix[t.mix] / 2 elseif t then xe = st.slots[t.s].v[t.k] or 0 end
  end
  output("EXP out", N.r3(xe))
  if outDirty and time() >= outT then outT = time() + 0.05; outDirty = false; writeBus(); writeUi() end
  if idKey ~= "" and time() >= idUntil then idKey = ""; dirty = true end
  writeId()
end

local saveT = 0
function draw(dt)
  if page == "tun" or tuner then dirty = true end
  if page == "jck" then
    local _, c1 = N.readKV("nx/lv1.txt")
    local _, c2 = N.readKV("nx/lv2.txt")
    if c1 or c2 or idKey ~= "" then dirty = true end
  end
  if time() < msgT + 0.05 and time() > msgT - 0.05 then dirty = true end
  if not dirty then return end
  dirty = false
  th = THEMES[st.g.theme] or THEMES[1]
  hits = {}
  clear(th.bg)
  push()
  scale(SC)
  header()
  local f = PAGES[page] or rig
  f()
  if time() < msgT then
    fillRoundRect(W / 2 - 120, H / 2 - 14, 240, 28, 8, fade("#000000", 0.85))
    roundRect(W / 2 - 120, H / 2 - 14, 240, 28, 8, th.acc, 1.2)
    Tm(cut(msg, 40), W / 2, H / 2, "#ffffff", 9)
  end
  if not pedalOn() then T("BYPASS", W - 8, H - 12, th.acc, 5.4, "right") end
  pop()
  if time() > saveT then saveT = time() + 0.5; save("nx", st) end
end
function setup() syncKnobs(); writeBus(); writeUi() end
`;

// ------------------------------------------------------------------ a screen that sends a slice of the circuit values
const busSlice = (base) => `local BASE = ${base}
local lastBus, sent = "", {}
local function sendSlice()
  local s = fs.read("nx/out.txt")
  if not s or s == lastBus then return end
  lastBus = s
  local v = s:split(",")
  for i = 1, 16 do
    local x = tonumber(v[BASE + i])
    if x and sent[i] ~= x then sent[i] = x; output(i, x) end
  end
end
`;

// ------------------------------------------------------------------ SIDE (138 x 306, portrait)
export const SIDE_SCRIPT = `-- Nautica XL side screen: HOME, BACK, SAVE, UP, DOWN, two LED-ring encoders, an XY pad,
-- two sliders and the select encoder (turn = up / down, push = enter). They edit what
-- ASSIGN gives them (the focused block when AUTO). It also sends circuit values 14 to 29.
local N = require("nx")
local clamp, cut = N.clamp, N.cut
` + busSlice(13) + `
local ui = {}
local dirty = true
local local_ = {} -- values while dragging (shown before MAIN has them)
local drag = nil
local encA = 0
local function sd(k)
  local p = N.parts(ui["sd_" .. k])
  return {name = p[1] or "NONE", pos = local_[k] or tonumber(p[2]) or 0, txt = p[3] or "", s = tonumber(p[4]) or 0, k = tonumber(p[5]) or 0}
end
local function setSide(k, pos)
  local t = sd(k)
  pos = N.r3(clamp(pos, 0, 1))
  local_[k] = pos
  if t.name == "PATH A LEVEL" then N.cmd("mix a " .. pos)
  elseif t.name == "PATH B LEVEL" then N.cmd("mix b " .. pos)
  elseif t.s > 0 then N.cmd("set " .. t.s .. " " .. t.k .. " " .. pos) end
  dirty = true
end
local B = {{"HOME", 4, 4, 41, 20, "home"}, {"BACK", 48.5, 4, 41, 20, "back"}, {"SAVE", 93, 4, 41, 20, "save"}, {"UP", 4, 27, 63, 18, "up"}, {"DOWN", 71, 27, 63, 18, "down"}}
local ENC = {{"e1", 36, 78}, {"e2", 102, 78}}
local PX, PY, PW, PH = 6, 128, 126, 80
local SL = {{"s1", 14}, {"s2", 44}}
local SY, SH = 218, 64
local EX, EY = 100, 248
local function inside2(x, y, bx, by, bw, bh) return x >= bx and x <= bx + bw and y >= by and y <= by + bh end
on("touch", function(e)
  drag = nil
  for _, b in ipairs(B) do if inside2(e.x, e.y, b[2], b[3], b[4], b[5]) then N.cmd("nav " .. b[6]); dirty = true return end end
  for _, c in ipairs(ENC) do if inside2(e.x, e.y, c[2] - 28, c[3] - 28, 56, 56) then drag = {k = c[1], y = e.y, v = sd(c[1]).pos} return end end
  if inside2(e.x, e.y, PX, PY, PW, PH) then drag = {xy = true}; setSide("x", (e.x - PX - 4) / (PW - 8)); setSide("y", (PY + PH - 4 - e.y) / (PH - 8)) return end
  for _, s in ipairs(SL) do if inside2(e.x, e.y, s[2] - 13, SY - 6, 26, SH + 12) then drag = {sl = s[1]}; setSide(s[1], (SY + SH - e.y) / SH) return end end
  if inside2(e.x, e.y, EX - 28, EY - 28, 56, 56) then drag = {enc = true, y = e.y, acc = 0, moved = false} end
end)
on("drag", function(e)
  if not drag then return end
  if drag.k then setSide(drag.k, drag.v - (e.y - drag.y) / 80)
  elseif drag.xy then setSide("x", (e.x - PX - 4) / (PW - 8)); setSide("y", (PY + PH - 4 - e.y) / (PH - 8))
  elseif drag.sl then setSide(drag.sl, (SY + SH - e.y) / SH)
  elseif drag.enc then
    local d = e.y - drag.y - drag.acc
    if math.abs(d) >= 14 then
      local dir = d > 0 and 1 or -1
      drag.acc = drag.acc + dir * 14; drag.moved = true
      encA = encA + dir
      N.cmd(dir > 0 and "nav down" or "nav up")
      dirty = true
    end
  end
end)
on("release", function(e)
  if drag and drag.enc and not drag.moved then N.cmd("nav enter") end
  drag = nil
end)
on("wheel", function(e)
  for _, c in ipairs(ENC) do if inside2(e.x, e.y, c[2] - 28, c[3] - 28, 56, 56) then setSide(c[1], sd(c[1]).pos + e.d * 0.02) return end end
  for _, s in ipairs(SL) do if inside2(e.x, e.y, s[2] - 13, SY - 6, 26, SH + 12) then setSide(s[1], sd(s[1]).pos + e.d * 0.02) return end end
  encA = encA - e.d
  N.cmd(e.d > 0 and "nav up" or "nav down")
  dirty = true
end)
local ACC = "#2ee6d6"
local function short(n) local p = n:split(" ") if #p >= 2 and #p[1] == 2 then return n:sub(4) end return n end
function draw()
  sendSlice()
  local t, ch = N.readKV("nx/ui.txt")
  if t and ch then ui = t; local_ = {}; dirty = true end
  if not dirty then return end
  dirty = false
  clear("#05080c")
  for _, b in ipairs(B) do
    local col = b[6] == "home" and ACC or (b[6] == "save" and "#ff8a3d" or "#24364a")
    fillRoundRect(b[2], b[3], b[4], b[5], 4, "#111a24")
    roundRect(b[2], b[3], b[4], b[5], 4, col, 0.8)
    text(b[1], b[2] + b[4] / 2, b[3] + b[5] / 2, b[6] == "home" and ACC or (b[6] == "save" and "#ff8a3d" or "#d6e2ec"), 5.8, "middle", "sans")
  end
  for _, c in ipairs(ENC) do
    local k, cx, cy = c[1], c[2], c[3]
    local s = sd(k)
    fillCircle(cx, cy, 18, "#0b1118")
    for i = 0, 14 do
      local a = (-135 + 270 * i / 14) * math.pi / 180
      fillCircle(cx + math.sin(a) * 24, cy - math.cos(a) * 24, 1.8, (s.name ~= "NONE" and i <= math.floor(s.pos * 14 + 0.5)) and ACC or fade(ACC, 0.12))
    end
    fillCircle(cx, cy, 13, "#1a2430")
    local a = (-135 + 270 * s.pos) * math.pi / 180
    line(cx + math.sin(a) * 6, cy - math.cos(a) * 6, cx + math.sin(a) * 11.5, cy - math.cos(a) * 11.5, "#e8f1f8", 1.6)
    text(cut(s.txt, 7), cx, cy + 0.5, "#e8f1f8", 5, "middle", "sans")
    text(k == "e1" and "ENC 1" or "ENC 2", cx, cy + 33, "#5e7183", 4.6, "middle", "sans")
    text(cut(short(s.name), 13), cx, cy + 40, "#c8d4de", 4.8, "middle", "sans")
  end
  fillRoundRect(PX, PY, PW, PH, 5, "#0b1118")
  roundRect(PX, PY, PW, PH, 5, "#1d2a36", 1)
  for i = 1, 3 do
    fillRect(PX + PW * i / 4, PY + 2, 0.5, PH - 4, "#16222e")
    fillRect(PX + 2, PY + PH * i / 4, PW - 4, 0.5, "#16222e")
  end
  local sx, sy = sd("x"), sd("y")
  text("X " .. cut(short(sx.name), 15), PX + 4, PY + 3, "#5e7183", 4.4, "left", "sans")
  text("Y " .. cut(short(sy.name), 15), PX + PW - 4, PY + PH - 9, "#5e7183", 4.4, "right", "sans")
  local x = PX + 4 + sx.pos * (PW - 8)
  local y = PY + PH - 4 - sy.pos * (PH - 8)
  fillRect(x, PY, 0.8, PH, fade(ACC, 0.5))
  fillRect(PX, y, PW, 0.8, fade(ACC, 0.5))
  fillCircle(x, y, 4.5, ACC)
  circle(x, y, 4.5, "#ffffff", 1)
  for _, s in ipairs(SL) do
    local k, xx = s[1], s[2]
    local v = sd(k)
    fillRoundRect(xx - 2, SY, 4, SH, 2, "#0b1118")
    fillRoundRect(xx - 2, SY + SH - v.pos * SH, 4, v.pos * SH, 2, ACC)
    fillRoundRect(xx - 9, SY + SH - 3.5 - v.pos * SH, 18, 7, 2, "#c8d4de")
    text(k == "s1" and "S1" or "S2", xx, SY + SH + 8, "#5e7183", 4.6, "middle", "sans")
    text(cut(short(v.name):gsub("PATH ", ""), 7), xx, SY + SH + 15, "#c8d4de", 4.2, "middle", "sans")
  end
  fillCircle(EX, EY, 26, "#0b1118")
  for i = 0, 23 do
    local a = i * 15 * math.pi / 180
    line(EX + math.sin(a) * 19, EY - math.cos(a) * 19, EX + math.sin(a) * 23, EY - math.cos(a) * 23, "#2b3b4c", 1.4)
  end
  fillCircle(EX, EY, 16, "#1a2430")
  local a = encA * 15 * math.pi / 180
  line(EX + math.sin(a) * 7, EY - math.cos(a) * 7, EX + math.sin(a) * 13, EY - math.cos(a) * 13, ACC, 2)
  text("PUSH", EX, EY + 0.5, "#c8d4de", 4.6, "middle", "sans")
  text("SELECT", EX, EY + 33, "#5e7183", 4.6, "middle", "sans")
end
`;

// ------------------------------------------------------------------ the two strips (560 x 22)
export const stripScript = (row) => `-- Nautica XL strip ${row}: preset and scene, levels, the focused block, tempo and tuner,
-- the pedals or the signal path. The button at the right end picks what it shows.
-- It also sends circuit values ${29 + (row - 1) * 16 + 1} to ${29 + row * 16}.
local N = require("nx")
local cut = N.cut
local ROW = ${row}
local SC = W / 560
local W, H = 560, 22
` + busSlice(29 + (row - 1) * 16) + `
local ui, dirty, menu = {}, true, false
local hits = {}
local lv = {}
on("touch", function(e)
  local x, y = e.x / SC, e.y / SC
  for i = #hits, 1, -1 do
    local h = hits[i]
    if x >= h[1] and x <= h[1] + h[3] and y >= h[2] and y <= h[2] + h[4] then h[5]() break end
  end
  dirty = true
end)
local function hit(x, y, w, h, f) hits[#hits + 1] = {x, y, w, h, f} end
local D, C = "#5e7183", "#c8d4de"
local function lab(s, x, col) text(s, x, H / 2, col or D, 5.2, "left", "sans") end
function draw()
  sendSlice()
  local t, ch = N.readKV("nx/ui.txt")
  if t and ch then ui = t; dirty = true end
  local kind = tonumber((ui.strip or "1,2"):split(",")[ROW]) or ROW
  -- live contents: levels, tempo and tuner, pedals
  if kind == 2 then
    local k = {}
    for i = 1, 6 do k[i] = math.floor(N.lvl(input(i)) * 12 + 0.5) end
    local s = table.concat(k, ",")
    if s ~= lv.s then lv.s = s; dirty = true end
  elseif kind == 4 then
    local f = audio.pitch("GUITAR IN")
    local s = (time() % (60 / (tonumber(ui.bpm) or 120)) < 0.07 and 1 or 0) .. "," .. math.floor(f)
    if s ~= lv.s then lv.s = s; dirty = true end
  elseif kind == 5 then
    local s = math.floor(knob("EXP 1") * 40) .. "," .. math.floor(knob("EXP 2") * 40)
    if s ~= lv.s then lv.s = s; dirty = true end
  end
  if not dirty then return end
  dirty = false
  hits = {}
  clear("#03060a")
  push()
  scale(SC)
  stripDraw(kind)
  pop()
end
function stripDraw(kind)
  fillRoundRect(W - 22, 3, 18, H - 6, 3, menu and "#2ee6d6" or "#0d141c")
  for i = 0, 2 do fillRect(W - 17, 7.5 + i * 3, 8, 1.2, menu and "#05090d" or "#7790a3") end
  hit(W - 24, 0, 24, H, function() menu = not menu end)
  if menu then
    local cw = (W - 30) / #N.STRIPS
    for i, l in ipairs(N.STRIPS) do
      local on = i == kind
      fillRoundRect(3 + (i - 1) * cw, 3, cw - 4, H - 6, 3, on and "#2ee6d6" or "#0d141c")
      text(l, 3 + (i - 1) * cw + (cw - 4) / 2, H / 2, on and "#05090d" or C, 5.4, "middle", "sans")
      hit(3 + (i - 1) * cw, 0, cw - 4, H, function() N.cmd("strip " .. ROW .. " " .. i); menu = false end)
    end
    return
  end
  local Wd = W - 28
  if kind == 1 then
    text(cut(ui.pl or "", 28), 8, 5, "#f2f6fa", 10, "left", "condensed")
    local sc = tonumber(ui.sc) or 1
    for i = 1, 8 do
      local x = 230 + (i - 1) * 30
      local col = N.SCENE_COLS[i]
      fillRoundRect(x, 4, 27, H - 8, 3, i == sc and col or "#0d141c")
      roundRect(x, 4, 27, H - 8, 3, col, 0.6)
      text(tostring(i), x + 13.5, H / 2, i == sc and "#05090d" or col, 6.4, "middle", "sans")
      hit(x, 0, 27, H, function() N.cmd("scene " .. i) end)
    end
    local m = tonumber(ui.mode) or 1
    text(N.MODES[m] .. " MODE", Wd - 4, H / 2 - 3, N.MODE_COL[m], 5.4, "right", "sans")
  elseif kind == 2 then
    local items = {"GTR", "AUX", "MAIN", "PATH A", "PATH B", "SEND 1"}
    local iw = Wd / #items
    for i, l in ipairs(items) do
      local x = 4 + (i - 1) * iw
      text(l, x, H / 2 - 2.5, D, 4.8, "left", "sans")
      local lit = math.floor(N.lvl(input(i)) * 12 + 0.5)
      local bx, bw = x + 30, iw - 36
      for k = 1, 12 do
        local col = k > 10 and "#ff4d5e" or (k > 8 and "#ffc24b" or "#37d6c2")
        fillRect(bx + (k - 1) * bw / 12, 6, bw / 12 - 1, H - 12, k <= lit and col or fade(col, 0.12))
      end
    end
  elseif kind == 3 then
    local p = N.parts(ui.foc)
    local col = p[3] or C
    fillRect(3, 3, 4, H - 6, col)
    text((p[1] or "") .. " " .. cut(p[2] or "", 9), 12, H / 2 - 3.3, col, 6.6, "left", "sans")
    local ks = (p[4] or ""):split(";")
    local pw = (Wd - 90) / 5
    for i = 1, 5 do
      local kv = (ks[i] or ""):split(":")
      if kv[2] then
        local x = 90 + (i - 1) * pw
        text(cut(kv[1], 9), x, H / 2 - 2.5, D, 4.8, "left", "sans")
        text(cut(kv[2], 8), x + pw - 6, H / 2 - 3, C, 6.2, "right", "mono")
      end
    end
  elseif kind == 4 then
    local bpm = tonumber(ui.bpm) or 120
    text(math.floor(bpm + 0.5) .. " BPM", 8, 5, "#f2f6fa", 10, "left", "condensed")
    fillCircle(80, H / 2, 4, time() % (60 / bpm) < 0.07 and "#ff3b5c" or fade("#ff3b5c", 0.15))
    text("TAP HERE", 96, H / 2 - 2.5, D, 4.8, "left", "sans")
    hit(0, 0, 180, H, function() N.cmd("tap") end)
    local f = audio.pitch("GUITAR IN")
    local note, c = "-", 0
    if f > 20 then
      local n = 12 * math.log(f / 440) / math.log(2) + 69
      local r = math.floor(n + 0.5)
      c = (n - r) * 100
      note = ({"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"})[r % 12 + 1]
    end
    text("NOTE " .. note, 260, H / 2 - 3, C, 7, "left", "sans")
    roundRect(330, 8, 180, H - 16, 2, "#1d2a36", 0.8)
    fillRect(419.5, 5, 1, H - 10, D)
    local x = math.max(-1, math.min(1, c / 50))
    if note ~= "-" then fillRect(x < 0 and 420 + x * 90 or 420, 8, math.abs(x) * 90 + 1.5, H - 16, math.abs(c) < 3 and "#46d36f" or "#ff8a3d") end
  elseif kind == 5 then
    local iw = Wd / 2
    for i = 1, 2 do
      local x = 4 + (i - 1) * iw
      local p = N.parts(ui["e" .. i])
      text(N.EXP_NAMES[i], x, H / 2 - 2.5, D, 4.8, "left", "sans")
      text(cut(p[1] or "", 18), x + 34, H / 2 - 3, C, 5.4, "left", "sans")
      fillRoundRect(x + iw - 80, 7, 70, H - 14, 2, "#0d141c")
      fillRoundRect(x + iw - 80, 7, 70 * knob("EXP " .. i), H - 14, 2, fade("#2ee6d6", p[2] == "1" and 1 or 0.35))
    end
  else
    text(N.ROUTES[tonumber(ui.route) or 1], 8, H / 2 - 3, C, 5.2, "left", "sans")
    local cw = (Wd - 70) / 16
    for s = 1, 16 do
      local p = N.parts(ui["sl" .. s])
      local x = 70 + (s - 1) * cw
      local on = p[3] == "1"
      fillRoundRect(x, 4, cw - 3, H - 8, 2, p[2] and fade(p[2], on and 1 or 0.3) or "#0d141c")
      text(N.SLOTS[s].id, x + (cw - 3) / 2, H / 2, on and "#05090d" or C, 4.6, "middle", "sans")
      if tostring(s) == ui.cur then roundRect(x, 4, cw - 3, H - 8, 2, "#ffffff", 0.8) end
      hit(x, 0, cw, H, function() N.cmd("focus " .. s) end)
    end
  end
end
`;

// ------------------------------------------------------------------ footswitch LCDs (84 x 22) and pedal LCDs (116 x 24)
export const fsLcdScript = (i) => `-- Nautica XL: the display over footswitch ${i <= 14 ? i : 'EXP ' + (i - 14) + ' SW'}. MAIN tells it what the switch does (nx/ui.txt).
local N = require("nx")
local I = ${i}
local last = ""
function draw()
  if not every(120) and last ~= "" then return end
  local t = N.readKV("nx/ui.txt")
  local s = t and t["fs" .. I] or "||#2a2f38|0"
  local key = s .. (t and t.fsB or "2")
  if key == last then return end
  last = key
  local p = N.parts(s)
  local lit = p[4] == "1"
  local col = p[3] or "#2a2f38"
  local k = ({0.45, 0.75, 1})[tonumber(t and t.fsB or "2") or 2] or 0.75
  clear(lit and "#0f1a22" or "#05070a")
  fillRect(0, 0, 3.5, H, fade(col, lit and k or 0.25))
  text(I <= 14 and ("FS " .. I) or "SW", 7, 2, "#6b7686", 4.6, "left", "sans")
  text(N.cut(p[2] or "", 12), W - 4, 2, "#6b7686", 4.4, "right", "sans")
  text(N.cut(p[1] or "", 12), W / 2 + 1.5, 15, fade(lit and col or "#8f99a8", lit and k or k * 0.8), 7.4, "middle", "sans")
end
`;
export const expLcdScript = (i) => `-- Nautica XL: the display of treadle EXP ${i}: what it moves and where it is.
local N = require("nx")
local I = ${i}
local last = ""
function draw()
  local v = knob("EXP " .. I)
  local t = N.readKV("nx/ui.txt")
  local s = t and t["e" .. I] or "NOT ASSIGNED|1"
  local key = s .. math.floor(v * 100 + 0.5)
  if key == last then return end
  last = key
  local p = N.parts(s)
  local on = p[2] == "1"
  clear("#05070a")
  text(N.EXP_NAMES[I] .. (on and "" or "  OFF"), 5, 2.5, "#6b7686", 4.8, "left", "sans")
  text(N.cut(p[1] or "", 16), W - 5, 2.5, "#9fb0c0", 4.8, "right", "sans")
  fillRoundRect(5, 13, W - 40, 6.5, 2, "#121820")
  fillRoundRect(5, 13, (W - 40) * v, 6.5, 2, fade("#2ee6d6", on and 1 or 0.3))
  text(math.floor(v * 100 + 0.5) .. "%", W - 5, 12.5, "#e8f1f8", 6.4, "right", "mono")
end
`;

// ------------------------------------------------------------------ I/O bar LEDs (two halves of the rear rail)
// bars: [{x, input, col, n}] in screen pixels; input = the screen input number (levels 0..1 from envelope followers)
export const ioScript = (base, bars, lw, half = 1) => `-- Nautica XL: the bar LEDs under the jacks. Brightness follows the level at each jack
-- (envelope followers in the circuit, or the value of a control jack). Sends values ${base + 1} to ${base + 16}.
local N = require("nx")
local SC = W / ${lw.toFixed(1)}
local W, H = ${lw.toFixed(1)}, 9
local BARS = {${bars.map((b) => `{${b.x.toFixed(1)}, ${b.input}, "${b.col}", ${b.n}, "${b.key}"}`).join(', ')}}
local LVF = "nx/lv${half}.txt"
` + busSlice(base) + `
local last = ""
-- IDENTIFY (MAIN's jack guide): nx/id.txt = seq,key,guide open
local lastId, idSeq, idKey, idT, idPg, lastLv = nil, nil, "", -1, false, ""
local function idPoll()
  local s = fs.read("nx/id.txt") or ""
  if s == lastId then return end
  lastId = s
  local p = s:split(",")
  idPg = p[3] == "1"
  if not idPg then lastLv = "" end
  local k = p[2] or ""
  if p[1] ~= idSeq or k ~= idKey then idSeq = p[1]; idKey = k; idT = time() + 3 end
end
function draw()
  sendSlice()
  idPoll()
  local q, lv = {}, {}
  local blink = idKey ~= "" and time() < idT
  for i, b in ipairs(BARS) do
    local v = b[2] > 0 and input(b[2]) or 0
    if b[3] == "#b58bff" then lv[i] = math.floor(math.min(1, v) * 10 + 0.5) -- a control jack: its value, never clipping
    else lv[i] = v >= 0.98 and 11 or math.floor(N.lvl(v) * 10 + 0.5) end
    q[i] = lv[i]
    if blink and b[5] == idKey then q[i] = math.floor((idT - time()) / 0.125) % 2 == 0 and 20 or 21 end
  end
  if idPg then
    local L = {}
    for i, b in ipairs(BARS) do L[i] = b[5] .. "=" .. lv[i] end
    local s = table.concat(L, "\\n")
    if s ~= lastLv then lastLv = s; pcall(fs.write, LVF, s) end
  end
  local key = table.concat(q, ",")
  if key == last then return end
  last = key
  clear("#0b0d10")
  push()
  scale(SC)
  for i, b in ipairs(BARS) do
    local lv = math.min(q[i], 11) / 10
    local bw = b[4] > 1 and 6 or 12
    local c = fade(lv > 1 and "#ff3b30" or b[3], 0.1 + 0.9 * math.min(1, lv) ^ 1.4)
    if q[i] == 20 then c = "#ffffff" elseif q[i] == 21 then c = fade("#ffffff", 0.03) end
    for k = 0, b[4] - 1 do
      local x = b[1] - (b[4] * bw + (b[4] - 1) * 1.5) / 2 + k * (bw + 1.5)
      fillRoundRect(x - 0.5, 1, bw + 1, H - 2, 1.5, fade("#000000", 0.6))
      fillRoundRect(x, 1.5, bw, H - 3, 1.2, c)
    end
  end
  pop()
end
`;
