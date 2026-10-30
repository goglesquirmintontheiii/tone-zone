// Starting points for a custom screen, and small snippets the editor can insert.
const q = (s) => JSON.stringify(String(s));

/** Templates take the design's control names so the code works right away. */
export const TEMPLATES = [
  {
    id: 'hello',
    name: 'Hello',
    desc: 'Text and a blinking dot',
    make: (o) => `-- A first screen: some text and a dot that blinks
-- draw() runs for every frame. W and H are the screen size in pixels.

function draw()
  clear()
  text(${q(o.title || 'HELLO')}, W / 2, H / 2 - 6, colors.fg, 14, "center")
  text("pedal is " .. (pedalOn() and "on" or "off"), W / 2, H / 2 + 10, fade(colors.fg, 0.6), nil, "center")
  if blink(500) then
    fillCircle(W - 6, 6, 2, colors.accent)
  end
end
`,
  },
  {
    id: 'readout',
    name: 'Control values',
    desc: 'Every knob with a bar and its value',
    make: (o) => {
      const knobs = o.controls.filter((c) => c.kind === 'knob').map((c) => c.name).slice(0, 5);
      return `-- Shows the pedal's knobs as bars with their values

local names = {${(knobs.length ? knobs : ['Knob 1']).map(q).join(', ')}}

function draw()
  clear()
  local rh = math.floor(H / #names)
  for i, name in ipairs(names) do
    local y = (i - 1) * rh
    text(name:upper(), 2, y + (rh - 7) / 2)
    bar(W * 0.42, y + 2, W * 0.36, rh - 4, knob(name))
    text(valueText(name), W - 2, y + (rh - 7) / 2, colors.fg, nil, "right")
  end
end
`;
    },
  },
  {
    id: 'touch',
    name: 'Touch controls',
    desc: 'Buttons, a toggle and a slider that change the pedal',
    make: (o) => {
      const knob = o.controls.find((c) => c.kind === 'knob');
      const dip = o.controls.find((c) => c.kind === 'dip');
      const sw = o.controls.find((c) => c.kind === 'switch');
      return `-- Widgets on the screen that change the pedal's controls.
-- Widgets draw themselves and return what the user did.

function draw()
  clear()
${knob ? `  -- a slider that moves the ${knob.name} knob
  local v = slider(${q(knob.name.toUpperCase())}, 2, 2, W - 4, 12, knob(${q(knob.name)}))
  setKnob(${q(knob.name)}, v)
` : '  -- (this pedal has no knob for a slider)\n'}
${dip ? `  -- a toggle for a DIP switch
  setCtl(${q(dip.name)}, toggle(${q(dip.name.toUpperCase())}, 2, 17, W / 2 - 4, 12, ctl(${q(dip.name)})))
` : ''}${sw ? `  -- a button that steps through the ${sw.name} switch
  if button(${q(sw.name.toUpperCase())}, W / 2 + 2, 17, W / 2 - 4, 12) then
    local info = controlInfo(${q(sw.name)})
    setSwitch(${q(sw.name)}, switch(${q(sw.name)}) % info.positions + 1)
  end
` : ''}  -- the bypass footswitch
  if button(pedalOn() and "ON" or "OFF", 2, H - 14, 40, 12) then
    setPedalOn(not pedalOn())
  end
end
`;
    },
  },
  {
    id: 'meter',
    name: 'Level meter',
    desc: 'Input and output meters with a graph',
    make: () => `-- Input and output level from the circuit, with a scrolling graph

function draw()
  clear()
  local i, o = signal("in"), signal("out")
  text("IN", 2, 2, colors.dim)
  meter(16, 2, W - 18, 7, i)
  text("OUT", 2, 12, colors.dim)
  meter(16, 12, W - 18, 7, o)
  graph(2, 22, W - 4, H - 24, history("out", o), colors.accent, 0, 1, true)
end
`,
  },
  {
    id: 'pages',
    name: 'Menu pages',
    desc: 'Tabs, a list and a text field',
    make: (o) => `-- Three pages: a menu list, a name you can type, and info.

local page = 1
local pick = 1
local name = load("name", ${q(o.title || 'MY PEDAL')})
local items = {"Clean", "Crunch", "Lead", "Ambient", "Fuzz", "Bass"}

function draw()
  clear()
  page = tabs({"MENU", "NAME", "INFO"}, 0, 0, W, 10, page)
  if page == 1 then
    pick = list(items, 0, 12, W, H - 12, pick)
  elseif page == 2 then
    text("Click to rename", 2, 14, colors.dim)
    local n = textfield("name", 2, 24, W - 4, 12, name)
    if n ~= name then name = n save("name", n) end
  else
    text(name, 2, 14, colors.fg)
    text("Preset: " .. items[pick], 2, 24, colors.dim)
    text(string.format("Up %.0f s", time()), 2, 34, colors.dim)
  end
end
`,
  },
];

export const SNIPPETS = [
  ['Draw loop', 'function draw()\n  clear()\n  text("Hi", 2, 2)\nend\n'],
  ['Button that sets a knob', 'if button("MAX", 2, 2, 30, 12) then\n  setKnob("Gain", 1)\nend\n'],
  ['Toggle a DIP switch', 'setDip(1, toggle("BOOST", 2, 2, 60, 12, dip(1)))\n'],
  ['Slider for a knob', 'setKnob("Level", slider("LEVEL", 2, 2, W - 4, 12, knob("Level")))\n'],
  ['Blink', 'if blink(400) then\n  fillCircle(W - 5, 5, 2, colors.bad)\nend\n'],
  ['Graph of the input', 'graph(0, 0, W, H, history("in", signal("in")), colors.fg, 0, 1)\n'],
  ['Level meter', 'meter(2, H - 8, W - 4, 6, signal("out"))\n'],
  ['Big digits', 'digits(string.format("%02d", 7), 4, 4, 24, colors.fg, colors.dim)\n'],
  ['Pages', 'page = pager(3, page or 1)\n'],
  ['Text field', 'name = textfield("name", 2, 2, W - 4, 12, name or "")\n'],
  ['Every second', 'if every(1000) then\n  count = (count or 0) + 1\nend\n'],
  ['React to a knob', 'function onControl(name, value)\n  print(name, value)\nend\n'],
  ['Touch anywhere', 'function onPress(x, y)\n  print("touched", x, y)\nend\n'],
  ['Save a value', 'save("count", count)\ncount = load("count", 0)\n'],
  ['Pixel sprite', 'sprite({\n  "..##..",\n  ".####.",\n  "##..##",\n  "######",\n}, 4, 4, 2, {["#"] = colors.accent})\n'],
  ['Icon', 'icon("heart", 2, 2, 12, colors.bad)\n'],
];

export const DEFAULT_SCRIPT = (o) => TEMPLATES[0].make(o);
