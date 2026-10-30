// The screen script API reference: used by the editor's reference panel and highlighter, and to write
// docs/screen-scripts.md. [name, signature, description]
export const API = [
  {
    group: 'Running',
    intro: 'Code at the top runs once when the screen starts. Then draw() runs for every frame (about 20 to 30 a second).',
    items: [
      ['draw', 'function draw(dt) ... end', 'Called every frame. dt = seconds since the last frame. Draw the whole screen here.'],
      ['update', 'function update(dt) ... end', 'Optional, runs before draw() every frame.'],
      ['setup', 'function setup() ... end', 'Optional, runs once after the top level code.'],
      ['onPress', 'function onPress(x, y) ... end', 'The screen was touched (clicked) at x, y.'],
      ['onMove', 'function onMove(x, y) ... end', 'The pointer moved while pressed.'],
      ['onRelease', 'function onRelease(x, y) ... end', 'The touch ended.'],
      ['onWheel', 'function onWheel(d, x, y) ... end', 'Mouse wheel over the screen: d is 1 (up) or -1 (down).'],
      ['onControl', 'function onControl(name, value) ... end', 'A control on the pedal changed (knob turned, switch flipped).'],
      ['onFoot', 'function onFoot(name, on) ... end', 'A footswitch was pressed.'],
      ['onKey', 'function onKey(key) ... end', 'A key was typed while the screen has focus (click it first).'],
    ],
  },
  {
    group: 'Screen',
    intro: 'Coordinates are pixels from the top left corner. W and H are the screen size in pixels.',
    items: [
      ['W', 'W, H', 'Width and height of the screen in pixels.'],
      ['screen', 'screen.type, screen.name', 'The screen type (oled, lcd, amber, tft) and its label.'],
      ['clear', 'clear([color])', 'Fill the whole screen (default: the theme background).'],
      ['pixel', 'pixel(x, y, [color])', 'One pixel.'],
      ['line', 'line(x1, y1, x2, y2, [color], [width])', 'A straight line.'],
      ['rect', 'rect(x, y, w, h, [color], [width])', 'Outline of a box.'],
      ['fillRect', 'fillRect(x, y, w, h, [color])', 'A filled box.'],
      ['roundRect', 'roundRect(x, y, w, h, r, [color])', 'Outline of a box with round corners.'],
      ['fillRoundRect', 'fillRoundRect(x, y, w, h, r, [color])', 'A filled box with round corners.'],
      ['circle', 'circle(x, y, r, [color], [width])', 'Outline of a circle (x, y is the centre).'],
      ['fillCircle', 'fillCircle(x, y, r, [color])', 'A filled circle.'],
      ['arc', 'arc(x, y, r, from, to, [color], [width])', 'Part of a circle. Angles in degrees, 0 is up, going clockwise.'],
      ['pie', 'pie(x, y, r, from, to, [color])', 'A filled slice.'],
      ['polygon', 'polygon({x1, y1, x2, y2, ...}, [color], [filled])', 'A shape through the points.'],
      ['polyline', 'polyline({x1, y1, ...}, [color], [width])', 'Connected lines.'],
      ['gradient', 'gradient(x, y, w, h, color1, color2, [vertical])', 'A box that fades between two colours.'],
      ['sprite', 'sprite({"..##..", ".####."}, x, y, [scale], {["#"] = "fg"})', 'Pixel art from strings: each character is one pixel, "." is empty.'],
      ['icon', 'icon(name, x, y, [size], [color])', 'A built in icon. icons() lists the names (play, stop, record, heart, star, bolt, note, gear, power, ...).'],
      ['scanlines', 'scanlines([amount], [step])', 'Dark lines across the screen, like an old CRT.'],
      ['glow', 'glow(radius, [color])', 'Everything drawn after this glows. glow(0) turns it off.'],
      ['alpha', 'alpha(a)', 'See through drawing from 0 (invisible) to 1.'],
      ['lineWidth', 'lineWidth(w)', 'Default width for lines and outlines.'],
      ['clip', 'clip(x, y, w, h) ... unclip()', 'Only draw inside a box.'],
      ['push', 'push() ... pop()', 'Save and restore translate / rotate / scale.'],
      ['translate', 'translate(x, y), rotate(deg), scale(k)', 'Move, turn or scale what you draw next.'],
    ],
  },
  {
    group: 'Text',
    intro: 'Fonts: pixel (crisp 5x7), mono, sans, condensed, bold, digits (seven segment). Sizes are pixels or tiny, small, normal, big, huge.',
    items: [
      ['text', 'text(s, x, y, [color], [size], [align], [font])', 'Draw text with its top left at x, y. align: left, center, right, or middle (centred both ways). Returns the width.'],
      ['font', 'font(name, [size])', 'Set the default font and size.'],
      ['textWidth', 'textWidth(s, [size], [font])', 'How wide a text would be.'],
      ['digits', 'digits(s, x, y, [size], [color], [unlit color])', 'Seven segment digits, like a pedal display. Give an unlit colour to show the dark segments.'],
    ],
  },
  {
    group: 'Colours',
    intro: 'A colour is "#rrggbb", a name (red, green, cyan, amber, white ...), or a theme colour: bg, fg, dim, accent, warn, good, bad, panel.',
    items: [
      ['color', 'color(c)', 'Default colour for everything drawn after this.'],
      ['theme', 'theme(name)', 'Switch the theme: oled, lcd, amber, tft, phosphor, ice, sunset, paper, neon, mono, amp, pico. Returns the colours.'],
      ['colors', 'colors.bg, colors.fg, colors.accent ...', 'The colours of the current theme.'],
      ['palette', 'palette(name)', 'The colours of a theme, without switching to it.'],
      ['rgb', 'rgb(r, g, b, [a])', 'A colour from 0 to 255 values.'],
      ['hsv', 'hsv(hue, sat, val)', 'A colour from hue (0 to 360), saturation and value (0 to 1).'],
      ['mix', 'mix(c1, c2, t)', 'A colour between two others (t from 0 to 1).'],
      ['fade', 'fade(c, a)', 'A see through version of a colour.'],
    ],
  },
  {
    group: 'Meters',
    items: [
      ['bar', 'bar(x, y, w, h, value, [color], [back])', 'A bar filled from 0 to 1 (vertical when taller than wide).'],
      ['meter', 'meter(x, y, w, h, value, [segments])', 'An LED meter: green, yellow, red.'],
      ['ring', 'ring(x, y, r, value, [color], [width])', 'A round progress ring, like a knob.'],
      ['gauge', 'gauge(x, y, r, value, [color], [from], [to])', 'A needle meter (angles in degrees, default -60 to 60).'],
      ['graph', 'graph(x, y, w, h, values, [color], [min], [max], [filled])', 'A line graph of a list of numbers.'],
      ['history', 'history(name, value, [count])', 'Keep the last values of something, for graph().'],
    ],
  },
  {
    group: 'Widgets',
    intro: 'Call widgets inside draw(). They draw themselves and return what the user did, so you can write: if button("Tap", 2, 2, 30, 12) then ... end',
    items: [
      ['button', 'button(label, x, y, w, h)', 'Returns true when it was clicked.'],
      ['toggle', 'on = toggle(label, x, y, w, h, on)', 'A switch. Returns the new state.'],
      ['slider', 'v = slider(label, x, y, w, h, v, [min], [max])', 'Drag (or wheel) to change. Vertical when tall.'],
      ['dial', 'v = dial(label, x, y, r, v)', 'A round knob: drag up and down.'],
      ['list', 'i = list(items, x, y, w, h, i)', 'A scrolling menu. Returns the picked item number.'],
      ['tabs', 'i = tabs({"A", "B"}, x, y, w, h, i)', 'Tabs across the screen.'],
      ['pager', 'page = pager(count, page, [x], [y], [w], [h])', 'Arrows and dots to flip between pages.'],
      ['textfield', 's = textfield(name, x, y, w, h, s, [max])', 'Click to type: an on screen keyboard opens, and the computer keyboard works too.'],
      ['tapped', 'tapped(x, y, w, h)', 'True when the area was clicked this frame.'],
      ['inside', 'inside(x, y, w, h)', 'True when the pointer is over the area.'],
      ['mouse', 'mouse.x, mouse.y, mouse.down, mouse.pressed, mouse.released', 'The pointer this frame.'],
      ['focused', 'focused()', 'True while a text field has the keyboard.'],
    ],
  },
  {
    group: 'Controls',
    intro: 'Controls are found by their label (any case), by number ("Knob 2" or knob(2)), or footswitches by letter ("A").',
    items: [
      ['knob', 'knob(name)', 'A knob, slider or treadle, from 0 to 1.'],
      ['setKnob', 'setKnob(name, value)', 'Turn a knob (0 to 1). Saved and undoable like turning it by hand.'],
      ['switch', 'switch(name)', 'Position of a toggle or rotary switch, from 1.'],
      ['setSwitch', 'setSwitch(name, position)', 'Flip a switch.'],
      ['dip', 'dip(n) or dip(label, n)', 'A DIP switch: true when on.'],
      ['setDip', 'setDip(n, on) or setDip(label, n, on)', 'Flip a DIP switch.'],
      ['footswitch', 'footswitch(name)', 'True when the footswitch is on (for the bypass switch: the pedal is on).'],
      ['setFootswitch', 'setFootswitch(name, on)', 'Press a latching footswitch.'],
      ['pushbutton', 'pushbutton(name)', 'A latching push button.'],
      ['setPushbutton', 'setPushbutton(name, on)', 'Set a latching push button.'],
      ['ctl', 'ctl(name), setCtl(name, value)', 'Any control by name.'],
      ['valueText', 'valueText(name)', 'The value as the pedal shows it, like "420 ms".'],
      ['controls', 'controls([kind])', 'Names of the controls (kind: knob, switch, dip, foot, button).'],
      ['controlInfo', 'controlInfo(name)', 'A table with name, kind, label, positions and options.'],
      ['pedalOn', 'pedalOn(), setPedalOn(on)', 'Is the pedal on (not bypassed)?'],
      ['bypassed', 'bypassed()', 'True when the pedal is off.'],
      ['lastControl', 'lastControl()', 'The control that changed last: {name, value, ago} (ago in seconds).'],
    ],
  },
  {
    group: 'Circuit',
    intro: 'Signals come from the circuit in the wiring diagram. in and out are the input and output levels (0 to 1).',
    items: [
      ['signal', 'signal(name)', 'Read a signal: in, out, inDb, outDb, env (smoothed input), on, lfo, tempo, or a stage value like "delay.time" or "overdrive.gain".'],
      ['setInput', 'setInput(name, value)', 'Write a circuit input, like setInput("delay.time", 350). Goes through the control wired to it.'],
      ['signals', 'signals()', 'Names of the signals this pedal has.'],
    ],
  },
  {
    group: 'Time and memory',
    items: [
      ['time', 'time()', 'Seconds since the screen started.'],
      ['dt', 'dt()', 'Seconds since the last frame.'],
      ['frame', 'frame()', 'Frame counter.'],
      ['every', 'every(ms)', 'True once every ms milliseconds (each every() call keeps its own timer).'],
      ['blink', 'blink([ms])', 'Switches between true and false, for blinking things.'],
      ['save', 'save(key, value)', 'Keep a value with the preset (numbers, text, true / false, tables).'],
      ['load', 'load(key, [default])', 'Read a kept value back.'],
      ['print', 'print(...)', 'Show values in the editor console.'],
    ],
  },
  {
    group: 'Language',
    intro: 'Screen scripts use a small Lua: local x = 1, if ... then ... elseif ... else ... end, for i = 1, 10 do ... end, while ... do ... end, function name(a, b) ... end, tables {1, 2, x = 3}. Comments start with --. Also allowed: x += 1, != for not equal.',
    items: [
      ['math', 'math.floor, ceil, abs, min, max, sqrt, sin, cos, pi, random, clamp, lerp, round, map', 'Maths. math.clamp(v, lo, hi), math.map(v, a, b, c, d) and math.round(v, digits) are extras.'],
      ['string', 's:upper(), s:sub(i, j), s:rep(n), #s, string.format("%.1f", v), s:split(","), s:trim()', 'Text. Join text with .. (two dots).'],
      ['table', 'table.insert(t, v), table.remove(t), table.concat(t, ", "), table.sort(t), #t', 'Lists start at 1.'],
      ['pairs', 'for k, v in pairs(t) do ... end, for i, v in ipairs(list) do ... end', 'Loop over a table.'],
      ['tostring', 'tostring(v), tonumber(s), type(v)', 'Conversions.'],
      ['pcall', 'ok, err = pcall(fn, ...)', 'Run a function and catch its error.'],
    ],
  },
];

// every name the highlighter shows as an API word
export const API_NAMES = new Set();
for (const g of API) for (const [n] of g.items) API_NAMES.add(n);
for (const n of ['H', 'icons', 'palettes', 'unclip', 'pop', 'rotate', 'scale', 'smooth', 'setCtl', 'setPedalOn', 'ipairs', 'tonumber', 'type', 'error', 'assert', 'select', 'unpack', 'next']) API_NAMES.add(n);

/** The reference as Markdown. */
export function apiMarkdown() {
  const out = [];
  for (const g of API) {
    out.push(`## ${g.group}`, '');
    if (g.intro) out.push(g.intro, '');
    out.push('| Call | What it does |', '| --- | --- |');
    for (const [, sig, desc] of g.items) out.push(`| \`${sig.replace(/\|/g, '\\|')}\` | ${desc.replace(/\|/g, '\\|')} |`);
    out.push('');
  }
  return out.join('\n');
}
