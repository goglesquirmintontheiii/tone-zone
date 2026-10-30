// Screen scripts for the Atlas Floor template (factory-showcase-floor.js): the main screen and the two scribble
// strips over the footswitch rows. Plain screen script code (docs/screen-scripts.md).

// the names both scripts share (the strips draw from the main screen's Strip and Models outputs)
const SHARED = `local CATS = {
  {short = "DYN", name = "DYNAMICS", col = "#ffd23f"},
  {short = "DRIVE", name = "DRIVE", col = "#ff8a3d"},
  {short = "AMP", name = "AMP", col = "#ff4b4b"},
  {short = "MOD", name = "MODULATION", col = "#3fb6ff"},
  {short = "DELAY", name = "DELAY", col = "#46d36f"},
  {short = "REVERB", name = "REVERB", col = "#a98bff"},
}
local SHORTS = {
  {"VCA COMP", "SQUEEZE", "OPTO"},
  {"LIFT", "TREBLE", "JADE OD", "GILDED", "BLUE OD", "RODENT", "FLUFF", "GRID"},
  {"LUX", "SILVER", "CHIME 30", "BRIT 68", "BRIT 800", "CALI DR", "PANAMA", "SOLID120"},
  {"CHORUS", "VIBRATO", "ENSEMBLE", "DIMENS"},
  {"DIGITAL", "ANALOG", "TAPE", "LO-FI", "MOD DLY", "REVERSE", "SHIM DLY", "PINGPONG"},
  {"ROOM", "HALL", "PLATE", "SPRING", "SHIMMER", "CLOUD", "MODVERB", "SWELL"},
}
local PRESET_NAMES = {"BRIT CRUNCH", "GLASS CLEAN", "CALI LEAD", "DUAL AMP WALL", "AMBIENT SWELL", "FUZZ CAVE",
  "TEXAS BLUES", "PANAMA CHUG", "OCTO RIPPLE", "HARMONY TWIN", "ROTOR ORGAN", "LOFI DREAMS"}
local BANKS = {"A", "B", "C"}
local MODES = {"STOMP", "SCENE", "PRESET"}
local SCENE_NAMES = {"RHYTHM", "LEAD", "CLEAN", "AMBIENT", "CRUNCH", "SOLO", "VERSE", "CHORUS"}
local SCENE_COLS = {"#ff8a3d", "#ff4b4b", "#3fb6ff", "#a98bff", "#ffd23f", "#46d36f", "#45e0c8", "#ff5fb0"}

-- what footswitch i (1 to 10) does in this mode: label, colour, lit
local function fsInfo(mode, i, sc, pi, ons, models)
  if mode == 1 then
    if i > 6 then return "", "#2a2e36", false end
    return SHORTS[i][models[i]] or "", CATS[i].col, ons[i]
  elseif mode == 2 then
    if i <= 8 then return SCENE_NAMES[i], SCENE_COLS[i], sc == i end
    return i == 9 and "PRESET DOWN" or "PRESET UP", "#e8ecf3", false
  end
  if i <= 4 then
    local p = math.floor((pi - 1) / 4) * 4 + i
    return PRESET_NAMES[p] or "-", "#ffffff", pi == p
  end
  if i == 5 then return "BANK UP", "#e8ecf3", false end
  if i == 10 then return "BANK DOWN", "#e8ecf3", false end
  return SCENE_NAMES[i - 5], SCENE_COLS[i - 5], sc == i - 5
end
`;

// ------------------------------------------------------------------ the main screen (330 x 160)
export const ATLAS_SCRIPT = `-- Atlas Floor: a floor modeler with six blocks (dynamics, drive, amp,
-- modulation, delay, reverb), each with its models, 12 presets with 8 scenes,
-- and three footswitch modes. The arrows move the cursor, ENTER opens the model
-- browser, knobs 1 to 6 edit the block under the cursor (PAGE for more).
-- The screen drives the circuit through its outputs (on / off, gain, delay and
-- reverb) and tells the two scribble strips what the footswitches do.
` + SHARED + `
-- parameters: label, min, max, default, format (pct, ms, db, int), log
local PARAMS = {
  {{"THRESH", 0, 1, 0.45}, {"RATIO", 0, 1, 0.5}, {"ATTACK", 0, 1, 0.3}, {"RELEASE", 0, 1, 0.4}, {"LEVEL", 0, 1, 0.5}, {"MIX", 0, 1, 1}},
  {{"GAIN", 0, 1, 0.45}, {"TONE", 0, 1, 0.5}, {"LEVEL", 0, 1, 0.62}, {"MIX", 0, 1, 1}, {"BASS", 0, 1, 0.5}, {"TREBLE", 0, 1, 0.5}},
  {{"GAIN", 0, 1, 0.5}, {"BASS", 0, 1, 0.5}, {"MID", 0, 1, 0.5}, {"TREBLE", 0, 1, 0.5}, {"PRES", 0, 1, 0.5}, {"MASTER", 0, 1, 0.5},
   {"DEPTH", 0, 1, 0.5}, {"SAG", 0, 1, 0.5}, {"BRIGHT", 0, 1, 0}, {"CH VOL", -18, 12, 0, "db"}},
  {{"RATE", 0, 1, 0.3}, {"DEPTH", 0, 1, 0.5}, {"MIX", 0, 1, 0.5}, {"TONE", 0, 1, 0.5}, {"FEEDBACK", 0, 1, 0}, {"LEVEL", 0, 1, 0.5}},
  {{"TIME", 40, 2000, 420, "ms", true}, {"FEEDBACK", 0, 1, 0.32}, {"MIX", 0, 1, 0.25}, {"TONE", 0, 1, 0.6}, {"MOD DEPTH", 0, 1, 0.15}, {"MOD RATE", 0, 1, 0.3},
   {"AGE", 0, 1, 0.3}, {"SATURATE", 0, 1, 0.3}, {"SPREAD", 0, 1, 0.5}, {"SUBDIV", 0, 4, 0, "sub"}},
  {{"DECAY", 0, 1, 0.5}, {"MIX", 0, 1, 0.25}, {"TONE", 0, 1, 0.6}, {"PREDELAY", 0, 250, 20, "ms"}, {"MOD", 0, 1, 0.3}, {"SIZE", 0, 1, 0.5}},
}
local NAMES = {
  {"Studio VCA Comp", "Orange Squeeze", "Opto Leveler"},
  {"Clean Lift", "Treble Spike", "Jade Screamer", "Gilded Horse", "Blue Note OD", "Rodent Dist", "Big Fluff", "Metal Grid"},
  {"Tweed Lux", "Silver Twin", "Chime 30", "Brit 68 Plexi", "Brit 800", "Cali Dual Rect", "Panama 51", "Solid 120 Clean"},
  {"Classic Chorus", "Pitch Vibrato", "Tri Ensemble", "Dimension"},
  {"Clean Digital", "Bucket Analog", "Tape Echo", "Lo-Fi Echo", "Mod Echo", "Reverse", "Shimmer Echo", "Ping Pong"},
  {"Small Room", "Concert Hall", "Bright Plate", "Spring Tank", "Shimmer", "Cloud", "Mod Verb", "Swell Verb"},
}
-- each model's own starting gain, and the delay and reverb types the circuit plays
local MODEL_GAIN = {nil, {0.35, 0.4, 0.4, 0.35, 0.45, 0.45, 0.6, 0.55}, {0.45, 0.35, 0.45, 0.55, 0.55, 0.55, 0.5, 0.4}}
local DELAY_MODE = {0, 1, 2, 3, 4, 5, 6, 7}
local VERB_MODE = {0, 1, 2, 3, 4, 5, 6, 9}
local SUBDIV = {"1/4", "1/8.", "1/8", "1/4T", "1/16"}
local SUBK = {1, 0.75, 0.5, 2 / 3, 0.25}

-- presets: models (one per block), on / off, values in their own units, and scene changes
local PRESETS = {
  {m = {1, 3, 4, 1, 2, 3}, on = {0, 0, 1, 0, 1, 1}, v = {[3] = {GAIN = 0.5}, [4] = {MIX = 0.35}, [5] = {MIX = 0.18}, [6] = {MIX = 0.18}},
   sc = {[2] = {on = {[2] = 1}, v = {[5] = {MIX = 0.3}}}, [3] = {on = {[4] = 1}, v = {[3] = {GAIN = 0.25}}}, [4] = {on = {[4] = 1}, v = {[5] = {MIX = 0.4, FEEDBACK = 0.55}, [6] = {MIX = 0.45, DECAY = 0.75}}}}},
  {m = {2, 1, 2, 2, 3, 4}, on = {1, 0, 1, 0, 1, 1}, v = {[3] = {GAIN = 0.3}, [5] = {MIX = 0.2}, [6] = {MIX = 0.28}},
   sc = {[2] = {on = {[4] = 1}}, [4] = {v = {[5] = {MIX = 0.35, FEEDBACK = 0.5}, [6] = {MIX = 0.45}}}}},
  {m = {1, 3, 6, 1, 1, 2}, on = {0, 1, 1, 0, 1, 1}, v = {[2] = {GAIN = 0.2, LEVEL = 0.7}, [3] = {GAIN = 0.55}, [5] = {MIX = 0.2, TIME = 380}, [6] = {MIX = 0.15}},
   sc = {[2] = {v = {[5] = {MIX = 0.3}}}}},
  {m = {1, 1, 3, 1, 8, 1}, on = {0, 0, 1, 0, 1, 1}, v = {[3] = {GAIN = 0.45}, [5] = {MIX = 0.2}}},
  {m = {1, 1, 1, 3, 5, 5}, on = {0, 0, 1, 1, 1, 1}, v = {[3] = {GAIN = 0.35}, [5] = {MIX = 0.35, FEEDBACK = 0.5, TIME = 520}, [6] = {MIX = 0.35, DECAY = 0.75}}},
  {m = {1, 7, 5, 1, 3, 1}, on = {0, 1, 1, 0, 1, 1}, v = {[3] = {GAIN = 0.4}, [5] = {MIX = 0.22}}},
  {m = {2, 5, 1, 2, 2, 4}, on = {1, 1, 1, 0, 1, 1}, v = {[3] = {GAIN = 0.45}, [5] = {MIX = 0.15}, [6] = {MIX = 0.2}}},
  {m = {1, 3, 7, 1, 1, 1}, on = {0, 1, 1, 0, 0, 1}, v = {[2] = {GAIN = 0.1, LEVEL = 0.75}, [3] = {GAIN = 0.5}, [6] = {MIX = 0.12}}},
  {m = {1, 7, 4, 4, 1, 3}, on = {0, 1, 1, 1, 0, 1}, v = {[3] = {GAIN = 0.35}}},
  {m = {1, 4, 5, 1, 5, 2}, on = {0, 1, 1, 0, 1, 1}, v = {[3] = {GAIN = 0.45}, [5] = {MIX = 0.2}, [6] = {MIX = 0.2}}},
  {m = {1, 1, 1, 2, 1, 1}, on = {1, 0, 1, 1, 0, 1}, v = {[3] = {GAIN = 0.5}}},
  {m = {1, 1, 8, 1, 4, 6}, on = {0, 0, 1, 1, 1, 1}, v = {[4] = {DEPTH = 0.7}, [5] = {MIX = 0.3}}},
}
local THEMES = {
  {bg = "#0b0d12", panel = "#161a22", line = "#2a3140", text = "#eef1f6", dim = "#7f8898", acc = "#ff8a3d", sel = "#ffffff", head = "#11141b"},
  {bg = "#030407", panel = "#0b0e14", line = "#1d2330", text = "#c9d1df", dim = "#566074", acc = "#ff5a3d", sel = "#ffd9c2", head = "#07090d"},
  {bg = "#e8ebf0", panel = "#ffffff", line = "#c3c9d4", text = "#141820", dim = "#677084", acc = "#d9621c", sel = "#141820", head = "#d5dae3"},
}
local MENU = {{"SIGNAL CHAIN", "6 blocks, path A"}, {"MODEL BROWSER", "pick a model for the slot"}, {"SCENES", "8 snapshots per preset"},
  {"PRESETS", "3 banks, 12 presets"}, {"TUNER", "play a single note"}, {"GLOBAL SETTINGS", "tempo, pedals, display"}}
local EXP_TARGETS = {"DELAY MIX", "REVERB MIX", "DRIVE GAIN", "AMP GAIN", "OFF"}
local GLOBAL = {
  {"BPM", "bpm"}, {"DELAY SYNC", "sync"}, {"EXP 2 TARGET", "exp"}, {"SCREEN THEME", "theme"}, {"STRIP BRIGHTNESS", "stripB"},
}

-- ---------------------------------------------------------------- values
local function clamp(v, a, b) return math.max(a, math.min(b, v)) end
local function toVal(p, pos)
  if p[6] then return p[2] * (p[3] / p[2]) ^ pos end
  local v = p[2] + (p[3] - p[2]) * pos
  if p[5] == "sub" then v = math.floor(v + 0.5) end
  return v
end
local function r3(v) return math.floor(v * 1000 + 0.5) / 1000 end
local function toPos(p, v)
  if p[6] then return r3(clamp(math.log(v / p[2]) / math.log(p[3] / p[2]), 0, 1)) end
  return r3(clamp((v - p[2]) / (p[3] - p[2]), 0, 1))
end
local function fmt(p, pos)
  local v = toVal(p, pos)
  local f = p[5]
  if f == "ms" then
    if v >= 1000 then return string.format("%.2fs", v / 1000) end
    return math.floor(v + 0.5) .. "ms"
  elseif f == "db" then return (v > 0 and "+" or "") .. string.format("%.1fdB", v)
  elseif f == "sub" then return SUBDIV[math.floor(v + 0.5) + 1] or "1/4" end
  return math.floor(v * 100 + 0.5) .. "%"
end
local function copy(t)
  local o = {}
  for k, v in pairs(t) do o[k] = type(v) == "table" and copy(v) or v end
  return o
end
local function paramIndex(b, label)
  for i, p in ipairs(PARAMS[b]) do if p[1] == label then return i end end
  return nil
end

-- the live state: blocks {m, on, v}, scenes, preset, scene, mode and globals
local st = load("atlas", nil)
local function slotFor(b, m, over)
  local s = {m = m, on = 1, v = {}}
  for i, p in ipairs(PARAMS[b]) do s.v[i] = toPos(p, p[4]) end
  if MODEL_GAIN[b] and MODEL_GAIN[b][m] then s.v[1] = MODEL_GAIN[b][m] end
  for label, v in pairs(over or {}) do
    local i = paramIndex(b, label)
    if i then s.v[i] = toPos(PARAMS[b][i], v) end
  end
  return s
end
local function snapshot(slots)
  local sc = {on = {}, v = {}}
  for b = 1, 6 do sc.on[b] = slots[b].on; sc.v[b] = copy(slots[b].v) end
  return sc
end
local function presetLive(pi)
  local P = PRESETS[pi]
  local slots = {}
  for b = 1, 6 do
    slots[b] = slotFor(b, P.m[b], P.v[b])
    slots[b].on = P.on[b]
  end
  local scenes = {}
  for i = 1, 8 do
    local sc = snapshot(slots)
    local o = P.sc and P.sc[i]
    if o then
      for b, on in pairs(o.on or {}) do sc.on[b] = on end
      for b, vals in pairs(o.v or {}) do
        for label, v in pairs(vals) do
          local k = paramIndex(b, label)
          if k then sc.v[b][k] = toPos(PARAMS[b][k], v) end
        end
      end
    end
    scenes[i] = sc
  end
  return slots, scenes
end
local function loadPreset(pi)
  pi = (pi - 1) % 12 + 1
  local user = load("user" .. pi, nil)
  if user then st.slots, st.scenes = copy(user.slots), copy(user.scenes)
  else st.slots, st.scenes = presetLive(pi) end
  st.pi, st.sc = pi, 1
  local s1 = st.scenes[1]
  for b = 1, 6 do st.slots[b].on = s1.on[b]; st.slots[b].v = copy(s1.v[b]) end
end
if type(st) ~= "table" or not st.slots then
  st = {pi = 1, sc = 1, mode = 1, bpm = 120, sync = 0, theme = 1, stripB = 1, exp = 1}
  loadPreset(1)
end

local function keep() st.scenes[st.sc] = snapshot(st.slots) end
local function recall(i)
  keep()
  local sc = st.scenes[i]
  for b = 1, 6 do st.slots[b].on = sc.on[b]; st.slots[b].v = copy(sc.v[b]) end
  st.sc = i
end
local dirty = true
local function changed() dirty = true end

-- ---------------------------------------------------------------- navigation
local page, cur, pp = "home", 1, 0 -- cur: 1 to 6 path A, 7 to 12 path B
local lastTap = 0
local bcol, bidx, mi, gi, sci, pri = 1, 1, 1, 1, 1, 1
local msg, msgT = "", 0
local syncing = {}
local function flash(t, s) msg = t; msgT = time() + (s or 1.3) end
local function slotName(k) return (k <= 6 and "A" or "B") .. ((k - 1) % 6 + 1) end
local function presetLabel() return BANKS[math.floor((st.pi - 1) / 4) + 1] .. ((st.pi - 1) % 4 + 1) .. "  " .. PRESET_NAMES[st.pi] end
local function pages(b) return b and math.ceil(#PARAMS[b] / 6) or 1 end
-- the six knobs show the block under the cursor
local function syncKnobs()
  local b = cur <= 6 and cur or nil
  for i = 1, 6 do
    local k = pp * 6 + i
    local v = (b and st.slots[b].v[k]) or 0.5
    syncing[tostring(i)] = v
    setKnob(tostring(i), v)
  end
end
local function openBrowser()
  page = "browser"
  bcol, bidx = 2, cur <= 6 and st.slots[cur].m or 1
end
local function setModel(b, m)
  local on = st.slots[b].on
  st.slots[b] = slotFor(b, m)
  st.slots[b].on = on
  for i = 1, 8 do st.scenes[i].v[b] = copy(st.slots[b].v) end
  keep()
  changed()
end
local function globalValue(k)
  if k == "bpm" then return math.floor(st.bpm) .. " BPM" end
  if k == "sync" then return st.sync == 1 and "ON (SUBDIV)" or "OFF" end
  if k == "exp" then return EXP_TARGETS[st.exp] end
  if k == "theme" then return ({"GRAPHITE", "MIDNIGHT", "DAYLIGHT"})[st.theme] end
  return st.stripB == 1 and "BRIGHT" or "DIM"
end
local function globalStep(k, d)
  if k == "bpm" then st.bpm = clamp(st.bpm + d, 40, 240)
  elseif k == "sync" then st.sync = 1 - st.sync
  elseif k == "exp" then st.exp = (st.exp - 1 + d) % #EXP_TARGETS + 1
  elseif k == "theme" then st.theme = (st.theme - 1 + d) % 3 + 1
  else st.stripB = 1 - st.stripB end
  changed()
end

local function press(key)
  local d = (key == "UP" or key == "LEFT") and -1 or 1
  if page == "home" then
    if key == "ENTER" then return openBrowser() end
    if key == "LEFT" or key == "RIGHT" then
      local row = cur > 6 and 6 or 0
      cur = row + ((cur - row - 1 + d) % 6) + 1
    elseif key == "UP" or key == "DOWN" then cur = cur > 6 and cur - 6 or cur + 6 end
    pp = 0
    syncKnobs()
  elseif page == "browser" then
    if cur > 6 then page = "home" return end
    local list = SHORTS[cur]
    if key == "UP" or key == "DOWN" then bidx = (bidx - 1 + d) % #list + 1
    elseif key == "ENTER" or key == "RIGHT" then
      setModel(cur, bidx)
      page, pp = "home", 0
      flash(slotName(cur) .. "  " .. NAMES[cur][bidx])
      syncKnobs()
    end
  elseif page == "menu" then
    if key == "UP" or key == "DOWN" then mi = (mi - 1 + d) % #MENU + 1
    elseif key == "ENTER" or key == "RIGHT" then
      local to = {"home", "browser", "scenes", "presets", "tuner", "global"}
      if to[mi] == "browser" then return openBrowser() end
      page = to[mi]
      sci, pri = st.sc, st.pi
    end
  elseif page == "global" then
    if key == "UP" or key == "DOWN" then gi = (gi - 1 + d) % #GLOBAL + 1
    else globalStep(GLOBAL[gi][2], key == "LEFT" and -1 or 1) end
  elseif page == "scenes" then
    if key == "ENTER" then recall(sci); changed(); syncKnobs()
    elseif key == "LEFT" or key == "RIGHT" then sci = (sci - 1 + d) % 8 + 1
    else sci = (sci + 3) % 8 + 1 end
  elseif page == "presets" then
    if key == "ENTER" then
      loadPreset(pri); changed(); syncKnobs()
      flash(presetLabel())
      page = "home"
    elseif key == "UP" or key == "DOWN" then pri = math.floor((pri - 1) / 4) * 4 + ((pri - 1) % 4 + d) % 4 + 1
    else pri = ((math.floor((pri - 1) / 4) + d) % 3) * 4 + (pri - 1) % 4 + 1 end
  end
end

local taps = {}
local function tap()
  local now = time()
  local keepT = {}
  for _, t in ipairs(taps) do if now - t < 2.5 then keepT[#keepT + 1] = t end end
  taps = keepT
  taps[#taps + 1] = now
  if #taps >= 2 then
    local ms = (taps[#taps] - taps[1]) / (#taps - 1) * 1000
    if ms > 200 and ms < 2000 then
      st.bpm = math.floor(60000 / ms + 0.5)
      if st.sync == 0 then st.slots[5].v[1] = toPos(PARAMS[5][1], clamp(ms, 40, 2000)) end
      keep(); changed()
      flash("TAP  " .. st.bpm .. " BPM", 0.9)
    end
  end
end

local function foot(i)
  if st.mode == 1 then
    if i <= 6 then st.slots[i].on = 1 - st.slots[i].on; keep(); changed() end
  elseif st.mode == 2 then
    if i <= 8 then recall(i); flash("SCENE " .. i .. "  " .. SCENE_NAMES[i], 0.8)
    else keep(); loadPreset(st.pi + (i == 9 and -1 or 1)); flash(presetLabel()) end
    changed(); syncKnobs()
  else
    local bank = math.floor((st.pi - 1) / 4)
    if i <= 4 then keep(); loadPreset(bank * 4 + i); flash(presetLabel())
    elseif i == 5 or i == 10 then
      keep(); loadPreset(((bank + (i == 5 and 1 or -1)) % 3) * 4 + (st.pi - 1) % 4 + 1)
      flash("BANK " .. BANKS[math.floor((st.pi - 1) / 4) + 1])
    else recall(i - 5) end
    changed(); syncKnobs()
  end
end

-- every control press: latching buttons and footswitches change on each press
local e2 = false
on("change", function(e)
  local n = e.name
  if e.kind == "knob" and syncing[n] ~= nil then
    if math.abs(e.value - syncing[n]) < 0.0005 then syncing[n] = nil return end
    syncing[n] = nil
  end
  if n:sub(1, 3) == "FS " then return foot(tonumber(n:sub(4))) end
  if n == "MODE" then
    st.mode = st.mode % 3 + 1
    changed()
    return flash(MODES[st.mode] .. " MODE", 0.8)
  end
  if n == "TAP" then return tap() end
  if n == "EXP 2" then e2 = true return end
  local k = tonumber(n)
  if e.kind == "knob" and k then
    local b = cur <= 6 and cur or nil
    local idx = pp * 6 + k
    if b and PARAMS[b][idx] then
      st.slots[b].v[idx] = r3(e.value)
      keep(); changed()
    end
    return
  end
  if n == "MENU" then page = page == "menu" and "home" or "menu"
  elseif n == "HOME" then page = "home"
  elseif n == "SAVE" then
    keep()
    if pcall(save, "user" .. st.pi, {slots = st.slots, scenes = st.scenes}) then
      st.saved = st.saved or {}
      st.saved["p" .. st.pi] = 1
      changed()
      flash("SAVED  " .. presetLabel(), 1.4)
    else flash("MEMORY FULL") end
  elseif n == "ON/OFF" then
    if cur <= 6 then st.slots[cur].on = 1 - st.slots[cur].on; keep(); changed() end
  elseif n == "< PAGE" or n == "PAGE >" then
    local np = pages(cur <= 6 and cur or nil)
    pp = (pp + (n == "PAGE >" and 1 or -1) + np) % np
    syncKnobs()
  elseif n == "BACK" then
    local up = {browser = "home", menu = "home", global = "menu", scenes = "menu", presets = "menu", tuner = "menu"}
    page = up[page] or "home"
  elseif n == "UP" or n == "DOWN" or n == "LEFT" or n == "RIGHT" or n == "ENTER" then press(n) end
end)

-- ---------------------------------------------------------------- outputs
local function packStrip()
  local mask = 0
  for b = 1, 6 do if st.slots[b].on == 1 then mask = mask + 2 ^ (b - 1) end end
  local i = (st.mode - 1) + 3 * (st.sc - 1) + 24 * math.floor((st.pi - 1) / 4) + 72 * st.stripB
  return i + (mask + 64 * ((st.pi - 1) % 4) + 0.5) / 256
end
local function packModels()
  local m = {}
  for b = 1, 6 do m[b] = st.slots[b].m - 1 end
  return m[1] + 8 * m[2] + (m[3] + 8 * m[4] + 64 * m[5] + 512 * m[6] + 0.5) / 4096
end
local function drive()
  local s = st.slots
  local exp = e2 and knob("EXP 2") or nil
  local function x(t, v) if exp and EXP_TARGETS[st.exp] == t then return exp end return v end
  output("Comp on", s[1].on == 1)
  output("Drive on", s[2].on == 1)
  output("Amp on", s[3].on == 1)
  output("Mod on", s[4].on == 1)
  output("Delay on", s[5].on == 1)
  output("Verb on", s[6].on == 1)
  output("Drive", x("DRIVE GAIN", s[2].v[1]))
  output("Amp gain", x("AMP GAIN", s[3].v[1]))
  local t = s[5].v[1]
  if st.sync == 1 then t = toPos(PARAMS[5][1], clamp(60000 / st.bpm * SUBK[math.floor(toVal(PARAMS[5][10], s[5].v[10]) + 0.5) + 1], 40, 2000)) end
  output("Time", t)
  output("Repeats", s[5].v[2])
  output("Echo mix", x("DELAY MIX", s[5].v[3]))
  output("Echo type", DELAY_MODE[s[5].m] / 10)
  output("Verb mix", x("REVERB MIX", s[6].v[2]))
  output("Verb type", VERB_MODE[s[6].m] / 9)
  output("Strip", packStrip())
  output("Models", packModels())
end

-- ---------------------------------------------------------------- drawing
local function T(s, x, y, c, size, align, f)
  size = size or 6
  text(s, x, y - size * 0.62, c, size, align or "left", f or "sans")
end
local TW, TH = 38, 22
local function tileX(i) return 38 + (i - 1) * 43 end
local function rowY(r) return r == 1 and 36 or 70 end
local CW = W / 6

local function header(th)
  fillRect(0, 0, W, 14, th.head)
  T(presetLabel(), 6, 7.4, th.text, 7.6, "left", "bold")
  fillCircle(150, 7, 2.6, SCENE_COLS[st.sc])
  T("SCENE " .. st.sc .. " · " .. SCENE_NAMES[st.sc], 182, 7.4, th.text, 6, "center")
  T(MODES[st.mode] .. "  " .. math.floor(st.bpm) .. " BPM", W - 6, 7.4, th.acc, 6, "right")
end

local function home(th)
  -- the signal path: in, path A, out (path B has no circuit here)
  local x1 = tileX(6) + TW + 6
  polyline({17, 53, 24, 53, 24, rowY(1), x1, rowY(1), x1, 53, W - 17, 53}, th.line, 1.4)
  circle(12, 53, 4.5, th.dim, 1.2)
  circle(W - 12, 53, 4.5, th.dim, 1.2)
  T("IN", 12, 63, th.dim, 4.6, "center")
  T("OUT", W - 12, 63, th.dim, 4.6, "center")
  T("A", 27, rowY(1) - 15, th.dim, 5, "center")
  T("B", 27, rowY(2) - 15, th.dim, 5, "center")
  for k = 1, 12 do
    local col = (k - 1) % 6 + 1
    local x, y = tileX(col), rowY(k <= 6 and 1 or 2) - TH / 2
    if k <= 6 then
      local s, cat = st.slots[k], CATS[k]
      local on = s.on == 1
      fillRoundRect(x, y, TW, TH, 3.5, on and fade(cat.col, 0.92) or th.panel)
      roundRect(x, y, TW, TH, 3.5, cat.col)
      T(SHORTS[k][s.m], x + TW / 2, y + 8.6, on and "#101317" or cat.col, 5.4, "center")
      T(cat.short .. (on and "" or " · OFF"), x + TW / 2, y + 15.4, on and "#101317" or th.dim, 3.8, "center")
    else
      roundRect(x, y, TW, TH, 3.5, th.line)
      T("+", x + TW / 2, y + 11.5, th.dim, 6, "center")
    end
    if tapped(x - 2, y - 3, TW + 4, TH + 6) then
      if cur == k and time() - lastTap < 0.45 then openBrowser() end
      lastTap = time()
      if cur ~= k then cur, pp = k, 0; syncKnobs() end
    end
  end
  roundRect(tileX((cur - 1) % 6 + 1) - 2, rowY(cur <= 6 and 1 or 2) - TH / 2 - 2, TW + 4, TH + 4, 5, th.sel)
  local b = cur <= 6 and cur or nil
  if b then
    local s = st.slots[b]
    T(slotName(cur) .. "  ·  " .. CATS[b].name .. "  ·  " .. NAMES[b][s.m] .. (s.on == 1 and "" or "  (OFF)"), 6, 95, CATS[b].col, 6)
    T("PAGE " .. (pp + 1) .. "/" .. pages(b), W - 6, 95, th.dim, 5.4, "right")
  else
    T(slotName(cur) .. "  ·  EMPTY, PATH B HAS NO CIRCUIT IN THIS PEDAL", 6, 95, th.dim, 6)
  end
  local exp = e2 and EXP_TARGETS[st.exp] or ""
  for i = 1, 6 do
    local x = (i - 1) * CW
    fillRoundRect(x + 2, 103, CW - 4, 54, 4, th.panel)
    arc(x + CW / 2, 144, 9, -135, 135, th.line, 2.4)
    local idx = pp * 6 + i
    local p = b and PARAMS[b][idx]
    if p then
      local v = st.slots[b].v[idx]
      local isExp = (exp == "DRIVE GAIN" and b == 2 and idx == 1) or (exp == "AMP GAIN" and b == 3 and idx == 1) or (exp == "DELAY MIX" and b == 5 and idx == 3) or (exp == "REVERB MIX" and b == 6 and idx == 2)
      if isExp then v = knob("EXP 2") end
      T(p[1] .. (isExp and " *" or ""), x + CW / 2, 112, isExp and th.acc or th.dim, 5.2, "center")
      T(fmt(p, v), x + CW / 2, 126, th.text, 8.4, "center", "bold")
      if v > 0.004 then arc(x + CW / 2, 144, 9, -135, -135 + 270 * v, CATS[b].col, 2.4) end
      T(tostring(i), x + CW / 2, 144.5, th.dim, 5, "center")
    else
      T(tostring(i), x + CW / 2, 144.5, th.line, 5, "center")
    end
  end
end

local function browser(th)
  T("MODEL BROWSER  ·  " .. slotName(cur), 6, 21, th.text, 7.4, "left", "bold")
  if cur > 6 then
    T("Path B has no circuit in this pedal.", 10, 40, th.dim, 6)
    T("BACK returns home.", 10, 52, th.dim, 6)
    return
  end
  for i, c in ipairs(CATS) do
    local y = 28 + (i - 1) * 11.6
    local sel = i == cur
    if sel then fillRoundRect(4, y, 104, 10.6, 2.5, bcol == 1 and fade(th.acc, 0.9) or th.line) end
    fillRoundRect(8, y + 2.8, 5, 5, 1, c.col)
    T(c.name, 17, y + 5.6, sel and bcol == 1 and "#101317" or (sel and th.text or th.dim), 5.8)
  end
  fillRect(112, 26, 0.8, 130, th.line)
  local list = SHORTS[cur]
  for i = 1, #list do
    local y = 28 + (i - 1) * 11.6
    local sel = i == bidx
    if sel then fillRoundRect(117, y, W - 122, 10.6, 2.5, fade(CATS[cur].col, 0.9)) end
    T(NAMES[cur][i], 122, y + 5.6, sel and "#101317" or th.text, 6)
    T(i == st.slots[cur].m and "● LOADED" or list[i], W - 8, y + 5.6, sel and "#101317" or th.dim, 4.8, "right")
    if tapped(117, y, W - 122, 10.6) then bidx = i; press("ENTER") end
  end
end

local function listPage(th, title, crumb, rows, sel)
  T(title, 8, 22, th.text, 8.4, "left", "bold")
  T(crumb, W - 8, 22, th.dim, 5, "right")
  for i, r in ipairs(rows) do
    local y = 31 + (i - 1) * 15.5
    local on = i == sel
    if on then fillRoundRect(5, y, W - 10, 13.5, 3, fade(th.acc, 0.92)) end
    T(r[1], 13, y + 6.9, on and "#101317" or th.text, 6.6)
    T(r[2], W - 13, y + 6.9, on and "#101317" or th.dim, 6, "right")
    if tapped(5, y, W - 10, 13.5) then r.tap(mouse.x) end
  end
end

local function scenes(th)
  T("SCENES", 8, 22, th.text, 8.4, "left", "bold")
  T("ENTER = RECALL", W - 8, 22, th.dim, 5, "right")
  for i = 1, 8 do
    local x, y = 6 + (i - 1) % 4 * 80, 32 + math.floor((i - 1) / 4) * 62
    local active, sel = st.sc == i, sci == i
    fillRoundRect(x, y, 74, 56, 5, active and fade(SCENE_COLS[i], 0.85) or th.panel)
    roundRect(x, y, 74, 56, 5, sel and th.sel or th.line)
    fillRoundRect(x, y, 74, 6, 2, SCENE_COLS[i])
    T(tostring(i), x + 8, y + 18, active and "#101317" or th.text, 13, "left", "bold")
    T(SCENE_NAMES[i], x + 8, y + 34, active and "#101317" or SCENE_COLS[i], 6.2)
    local n = 0
    for b = 1, 6 do if st.scenes[i].on[b] == 1 then n = n + 1 end end
    T(active and "● ACTIVE" or n .. " blocks on", x + 8, y + 45, active and "#101317" or th.dim, 4.8)
    if tapped(x, y, 74, 56) then sci = i; press("ENTER") end
  end
end

local function presets(th)
  T("PRESETS", 8, 22, th.text, 8.4, "left", "bold")
  for c = 1, 3 do T("BANK " .. BANKS[c], 10 + (c - 1) * 108, 36, th.dim, 5.4) end
  for i = 1, 12 do
    local c, r = math.floor((i - 1) / 4), (i - 1) % 4
    local x, y = 6 + c * 108, 42 + r * 28
    local active, sel = st.pi == i, pri == i
    fillRoundRect(x, y, 102, 24, 4, active and th.acc or th.panel)
    roundRect(x, y, 102, 24, 4, sel and th.sel or th.line)
    T(BANKS[c + 1] .. (r + 1), x + 7, y + 12, active and "#101317" or th.acc, 8, "left", "bold")
    T(PRESET_NAMES[i] .. ((st.saved and st.saved["p" .. i]) and " *" or ""), x + 22, y + 12, active and "#101317" or th.text, 5.6)
    if tapped(x, y, 102, 24) then pri = i; press("ENTER") end
  end
end

local NOTES = {"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"}
local function tuner(th)
  T("TUNER", 8, 22, th.text, 8.4, "left", "bold")
  T("REF 440 Hz", W - 8, 22, th.dim, 5.4, "right")
  local ok, hz = pcall(function() return audio.pitch() end)
  if not ok then hz = 0 end
  local note, cents = "-", 0
  if hz and hz > 20 then
    local n = 12 * math.log(hz / 440) / math.log(2) + 69
    local r = math.floor(n + 0.5)
    note = NOTES[r % 12 + 1]
    cents = (n - r) * 100
  end
  local good = note ~= "-" and math.abs(cents) < 3
  T(note, W / 2, 62, note == "-" and th.dim or (good and "#46d36f" or th.text), 40, "center", "bold")
  local pos = math.floor(clamp(cents / 50, -1, 1) * 10 + 0.5)
  for i = -10, 10 do
    local lit = note ~= "-" and (i == pos or (good and i == 0))
    local hgt = i == 0 and 16 or (i % 5 == 0 and 12 or 8)
    fillRoundRect(W / 2 + i * 13 - 1.5, 118 - hgt, 3, hgt, 1, lit and (good and "#46d36f" or (math.abs(i) > 5 and "#ff3b30" or th.acc)) or th.line)
  end
  T(note ~= "-" and ((cents >= 0 and "+" or "") .. string.format("%.1f cents  ·  %.1f Hz", cents, hz)) or "play a single note", W / 2, 132, th.dim, 7, "center")
  T("BACK TO LEAVE", W / 2, 148, th.acc, 5, "center")
end

function draw(dt)
  local th = THEMES[st.theme] or THEMES[1]
  clear(th.bg)
  header(th)
  if mouse.pressed and mouse.y < 14 then
    page = mouse.x < 130 and "presets" or (mouse.x < 230 and "scenes" or "menu")
    sci, pri = st.sc, st.pi
  end
  if page == "home" then home(th)
  elseif page == "browser" then browser(th)
  elseif page == "menu" then
    local rows = {}
    for i, m in ipairs(MENU) do rows[i] = {m[1], m[2], tap = function() mi = i; press("ENTER") end} end
    listPage(th, "MENU", "ENTER = OPEN · BACK", rows, mi)
  elseif page == "global" then
    local rows = {}
    for i, g in ipairs(GLOBAL) do rows[i] = {g[1], "<  " .. globalValue(g[2]) .. "  >", tap = function(x) gi = i; globalStep(g[2], x < W / 2 and -1 or 1) end} end
    listPage(th, "GLOBAL SETTINGS", "MENU > GLOBAL  ·  < > CHANGE", rows, gi)
  elseif page == "scenes" then scenes(th)
  elseif page == "presets" then presets(th)
  elseif page == "tuner" then tuner(th) end
  if time() < msgT then
    fillRoundRect(W / 2 - 90, H / 2 - 11, 180, 22, 6, fade("#000000", 0.82))
    roundRect(W / 2 - 90, H / 2 - 11, 180, 22, 6, th.acc)
    T(msg, W / 2, H / 2 + 0.5, "#ffffff", 7.2, "center")
  end
  if not pedalOn() then T("BYPASS", W - 6, 95, th.acc, 5.4, "right") end
  drive()
  if dirty then save("atlas", st) dirty = false end
end

-- scroll over a value to change it
function onWheel(d, x, y)
  if page == "home" and y > 103 and cur <= 6 then
    local i = math.floor(x / CW) + 1
    local idx = pp * 6 + i
    local p = PARAMS[cur][idx]
    if p then
      local step = (p[5] == "sub") and 0.25 or 0.02
      st.slots[cur].v[idx] = r3(clamp(st.slots[cur].v[idx] + d * step, 0, 1))
      keep(); changed(); syncKnobs()
    end
  else press(d > 0 and "UP" or "DOWN") end
end

function setup() syncKnobs() end
`;

// ------------------------------------------------------------------ a scribble strip (520 x 15), one per row
export function stripScript(row) {
  return `-- Atlas Floor scribble strip ${row}: what footswitches ${row * 5 - 4} to ${row * 5} do right now.
-- The main screen sends the mode, scene, preset and block states (input Strip)
-- and the loaded models (input Models).
local ROW = ${row}
` + SHARED + `
local function unpack()
  local v = input("Strip")
  local i = math.floor(v)
  local f = math.floor((v - i) * 256)
  local mode, sc, bank, bright = i % 3 + 1, math.floor(i / 3) % 8 + 1, math.floor(i / 24) % 3, math.floor(i / 72)
  local ons = {}
  for b = 1, 6 do ons[b] = math.floor(f / 2 ^ (b - 1)) % 2 == 1 end
  local pi = bank * 4 + math.floor(f / 64) % 4 + 1
  local m = input("Models")
  local mi = math.floor(m)
  local mf = math.floor((m - mi) * 4096)
  local models = {mi % 8 + 1, math.floor(mi / 8) % 8 + 1, mf % 8 + 1, math.floor(mf / 8) % 8 + 1, math.floor(mf / 64) % 8 + 1, math.floor(mf / 512) % 8 + 1}
  return mode, sc, pi, ons, models, bright
end

function draw()
  clear("#05070a")
  local mode, sc, pi, ons, models, bright = unpack()
  local cw = W / 5
  for c = 1, 5 do
    local i = (ROW - 1) * 5 + c
    local label, col, lit = fsInfo(mode, i, sc, pi, ons, models)
    local x = (c - 1) * cw
    fillRoundRect(x + 3, 1.5, cw - 6, H - 3, 2, lit and "#1b2130" or "#10131a")
    fillRoundRect(x + 3, 1.5, 3, H - 3, 1, lit and col or fade(col, 0.25))
    text(tostring(i), x + 11, H / 2, "#5d6575", 4.6, "middle", "sans")
    text(label, x + cw / 2 + 4, H / 2, lit and col or (bright == 1 and "#aab2c0" or "#6b7383"), 6.6, "middle", "sans")
  end
end
`;
}

// the packed values the strips read, for the outputs' defaults (as packStrip / packModels in the script)
export function stripValue({ mode = 1, sc = 1, pi = 1, ons, bright = 1 }) {
  let mask = 0;
  ons.forEach((on, b) => (mask += on ? 2 ** b : 0));
  return mode - 1 + 3 * (sc - 1) + 24 * Math.floor((pi - 1) / 4) + 72 * bright + (mask + 64 * ((pi - 1) % 4) + 0.5) / 256;
}
export function modelsValue(m) {
  const z = m.map((x) => x - 1);
  return z[0] + 8 * z[1] + (z[2] + 8 * z[3] + 64 * z[4] + 512 * z[5] + 0.5) / 4096;
}
