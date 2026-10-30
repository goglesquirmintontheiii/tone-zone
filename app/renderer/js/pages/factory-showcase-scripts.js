// Screen scripts for the Pedal Factory templates (factory-showcase.js). Plain screen script code, the same a
// user could type in the code editor (see docs/screen-scripts.md).

// ------------------------------------------------------------------ Synth Box: the wave the controls make
export const SYNTH_SCRIPT = `-- Synth Box: draws the sound the controls make right now.
-- WAVE switch picks the oscillator, SUB or DIP 1 drops it an octave,
-- CUTOFF and RES shape it with a resonant low pass filter, ATTACK (or HOLD)
-- sets how it fades in, MIX and DRY blend the guitar back in.
-- DIP 5 zooms out, DIP 6 shows the harmonics, DIP 7 the grid, DIP 8 a glow.

local names = {"SAW", "SQUARE", "PAD"}
local scroll = 0
local gate = 0

-- one oscillator sample, t counted in cycles
local function osc(kind, t)
  local f = t - math.floor(t)
  if kind == 1 then return 1 - 2 * f end
  if kind == 2 then return f < 0.5 and 0.8 or -0.8 end
  local g = t * 1.007 + 0.31
  return (1 - 2 * f) * 0.45 + (1 - 2 * (g - math.floor(g))) * 0.35 + math.sin(t * math.pi) * 0.3
end

local function settings()
  local s = {}
  s.wave = switch(1)
  s.sub = pushbutton("SUB") or dip("VOICE", 1)
  s.oct = s.sub and -1 or 0
  s.cut = knob("CUTOFF")
  s.res = knob("RES")
  if dip("VOICE", 4) then s.res = math.max(s.res, 0.8) end
  s.hold = footswitch("HOLD")
  s.att = s.hold and 1 or knob("ATTACK")
  s.mix = knob("MIX")
  s.dry = (pushbutton("DRY") and 0.6 or 0) + (dip("VOICE", 2) and 0.4 or 0)
  s.zoom = dip("VOICE", 5) and 2 or 1
  return s
end

function draw(dt)
  theme("tft")
  clear()
  local s = settings()
  local on = pedalOn()
  -- the envelope opens with the playing, as fast as ATTACK allows
  local env = signal("env")
  local target = env > 0.06 and 1 or 0
  local rate = target > gate and dt / (0.03 + s.att * 1.2) or dt / 0.35
  gate = gate + (target - gate) * math.min(1, rate)
  scroll = scroll + dt * 0.35

  -- header
  fillRect(0, 0, W, 11, colors.panel)
  text(names[s.wave] or "SAW", 3, 2, colors.accent)
  local hz = math.floor(80 * 2 ^ (s.cut * 8))
  text("OCT " .. s.oct .. "  " .. hz .. "HZ  Q" .. math.floor(s.res * 100), W - 3, 2, colors.fg, nil, "right")
  if gate > 0.5 and on then fillCircle(W / 2 + 6, 5, 2, colors.good) end

  -- the scope: raw oscillator (dim) and the filtered, mixed output (bright)
  local x0, y0, sw, sh = 2, 14, math.floor(W * 0.72), H - 36
  local mid = y0 + sh / 2
  if dip("VOICE", 7) then
    for i = 1, 3 do line(x0, y0 + sh * i / 4, x0 + sw, y0 + sh * i / 4, fade(colors.dim, 0.6)) end
    for i = 1, 7 do line(x0 + sw * i / 8, y0, x0 + sw * i / 8, y0 + sh, fade(colors.dim, 0.4)) end
  end
  rect(x0 - 1, y0 - 1, sw + 2, sh + 2, colors.dim)
  local cycles = 2.5 * 2 ^ s.oct * s.zoom
  local per = sw / cycles
  local harm = 1 + s.cut * s.cut * 30
  local f = 2 * math.sin(math.pi * math.min(harm / per, 0.2))
  local q = 1.9 - s.res * 1.75
  local low, band = 0, 0
  local outs, raws = {}, {}
  local peak = 0.3
  -- one cycle first so the filter settles, then the visible part
  for i = -math.floor(per), sw do
    local t = i / per + scroll
    local x = osc(s.wave, t)
    low = low + f * band
    local high = x - low - q * band
    band = band + f * high
    if i >= 0 then
      raws[#raws + 1] = x
      outs[#outs + 1] = low
      if math.abs(low) > peak then peak = math.abs(low) end
    end
  end
  local amp = sh * 0.45 * (0.35 + 0.65 * gate)
  local rp, op = {}, {}
  for i = 1, #outs do
    local x = x0 + i - 1
    local guitar = math.sin((i / per + scroll * 0.5) * math.pi * 2 * 0.5) * 0.8
    local wet = outs[i] / peak
    local y = on and (wet * s.mix + guitar * s.dry) / math.max(1, s.mix + s.dry * 0.5) or guitar
    rp[#rp + 1] = x
    rp[#rp + 1] = mid - raws[i] * sh * 0.42
    op[#op + 1] = x
    op[#op + 1] = mid - y * amp
  end
  polyline(rp, fade(colors.dim, 0.9), 1)
  if dip("VOICE", 8) then glow(4, colors.accent) end
  polyline(op, on and colors.accent or colors.fg, 2)
  glow(0)
  if not on then text("BYPASS", x0 + sw / 2, mid - 3, colors.warn, nil, "center") end

  -- right panel: filter response, or the harmonics with DIP 6
  local px, pw = x0 + sw + 5, W - (x0 + sw + 5) - 2
  local fy, fh = y0, math.floor(sh * 0.55)
  rect(px, fy, pw, fh, colors.dim)
  if dip("VOICE", 6) then
    for k = 1, 10 do
      local a = s.wave == 2 and (k % 2 == 1 and 1 / k or 0) or 1 / k
      local r = k / harm
      local g = 1 / math.sqrt((1 - r * r) ^ 2 + (r / (2.1 - q)) ^ 2)
      local h = math.min(fh - 2, a * g * (fh - 2))
      fillRect(px + 1 + (k - 1) * (pw - 2) / 10, fy + fh - 1 - h, math.max(1, (pw - 2) / 10 - 1), h, colors.fg)
    end
  else
    local pts = {}
    for i = 0, 23 do
      local r = 2 ^ (i / 23 * 6 - 3)
      local g = 1 / math.sqrt((1 - r * r) ^ 2 + (r / (2.1 - q)) ^ 2)
      local v = math.clamp(g / 4, 0, 1)
      pts[#pts + 1] = px + 1 + i * (pw - 2) / 23
      pts[#pts + 1] = fy + fh - 2 - v * (fh - 4)
    end
    polyline(pts, colors.warn, 1)
    local cx = px + 1 + (math.log(harm) / math.log(2) / 6 + 0.5) * (pw - 2) * 0.5
    line(cx, fy + 1, cx, fy + fh - 1, fade(colors.warn, 0.4))
  end
  text("FILTER", px + 2, fy + 2, colors.dim)

  -- envelope: attack ramp with the current level riding on it
  local ey, eh = fy + fh + 3, sh - fh - 3
  rect(px, ey, pw, eh, colors.dim)
  local ax = px + 2 + s.att * (pw - 12)
  polyline({px + 1, ey + eh - 2, ax + 2, ey + 3, px + pw - 6, ey + 5, px + pw - 2, ey + eh - 2}, colors.good, 1)
  fillCircle(px + 1 + gate * (ax + 1 - px), ey + eh - 2 - gate * (eh - 5), 2, colors.fg)
  if s.hold then text("HOLD", px + pw - 2, ey + 2, colors.warn, nil, "right") end

  -- bottom row: DIP switches, buttons and the mix
  local by = H - 19
  for i = 1, 8 do
    local bx = 2 + (i - 1) * 9
    local d = dip("VOICE", i)
    fillRoundRect(bx, by, 7, 13, 1, colors.panel)
    fillRect(bx + 1, d and by + 1 or by + 6, 5, 6, d and colors.accent or colors.dim)
    text(tostring(i), bx + 2, by + 14, colors.dim, 5)
  end
  local tx = 78
  for _, b in ipairs({{"SUB", s.sub}, {"DRY", s.dry > 0}, {"HOLD", s.hold}}) do
    local w = textWidth(b[1]) + 6
    if b[2] then fillRoundRect(tx, by + 1, w, 11, 2, colors.accent) else roundRect(tx, by + 1, w, 11, 2, colors.dim) end
    text(b[1], tx + 3, by + 3, b[2] and colors.bg or colors.dim)
    tx = tx + w + 3
  end
  text("MIX", tx + 2, by + 3, colors.dim)
  bar(tx + 20, by + 3, W - tx - 24, 7, s.mix, colors.accent)
end

-- tap the wave to step through the waves, the right panel for the harmonics
function onPress(x, y)
  if y > 12 and y < H - 20 then
    if x < W * 0.74 then
      setSwitch(1, switch(1) % 3 + 1)
    else
      setDip("VOICE", 6, not dip("VOICE", 6))
    end
  end
end
`;

// ------------------------------------------------------------------ Twin Echo
export const ECHO_SCRIPT = `-- Twin Echo: the delay time, the repeats as taps that fade away,
-- a light that flashes in time and the mode. Tap the time to see BPM,
-- tap the mode to switch between digital and tape.

local showBpm = load("bpm", false)
local t0 = 0

function draw(dt)
  theme("oled")
  clear()
  local ms = 20 * 100 ^ knob("TIME")
  local fb = knob("REPEATS")
  local mix = knob("MIX")
  local mod = knob("MOD")
  local tape = switch(1) == 2
  local on = pedalOn()
  local accent = tape and colors.warn or colors.fg

  -- time readout
  if showBpm then
    digits(string.format("%3d", math.floor(60000 / ms + 0.5)), 3, 3, 16, accent, fade(colors.dim, 0.5))
    text("BPM", 50, 13, colors.dim)
  else
    digits(string.format("%4d", math.floor(ms + 0.5)), 3, 3, 16, accent, fade(colors.dim, 0.5))
    text("MS", 57, 13, colors.dim)
  end
  -- repeats and mix
  text("FDBK", 76, 3, colors.dim)
  bar(100, 4, 40, 5, fb, accent)
  text(math.floor(fb * 100) .. "%", W - 3, 3, colors.fg, nil, "right")
  text("MIX", 76, 12, colors.dim)
  bar(100, 13, 40, 5, mix, accent)
  text(math.floor(mix * 100) .. "%", W - 3, 12, colors.fg, nil, "right")

  -- the echo taps: one line per repeat, louder repeats are taller
  local y0, y1 = 24, H - 13
  line(2, y1, W - 2, y1, colors.dim)
  local span = math.clamp(ms / 2000, 0.05, 1)
  local gap = 8 + span * 40
  local period = ms / 1000
  local now = time() - t0
  local pos = (now % (period * 6)) / period
  local level = 1
  local n = 0
  local x = 6
  fillRect(x - 1, y0, 3, y1 - y0, colors.accent)
  while x + gap < W - 4 and level > 0.04 and n < 24 do
    n = n + 1
    x = x + gap
    level = level * (0.25 + fb * 0.7)
    local wob = math.sin(now * 3 + n) * mod * 3
    local h = (y1 - y0) * level * (0.4 + mix * 0.6)
    local lit = math.abs(pos - n) < 0.35
    local c = lit and colors.accent or accent
    if tape then
      fillRoundRect(x + wob - 1.5, y1 - h, 3, h, 1.5, fade(c, lit and 1 or 0.75))
    else
      fillRect(x + wob - 1, y1 - h, 2, h, fade(c, lit and 1 or 0.85))
    end
  end
  -- a dot running along the repeats
  if on then fillCircle(6 + pos * gap, y1 + 3, 1.5, colors.accent) end

  -- mode, tempo light and bypass
  local mode = tape and "TAPE" or "DIG"
  roundRect(2, H - 10, textWidth(mode) + 6, 9, 2, accent)
  text(mode, 5, H - 9, accent)
  if (now % period) < 0.08 then fillCircle(W - 6, H - 6, 3, colors.bad) else circle(W - 6, H - 6, 3, colors.dim) end
  text("TAP", W - 12, H - 9, colors.dim, nil, "right")
  if not on then text("BYPASS", W / 2, H - 9, colors.warn, nil, "center") end
end

function onPress(x, y)
  if y < 22 and x < 72 then
    showBpm = not showBpm
    save("bpm", showBpm)
  elseif y > H - 12 and x < 40 then
    setSwitch(1, switch(1) == 1 and 2 or 1)
  end
end

-- the light starts again when the time changes
function onControl(name, value)
  if name == "TIME" then t0 = time() end
end
`;

// ------------------------------------------------------------------ VU Drive (amber VU and EQ curve)
export const VU_SCRIPT = `-- VU Drive: a needle meter of the drive's output (the Level input, wired
-- from an envelope follower in the circuit) and the EQ curve of the knobs.
-- Tap the screen to switch pages.

local page = load("page", 1)
local needle = 0
local peak = 0

local function level()
  local v = input("Level")
  if v <= 0 then v = signal("out") end
  return math.clamp(v, 0, 1)
end

local function vu()
  local cx, cy, r = W / 2, H + 18, H + 2
  -- scale: -20 to +3, red from 0
  for i = 0, 23 do
    local a = -50 + i * 100 / 23
    local red = i >= 18
    local len = (i % 4 == 0) and 7 or 4
    local s, c = math.sin(math.rad(a)), math.cos(math.rad(a))
    line(cx + s * r, cy - c * r, cx + s * (r - len), cy - c * (r - len), red and colors.bad or colors.fg, red and 2 or 1)
  end
  arc(cx, cy, r - 9, 30, 50, colors.bad, 3)
  text("VU", cx, cy - r + 16, colors.dim, 14, "center", "bold")
  -- the needle swings with a little weight
  local target = level()
  needle = needle + (target - needle) * 0.25
  if target > peak then peak = target else peak = peak - 0.01 end
  local a = math.rad(-50 + needle * 100)
  line(cx, cy, cx + math.sin(a) * (r - 2), cy - math.cos(a) * (r - 2), colors.accent, 2)
  fillCircle(W - 8, 8, 3, peak > 0.82 and colors.bad or colors.dim)
  text("PEAK", W - 14, 5, colors.dim, nil, "right")
  text("GAIN " .. string.format("%.1f", knob("GAIN") * 10), 4, 4, colors.fg)
end

-- a bell around a frequency (0 to 1 across the band)
local function bell(x, at, width, gain)
  local d = (x - at) / width
  return gain * math.exp(-d * d)
end

local function eq()
  text("EQ", 4, 4, colors.fg, nil, nil, "bold")
  local b, m, t = knob("BASS") * 2 - 1, knob("MID") * 2 - 1, knob("TREBLE") * 2 - 1
  local x0, y0, w, h = 6, 16, W - 12, H - 28
  line(x0, y0 + h / 2, x0 + w, y0 + h / 2, colors.dim)
  for i = 1, 3 do line(x0 + w * i / 4, y0, x0 + w * i / 4, y0 + h, fade(colors.dim, 0.5)) end
  local pts = {x0, y0 + h}
  for i = 0, 40 do
    local x = i / 40
    local g = bell(x, 0.08, 0.22, b) + bell(x, 0.5, 0.2, m) + bell(x, 0.92, 0.22, t)
    pts[#pts + 1] = x0 + x * w
    pts[#pts + 1] = y0 + h / 2 - g * h * 0.4
  end
  pts[#pts + 1] = x0 + w
  pts[#pts + 1] = y0 + h
  polygon(pts, fade(colors.fg, 0.25), true)
  table.remove(pts, 1) table.remove(pts, 1) table.remove(pts) table.remove(pts)
  polyline(pts, colors.accent, 2)
  text("BASS", x0, H - 10, colors.dim)
  text("MID", W / 2, H - 10, colors.dim, nil, "center")
  text("TREBLE", W - 6, H - 10, colors.dim, nil, "right")
end

function draw()
  theme("amber")
  clear()
  if page == 1 then vu() else eq() end
  if not pedalOn() then text("OFF", W / 2, H / 2 - 10, colors.warn, 14, "center") end
end

function onPress()
  page = page == 1 and 2 or 1
  save("page", page)
end
`;

// ------------------------------------------------------------------ Wave Trem
export const TREM_SCRIPT = `-- Wave Trem: the LFO that moves the volume. The wave is drawn from the
-- RATE, DEPTH and SHAPE controls; the dot is the real LFO value coming in
-- from the circuit (screen input "LFO"). Tap the screen for the next shape.

local shapes = {"SINE", "TRIANGLE", "SQUARE", "SAW UP", "SAW DOWN", "RANDOM"}
local phase = 0
local rnd = {}
for i = 1, 16 do rnd[i] = math.random() end

local function wave(kind, t)
  local f = t - math.floor(t)
  if kind == 1 then return 0.5 + 0.5 * math.sin(f * math.pi * 2) end
  if kind == 2 then return f < 0.5 and f * 2 or 2 - f * 2 end
  if kind == 3 then return f < 0.5 and 1 or 0 end
  if kind == 4 then return f end
  if kind == 5 then return 1 - f end
  return rnd[math.floor(t) % 16 + 1]
end

function draw(dt)
  theme("oled")
  clear()
  local hz = 0.5 * 24 ^ knob("RATE")
  local depth = knob("DEPTH")
  local kind = switch("SHAPE")
  phase = phase + dt * hz
  text(shapes[kind] or "SINE", 3, 2, colors.fg)
  text(string.format("%.1f HZ", hz), W - 3, 2, colors.fg, nil, "right")
  -- the wave scrolls right to left at the real rate
  local x0, y0, w, h = 3, 13, W - 6, H - 26
  local lo = 1 - depth
  local pts = {}
  for i = 0, w, 2 do
    local t = phase + (i - w) / w * 2
    local v = lo + wave(kind, t) * depth
    pts[#pts + 1] = x0 + i
    pts[#pts + 1] = y0 + h - v * h
  end
  line(x0, y0 + h - lo * h, x0 + w, y0 + h - lo * h, fade(colors.dim, 0.7))
  glow(3, colors.fg)
  polyline(pts, colors.fg, 2)
  glow(0)
  -- the circuit's own LFO (0 when the pedal is not playing)
  local real = input("LFO")
  if real > 0 then
    fillCircle(x0 + w, y0 + h - real * h, 3, colors.accent)
    graph(x0, H - 11, w, 9, history("lfo", real, 60), colors.dim, 0, 1)
  else
    fillCircle(x0 + w, y0 + h - (lo + wave(kind, phase) * depth) * h, 3, colors.accent)
  end
  text("DEPTH " .. math.floor(depth * 100) .. "%", 3, H - 9, colors.dim)
  if not pedalOn() then text("BYPASS", W - 3, H - 9, colors.warn, nil, "right") end
end

function onPress()
  setSwitch("SHAPE", switch("SHAPE") % 6 + 1)
end
`;

// ------------------------------------------------------------------ Squeeze (compressor, screen output)
export const SQUEEZE_SCRIPT = `-- Squeeze: input and output levels from the circuit (screen inputs In and
-- Out), how hard it squeezes, and a BLEND slider that sets the dry / wet
-- mix through the screen's output (wired to the compressor's Blend input).

local blend = load("blend", 1)

local function lvl(name, fallback)
  local v = input(name)
  if v <= 0 then v = fallback end
  return math.clamp(v, 0, 1)
end

function draw()
  theme("ice")
  clear()
  local i = lvl("In", signal("in"))
  local o = lvl("Out", signal("out"))
  local sus = knob("SUSTAIN")
  local squash = math.clamp(i * (0.3 + sus * 1.2) - 0.1, 0, 1) * blend
  -- meters
  text("IN", 3, 3, colors.dim)
  meter(18, 3, W - 64, 6, i)
  text("OUT", 3, 12, colors.dim)
  meter(18, 12, W - 64, 6, o)
  -- squeeze amount as a falling bar, like gain reduction
  local gx = W - 40
  text("GR", gx, 3, colors.dim)
  fillRect(gx + 14, 3, 22, 15, colors.panel)
  fillRect(gx + 14, 3, 22 * squash, 15, colors.warn)
  text(string.format("-%.0fdB", squash * 18), gx + 25, 7, colors.fg, nil, "center")
  -- the last few seconds, in and out
  local gy, gh = 23, H - 50
  rect(2, gy, W - 4, gh, colors.dim)
  graph(3, gy + 1, W - 6, gh - 2, history("in", i, 90), fade(colors.fg, 0.4), 0, 1, true)
  graph(3, gy + 1, W - 6, gh - 2, history("out", o, 90), colors.accent, 0, 1)
  -- sustain and attack
  text("SUS " .. math.floor(sus * 100), 4, gy + gh + 3, colors.fg)
  text("ATK " .. math.floor(knob("ATTACK") * 100), W / 2, gy + gh + 3, colors.fg, nil, "center")
  text(blend < 0.99 and "PARALLEL" or "FULL", W - 4, gy + gh + 3, blend < 0.99 and colors.warn or colors.good, nil, "right")
  -- the blend slider drives the circuit through output 1
  local nb = slider("BLEND", 3, H - 13, W - 40, 11, blend)
  if button("50%", W - 34, H - 13, 31, 11) then nb = 0.5 end
  if nb ~= blend then
    blend = nb
    save("blend", blend)
  end
  output("Blend", blend)
  if not pedalOn() then text("BYPASS", W / 2, gy + gh / 2 - 3, colors.warn, nil, "center") end
end
`;

// ------------------------------------------------------------------ Command Center (multi-effect, pages)
export const COMMAND_SCRIPT = `-- Command Center: a multi-effect with pages. HOME shows the chain (tap a
-- block to turn it on or off), each effect page has dials that turn the real
-- knobs, SETUP has menus for the colour theme and the meters.
-- Screen inputs In / Out come from envelope followers in the circuit,
-- output Master sets the reverb's output level.

local page = 1
local themes = {"tft", "amp", "neon", "sunset", "ice", "phosphor"}
local themeIx = load("theme", 1)
local peakHold = load("peak", true)
local master = load("master", 0.6)
local menu = nil
local menuPick = 1
local flow = 0
local inPk, outPk = 0, 0

local function level(name, fb)
  local v = input(name)
  if v <= 0 then v = fb end
  return math.clamp(v, 0, 1)
end

-- the effect blocks: name, colour, is it on, how to flip it
local function blocks()
  return {
    {"COMP", "#3ddc84", dip("SETUP", 1), function(v) setDip("SETUP", 1, v) end},
    {"DRIVE", "#ff7a2f", footswitch("DRIVE"), function(v) setFootswitch("DRIVE", v) end},
    {"MOD", "#b45cff", footswitch("MOD"), function(v) setFootswitch("MOD", v) end},
    {"ECHO", "#2b9bff", knob("ECHO") > 0.02, function(v) setKnob("ECHO", v and 0.35 or 0) end},
    {"VERB", "#37d6c2", knob("VERB") > 0.02, function(v) setKnob("VERB", v and 0.35 or 0) end},
  }
end

local function meters(i, o)
  inPk = math.max(i, inPk - 0.01)
  outPk = math.max(o, outPk - 0.01)
  local h = H - 28
  meter(2, 14, 5, h, i)
  meter(W - 7, 14, 5, h, o)
  if peakHold then
    line(1, 14 + h - inPk * h, 8, 14 + h - inPk * h, colors.warn)
    line(W - 8, 14 + h - outPk * h, W - 1, 14 + h - outPk * h, colors.warn)
  end
end

local function home(dt, i, o)
  local list = blocks()
  local n = #list
  local bw = math.floor((W - 30) / n) - 4
  local y = 34
  flow = flow + dt * (0.6 + i * 3)
  line(10, y + 12, W - 10, y + 12, colors.dim, 2)
  for k, b in ipairs(list) do
    local x = 14 + (k - 1) * (bw + 4)
    local c = b[3] and b[2] or colors.dim
    fillRoundRect(x, y, bw, 24, 3, b[3] and fade(b[2], 0.25) or colors.panel)
    roundRect(x, y, bw, 24, 3, c)
    text(b[1], x + bw / 2, y + 5, b[3] and colors.fg or colors.dim, nil, "center")
    text(b[3] and "ON" or "OFF", x + bw / 2, y + 14, c, nil, "center")
    if tapped(x, y, bw, 24) then b[4](not b[3]) end
  end
  -- the signal moving through the chain
  for d = 0, 5 do
    local p = (flow * 0.2 + d / 6) % 1
    fillCircle(10 + p * (W - 20), y + 12, 1.5 + o * 2, colors.accent)
  end
  text("IN", 12, 16, colors.dim)
  text(math.floor(i * 100) .. "", 26, 16, colors.fg)
  text("OUT", W - 30, 16, colors.dim, nil, "right")
  text(math.floor(o * 100) .. "", W - 12, 16, colors.fg, nil, "right")
  -- master level through screen output 1
  local m = slider("MASTER", 14, H - 26, W - 28, 10, master)
  if m ~= master then master = m save("master", m) end
  text("MASTER " .. math.floor(master * 100) .. "%", W / 2, H - 13, colors.dim, nil, "center")
end

local function dials(names, x0, y)
  local step = math.floor((W - 30 - x0) / #names)
  for k, name in ipairs(names) do
    local v = dial(name, x0 + step * (k - 0.5), y, 11, knob(name))
    if math.abs(v - knob(name)) > 0.001 then setKnob(name, v) end
  end
end

local function panel(x, y, w, h)
  fillRoundRect(x, y, w, h, 3, colors.panel)
  roundRect(x, y, w, h, 3, colors.dim)
end

local function drivePage()
  dials({"SUSTAIN", "DRIVE", "TONE", "LEVEL"}, 12, 34)
  local x, y, w, h = 14, 60, W / 2 - 18, H - 74
  panel(x, y, w, h)
  -- the clipping curve, and a dot riding it
  local g = 1 + knob("DRIVE") * 9
  local pts = {}
  for i = 0, 24 do
    local v = i / 12 - 1
    local e = math.exp(2 * g * v)
    local out = (e - 1) / (e + 1)
    pts[#pts + 1] = x + 2 + i * (w - 4) / 24
    pts[#pts + 1] = y + h / 2 - out * (h / 2 - 3)
  end
  polyline(pts, "#ff7a2f", 2)
  local v = math.sin(time() * 3)
  local e = math.exp(2 * g * v)
  fillCircle(x + 2 + (v + 1) / 2 * (w - 4), y + h / 2 - (e - 1) / (e + 1) * (h / 2 - 3), 2.5, colors.fg)
  text("CLIP", x + 4, y + 3, colors.dim)
  local on = toggle("DRIVE ON", W / 2 + 4, y + 2, W / 2 - 18, 12, footswitch("DRIVE"))
  if on ~= footswitch("DRIVE") then setFootswitch("DRIVE", on) end
  local c = toggle("COMP ON", W / 2 + 4, y + 18, W / 2 - 18, 12, dip("SETUP", 1))
  if c ~= dip("SETUP", 1) then setDip("SETUP", 1, c) end
end

local function modPage()
  dials({"RATE", "DEPTH"}, 12, 34)
  local x, y, w, h = 14, 60, W - 28, H - 74
  panel(x, y, w, h)
  local hz = 0.2 + knob("RATE") * 6
  local d = knob("DEPTH")
  local pts = {}
  for i = 0, w - 4, 3 do
    pts[#pts + 1] = x + 2 + i
    pts[#pts + 1] = y + h / 2 - math.sin((i / (w - 4)) * 6 + time() * hz * 2) * d * (h / 2 - 3)
  end
  polyline(pts, "#b45cff", 2)
  local on = toggle("MOD ON", W / 2 + 4, 26, W / 2 - 18, 12, footswitch("MOD"))
  if on ~= footswitch("MOD") then setFootswitch("MOD", on) end
  local vib = toggle("VIBRATO", W / 2 + 4, 42, W / 2 - 18, 12, dip("SETUP", 4))
  if vib ~= dip("SETUP", 4) then setDip("SETUP", 4, vib) end
end

local function echoPage()
  dials({"TIME", "REPEATS", "ECHO"}, 12, 34)
  local x, y, w, h = 14, 60, W - 28, H - 74
  panel(x, y, w, h)
  local ms = 20 * 100 ^ knob("TIME")
  local fb = knob("REPEATS")
  local gap = 6 + ms / 2000 * 40
  local lvl, px = 1, x + 6
  local beat = (time() % (ms / 1000)) / (ms / 1000)
  fillRect(px - 1, y + 3, 2, h - 6, colors.fg)
  for k = 1, 20 do
    px = px + gap
    lvl = lvl * (0.25 + fb * 0.7)
    if px > x + w - 4 or lvl < 0.04 then break end
    local hh = (h - 6) * lvl
    fillRect(px - 1, y + h - 3 - hh, 3, hh, dip("SETUP", 2) and "#ffb020" or "#2b9bff")
  end
  text(math.floor(ms) .. " MS", x + w - 4, y + 3, colors.fg, nil, "right")
  if beat < 0.1 then fillCircle(x + w - 8, y + 14, 3, colors.bad) end
  local tape = toggle("TAPE", W - 70, 16, 56, 11, dip("SETUP", 2))
  if tape ~= dip("SETUP", 2) then setDip("SETUP", 2, tape) end
end

local function verbPage()
  dials({"VERB"}, 12, 34)
  local x, y, w, h = 14, 60, W - 28, H - 74
  panel(x, y, w, h)
  local mix = knob("VERB")
  local pts = {x + 2, y + h - 2}
  for i = 0, 30 do
    local t = i / 30
    pts[#pts + 1] = x + 2 + t * (w - 4)
    pts[#pts + 1] = y + h - 2 - math.exp(-t * 3.5) * (h - 6) * (0.3 + mix * 0.7)
  end
  pts[#pts + 1] = x + w - 2
  pts[#pts + 1] = y + h - 2
  polygon(pts, fade("#37d6c2", 0.35), true)
  -- sparkles drifting up from the tail
  for k = 1, 10 do
    local t = (time() * 0.3 + k * 0.137) % 1
    fillCircle(x + 6 + ((k * 37) % (w - 12)), y + h - 4 - t * (h - 8), 1, fade(colors.fg, 1 - t))
  end
  local sh = toggle("SHIMMER", W / 2 + 4, 30, W / 2 - 18, 12, dip("SETUP", 3))
  if sh ~= dip("SETUP", 3) then setDip("SETUP", 3, sh) end
end

local function setupPage()
  if menu == nil then
    text("SETUP", 14, 16, colors.dim)
    menuPick = list({"Colour theme", "Meters", "About"}, 14, 28, W - 28, H - 44, menuPick)
    if button("OPEN", W - 60, H - 14, 46, 12) then menu = menuPick end
  elseif menu == 1 then
    text("COLOUR THEME", 14, 16, colors.dim)
    local t = list({"Blue TFT", "Amp", "Neon", "Sunset", "Ice", "Phosphor"}, 14, 28, W / 2, H - 44, themeIx)
    if t ~= themeIx then themeIx = t save("theme", t) end
    -- a swatch of the picked theme
    local p = palette(themes[themeIx])
    local sx = W / 2 + 24
    for k, c in ipairs({p.bg, p.fg, p.accent, p.warn, p.good}) do fillRect(sx + (k - 1) * 12, 32, 10, 18, c) end
    if button("BACK", W - 60, H - 14, 46, 12) then menu = nil end
  elseif menu == 2 then
    text("METERS", 14, 16, colors.dim)
    peakHold = toggle("PEAK HOLD", 14, 30, 120, 12, peakHold)
    save("peak", peakHold)
    if button("BACK", W - 60, H - 14, 46, 12) then menu = nil end
  else
    text("COMMAND CENTER", 14, 18, colors.fg)
    text("Comp, drive, chorus, echo, reverb", 14, 30, colors.dim)
    text(string.format("Up %d s", math.floor(time())), 14, 42, colors.dim)
    if button("BACK", W - 60, H - 14, 46, 12) then menu = nil end
  end
end

function draw(dt)
  theme(themes[themeIx] or "tft")
  clear()
  page = tabs({"HOME", "DRIVE", "MOD", "ECHO", "VERB", "SETUP"}, 0, 0, W, 11, page)
  local i = level("In", signal("in"))
  local o = level("Out", signal("out"))
  meters(i, o)
  if page == 1 then home(dt, i, o)
  elseif page == 2 then drivePage()
  elseif page == 3 then modPage()
  elseif page == 4 then echoPage()
  elseif page == 5 then verbPage()
  else setupPage() end
  output("Master", master)
  if not pedalOn() then
    fillRoundRect(W / 2 - 26, H - 12, 52, 10, 2, colors.bad)
    text("BYPASS", W / 2, H - 11, colors.bg, nil, "center")
  end
end

-- a footswitch or knob on the pedal jumps to its page
function onControl(name, value)
  if name == "DRIVE" or name == "TONE" or name == "LEVEL" or name == "SUSTAIN" then page = 2
  elseif name == "RATE" or name == "DEPTH" or name == "MOD" then page = 3
  elseif name == "TIME" or name == "REPEATS" or name == "ECHO" then page = 4
  elseif name == "VERB" then page = 5 end
end
`;

// ------------------------------------------------------------------ Pattern Lab (step sequencer)
export const PATTERN_SCRIPT = `-- Pattern Lab: an 8 step filter sequencer. Draw the steps on the GRID page
-- (they go to the circuit through screen outputs 1 to 8), the playhead comes
-- from the circuit (screen input Pos). The step buttons set the length.
-- SOUND has dials for the knobs, PATTERNS presets and memories, SETUP menus.

local steps = load("steps", {0.2, 0.9, 0.5, 1, 0.1, 0.7, 0.4, 0.8})
local slots = load("slots", {})
local page = 1
local themes = {"tft", "neon", "sunset", "phosphor"}
local themeIx = load("theme", 1)
local style = load("style", 1)
local menu = nil
local pick = 1
local clock = 0
local storing = false
local dirty = false
local shapes = {"Ramp up", "Ramp down", "Pulse", "Octaves", "Zigzag", "Random"}

local function shape(k)
  local s = {}
  for i = 1, 8 do
    local v
    if k == 1 then v = (i - 1) / 7
    elseif k == 2 then v = 1 - (i - 1) / 7
    elseif k == 3 then v = (i % 2 == 1) and 1 or 0.1
    elseif k == 4 then v = ({0.2, 0.2, 0.7, 0.2, 1, 0.2, 0.7, 0.45})[i]
    elseif k == 5 then v = (i % 4) / 3
    else v = math.random() end
    s[i] = v
  end
  return s
end

local function length() return switch("LENGTH") end

-- the step that plays now: from the circuit, or our own clock while it is not playing
local function current(dt)
  local pos = input("Pos")
  local cut = input("Step")
  if pos > 0 or cut > 0 then return math.floor(pos * 7 + 0.5) + 1 end
  local hz = 0.5 * 32 ^ knob("RATE")
  clock = clock + dt * hz
  return math.floor(clock) % length() + 1
end

local function grid(now)
  local n = length()
  local x0, y0 = 6, 16
  local w = math.floor((W - 12) / 8)
  local h = H - 44
  for i = 1, 8 do
    local x = x0 + (i - 1) * w
    local live = i <= n
    local v = steps[i]
    local c = i == now and colors.accent or (live and colors.fg or colors.dim)
    fillRect(x + 1, y0, w - 3, h, colors.panel)
    if style == 1 then
      fillRect(x + 1, y0 + h - v * h, w - 3, v * h, live and fade(c, i == now and 1 or 0.7) or fade(colors.dim, 0.5))
    else
      fillCircle(x + w / 2 - 1, y0 + h - v * h, 4, c)
    end
    if i == now then
      glow(5, colors.accent)
      rect(x + 1, y0, w - 3, h, colors.accent)
      glow(0)
    end
    text(tostring(i), x + w / 2 - 1, y0 + h + 2, live and colors.fg or colors.dim, nil, "center")
    -- drag on a column to draw the step
    if mouse.down and inside(x, y0, w, h) then
      steps[i] = math.clamp(1 - (mouse.y - y0) / h, 0, 1)
      dirty = true
    end
  end
  -- the filter as it moves (screen input Step)
  local cut = input("Step")
  if cut <= 0 then cut = steps[now] end
  graph(6, H - 16, W - 12, 12, history("cut", cut, 80), colors.accent, 0, 1)
  text("LEN " .. n, W - 6, 4, colors.dim, nil, "right")
end

local function sound()
  local names = {"RATE", "GLIDE", "RES", "MIX"}
  local step = math.floor(W / 4)
  for k, name in ipairs(names) do
    local v = dial(name, step * (k - 0.5), 34, 13, knob(name))
    if math.abs(v - knob(name)) > 0.001 then setKnob(name, v) end
  end
  local types = {"LOW", "BAND", "HIGH"}
  local tw = math.floor((W - 20) / 3)
  for k, t in ipairs(types) do
    local x = 10 + (k - 1) * tw
    local on = switch("TYPE") == k
    if on then fillRoundRect(x, 64, tw - 4, 14, 3, colors.accent) else roundRect(x, 64, tw - 4, 14, 3, colors.dim) end
    text(t, x + (tw - 4) / 2, 68, on and colors.bg or colors.fg, nil, "center")
    if tapped(x, 64, tw - 4, 14) then setSwitch("TYPE", k) end
  end
  local hz = 0.5 * 32 ^ knob("RATE")
  text(string.format("%.1f steps a second, %d steps", hz, length()), W / 2, 86, colors.dim, nil, "center")
  -- a little filter sweep preview
  local pts = {}
  for i = 0, 40 do
    local s = steps[math.floor(i / 5) % 8 + 1]
    pts[#pts + 1] = 10 + i * (W - 20) / 40
    pts[#pts + 1] = H - 6 - s * (H - 104)
  end
  polyline(pts, colors.accent, 1)
end

local function patterns()
  text("PRESETS", 6, 16, colors.dim)
  pick = list(shapes, 6, 26, W / 2 - 12, H - 32, pick)
  if button("USE", W / 2 - 40, 14, 34, 10) then steps = shape(pick) dirty = true end
  text("MEMORY", W / 2 + 6, 16, colors.dim)
  storing = toggle("STORE", W - 62, 14, 56, 10, storing)
  for k, name in ipairs({"A", "B", "C", "D"}) do
    local x = W / 2 + 6 + ((k - 1) % 2) * 50
    local y = 30 + math.floor((k - 1) / 2) * 30
    local full = slots[name] ~= nil
    if button(name .. (full and " *" or ""), x, y, 44, 24) then
      if storing then
        local c = {}
        for i = 1, 8 do c[i] = steps[i] end
        slots[name] = c
        save("slots", slots)
        storing = false
      elseif full then
        for i = 1, 8 do steps[i] = slots[name][i] end
        dirty = true
      end
    end
  end
end

local function setup()
  if menu == nil then
    pick = list({"Colour theme", "Step look", "Clear steps"}, 6, 16, W - 12, H - 34, pick)
    if button("OPEN", W - 52, H - 14, 46, 12) then menu = pick end
    return
  end
  if menu == 1 then
    local t = list({"Blue", "Neon", "Sunset", "Phosphor"}, 6, 16, W / 2, H - 34, themeIx)
    if t ~= themeIx then themeIx = t save("theme", t) end
  elseif menu == 2 then
    local s = list({"Bars", "Dots"}, 6, 16, W / 2, 30, style)
    if s ~= style then style = s save("style", s) end
  else
    text("Clear all 8 steps?", 6, 18, colors.fg)
    if button("YES", 6, 32, 50, 16) then
      for i = 1, 8 do steps[i] = 0.5 end
      dirty = true
      menu = nil
    end
    if button("NO", 62, 32, 50, 16) then menu = nil end
  end
  if menu ~= nil and button("BACK", W - 52, H - 14, 46, 12) then menu = nil end
end

function draw(dt)
  theme(themes[themeIx] or "tft")
  clear()
  page = tabs({"GRID", "SOUND", "PATTERNS", "SETUP"}, 0, 0, W, 11, page)
  local now = current(dt)
  if page == 1 then grid(now)
  elseif page == 2 then sound()
  elseif page == 3 then patterns()
  else setup() end
  -- the steps go to the circuit every frame
  for i = 1, 8 do output(i, steps[i]) end
  if dirty and not mouse.down then save("steps", steps) dirty = false end
  if not pedalOn() then text("BYPASS", W - 6, H - 9, colors.warn, nil, "right") end
end
`;
