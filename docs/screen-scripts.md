# Screen scripts

A screen on a Pedal Factory pedal can show plain text or custom graphics. Custom graphics come from a small
script: you draw text, pixels, shapes, meters and widgets, react to touches, and read or change the pedal's
controls and the signals of its circuit.

## Getting started

1. In the Pedal Factory, select a screen.
2. Set **Shows** to **Custom**. The screen gets a starting script.
3. Click **Edit code**. The code is on the left and a live preview of the screen is on the right. The preview
   updates as you type. Use the **Test** tab to move simulated controls and signals, **Reference** for every
   call, and **Examples** for templates and snippets.
4. Or click **Generate**: pick a look (amp sim LCD, green phosphor, modern OLED, colour dashboard, VU meter,
   tuner, preset digits, pixel art) and what to show, and you get readable code to change further.

The script runs in the factory preview, in Test mode (where the screen can be clicked) and on the board in every
saved pedal. **Pixels** in the inspector sets the resolution (Coarse 3, Normal 4, Fine 6 pixels per millimetre).

```lua
-- a knob readout with a button that maxes the gain
function draw()
  clear()
  text("GAIN", 4, 4, colors.dim)
  text(valueText("Gain"), 4, 14, colors.fg, 16, nil, "condensed")
  bar(4, H - 10, W - 8, 6, knob("Gain"))
  if button("MAX", W - 34, 4, 30, 14) then
    setKnob("Gain", 1)
  end
end
```

## How a script runs

* The top of the script runs once when the screen starts (set up variables here).
* `draw()` runs for every frame, about 20 to 30 times a second. Draw the whole screen there, starting with
  `clear()`. On the board, screens only repaint while the pedal is in view.
* Event functions (`onPress`, `onControl`, `onFoot` ...) run when something happens.
* Variables keep their values while the screen runs. `save(key, value)` keeps a value with the preset so it
  is still there next time.
* Setting a control from a script (`setKnob`, `setDip` ...) works like turning it by hand: the value is saved
  with the preset, can be undone, and the circuit follows. A burst of changes is one undo step.

## The language

Screen scripts use a small version of Lua. If you know a little Lua (or BASIC, or Python) you can read it.

```lua
local count = 0              -- a variable (local to this script)
local names = {"A", "B"}     -- a list, starts at 1
local p = {x = 1, y = 2}     -- a table with fields

function add(a, b)           -- a function
  return a + b
end

for i = 1, 10 do ... end     -- loops
for i, name in ipairs(names) do ... end
while count < 5 do count += 1 end

if count > 3 then ... elseif count == 2 then ... else ... end
text("n = " .. count, 2, 2)  -- .. joins text
```

Not supported: `goto`, `...` (variable arguments), metatables and Lua patterns (`string.find` and
`gsub` match plain text). Extras for convenience: `x += 1` (also `-=`, `*=`, `/=`, `..=`), `!=` for
not equal, `math.clamp`, `math.map`, `math.round`, `math.lerp`, `s:split(sep)`, `s:trim()`.

### Safety

Scripts run in a sandbox: they can only call the functions on this page, with no access to the app, files,
network or other pedals. Each frame has a work budget, so a loop that never ends is stopped (the screen shows
the error and its line) instead of freezing the app. Errors never crash the app: the screen shows
`ERROR LINE n` and the editor marks the line.

# API reference

## Running

Code at the top runs once when the screen starts. Then draw() runs for every frame (about 20 to 30 a second).

| Call | What it does |
| --- | --- |
| `function draw(dt) ... end` | Called every frame. dt = seconds since the last frame. Draw the whole screen here. |
| `function update(dt) ... end` | Optional, runs before draw() every frame. |
| `function setup() ... end` | Optional, runs once after the top level code. |
| `function onPress(x, y) ... end` | The screen was touched (clicked) at x, y. |
| `function onMove(x, y) ... end` | The pointer moved while pressed. |
| `function onRelease(x, y) ... end` | The touch ended. |
| `function onWheel(d, x, y) ... end` | Mouse wheel over the screen: d is 1 (up) or -1 (down). |
| `function onControl(name, value) ... end` | A control on the pedal changed (knob turned, switch flipped). |
| `function onFoot(name, on) ... end` | A footswitch was pressed. |
| `function onKey(key) ... end` | A key was typed while the screen has focus (click it first). |

## Screen

Coordinates are pixels from the top left corner. W and H are the screen size in pixels.

| Call | What it does |
| --- | --- |
| `W, H` | Width and height of the screen in pixels. |
| `screen.type, screen.name` | The screen type (oled, lcd, amber, tft) and its label. |
| `clear([color])` | Fill the whole screen (default: the theme background). |
| `pixel(x, y, [color])` | One pixel. |
| `line(x1, y1, x2, y2, [color], [width])` | A straight line. |
| `rect(x, y, w, h, [color], [width])` | Outline of a box. |
| `fillRect(x, y, w, h, [color])` | A filled box. |
| `roundRect(x, y, w, h, r, [color])` | Outline of a box with round corners. |
| `fillRoundRect(x, y, w, h, r, [color])` | A filled box with round corners. |
| `circle(x, y, r, [color], [width])` | Outline of a circle (x, y is the centre). |
| `fillCircle(x, y, r, [color])` | A filled circle. |
| `arc(x, y, r, from, to, [color], [width])` | Part of a circle. Angles in degrees, 0 is up, going clockwise. |
| `pie(x, y, r, from, to, [color])` | A filled slice. |
| `polygon({x1, y1, x2, y2, ...}, [color], [filled])` | A shape through the points. |
| `polyline({x1, y1, ...}, [color], [width])` | Connected lines. |
| `gradient(x, y, w, h, color1, color2, [vertical])` | A box that fades between two colours. |
| `sprite({"..##..", ".####."}, x, y, [scale], {["#"] = "fg"})` | Pixel art from strings: each character is one pixel, "." is empty. |
| `icon(name, x, y, [size], [color])` | A built in icon. icons() lists the names (play, stop, record, heart, star, bolt, note, gear, power, ...). |
| `scanlines([amount], [step])` | Dark lines across the screen, like an old CRT. |
| `glow(radius, [color])` | Everything drawn after this glows. glow(0) turns it off. |
| `alpha(a)` | See through drawing from 0 (invisible) to 1. |
| `lineWidth(w)` | Default width for lines and outlines. |
| `clip(x, y, w, h) ... unclip()` | Only draw inside a box. |
| `push() ... pop()` | Save and restore translate / rotate / scale. |
| `translate(x, y), rotate(deg), scale(k)` | Move, turn or scale what you draw next. |

## Text

Fonts: pixel (crisp 5x7), mono, sans, condensed, bold, digits (seven segment). Sizes are pixels or tiny, small, normal, big, huge.

| Call | What it does |
| --- | --- |
| `text(s, x, y, [color], [size], [align], [font])` | Draw text with its top left at x, y. align: left, center, right, or middle (centred both ways). Returns the width. |
| `font(name, [size])` | Set the default font and size. |
| `textWidth(s, [size], [font])` | How wide a text would be. |
| `digits(s, x, y, [size], [color], [unlit color])` | Seven segment digits, like a pedal display. Give an unlit colour to show the dark segments. |

## Colours

A colour is "#rrggbb", a name (red, green, cyan, amber, white ...), or a theme colour: bg, fg, dim, accent, warn, good, bad, panel.

| Call | What it does |
| --- | --- |
| `color(c)` | Default colour for everything drawn after this. |
| `theme(name)` | Switch the theme: oled, lcd, amber, tft, phosphor, ice, sunset, paper, neon, mono, amp, pico. Returns the colours. |
| `colors.bg, colors.fg, colors.accent ...` | The colours of the current theme. |
| `palette(name)` | The colours of a theme, without switching to it. |
| `rgb(r, g, b, [a])` | A colour from 0 to 255 values. |
| `hsv(hue, sat, val)` | A colour from hue (0 to 360), saturation and value (0 to 1). |
| `mix(c1, c2, t)` | A colour between two others (t from 0 to 1). |
| `fade(c, a)` | A see through version of a colour. |

## Meters

| Call | What it does |
| --- | --- |
| `bar(x, y, w, h, value, [color], [back])` | A bar filled from 0 to 1 (vertical when taller than wide). |
| `meter(x, y, w, h, value, [segments])` | An LED meter: green, yellow, red. |
| `ring(x, y, r, value, [color], [width])` | A round progress ring, like a knob. |
| `gauge(x, y, r, value, [color], [from], [to])` | A needle meter (angles in degrees, default -60 to 60). |
| `graph(x, y, w, h, values, [color], [min], [max], [filled])` | A line graph of a list of numbers. |
| `history(name, value, [count])` | Keep the last values of something, for graph(). |

## Widgets

Call widgets inside draw(). They draw themselves and return what the user did, so you can write: if button("Tap", 2, 2, 30, 12) then ... end

| Call | What it does |
| --- | --- |
| `button(label, x, y, w, h)` | Returns true when it was clicked. |
| `on = toggle(label, x, y, w, h, on)` | A switch. Returns the new state. |
| `v = slider(label, x, y, w, h, v, [min], [max])` | Drag (or wheel) to change. Vertical when tall. |
| `v = dial(label, x, y, r, v)` | A round knob: drag up and down. |
| `i = list(items, x, y, w, h, i)` | A scrolling menu. Returns the picked item number. |
| `i = tabs({"A", "B"}, x, y, w, h, i)` | Tabs across the screen. |
| `page = pager(count, page, [x], [y], [w], [h])` | Arrows and dots to flip between pages. |
| `s = textfield(name, x, y, w, h, s, [max])` | Click to type: an on screen keyboard opens, and the computer keyboard works too. |
| `tapped(x, y, w, h)` | True when the area was clicked this frame. |
| `inside(x, y, w, h)` | True when the pointer is over the area. |
| `mouse.x, mouse.y, mouse.down, mouse.pressed, mouse.released` | The pointer this frame. |
| `focused()` | True while a text field has the keyboard. |

## Controls

Controls are found by their label (any case), by number ("Knob 2" or knob(2)), or footswitches by letter ("A").

| Call | What it does |
| --- | --- |
| `knob(name)` | A knob, slider or treadle, from 0 to 1. |
| `setKnob(name, value)` | Turn a knob (0 to 1). Saved and undoable like turning it by hand. |
| `switch(name)` | Position of a toggle or rotary switch, from 1. |
| `setSwitch(name, position)` | Flip a switch. |
| `dip(n) or dip(label, n)` | A DIP switch: true when on. |
| `setDip(n, on) or setDip(label, n, on)` | Flip a DIP switch. |
| `footswitch(name)` | True when the footswitch is on (for the bypass switch: the pedal is on). |
| `setFootswitch(name, on)` | Press a latching footswitch. |
| `pushbutton(name)` | A latching push button. |
| `setPushbutton(name, on)` | Set a latching push button. |
| `ctl(name), setCtl(name, value)` | Any control by name. |
| `valueText(name)` | The value as the pedal shows it, like "420 ms". |
| `controls([kind])` | Names of the controls (kind: knob, switch, dip, foot, button). |
| `controlInfo(name)` | A table with name, kind, label, positions and options. |
| `pedalOn(), setPedalOn(on)` | Is the pedal on (not bypassed)? |
| `bypassed()` | True when the pedal is off. |
| `lastControl()` | The control that changed last: {name, value, ago} (ago in seconds). |

## Circuit

Signals come from the circuit in the wiring diagram. in and out are the input and output levels (0 to 1).

| Call | What it does |
| --- | --- |
| `signal(name)` | Read a signal: in, out, inDb, outDb, env (smoothed input), on, lfo, tempo, or a stage value like "delay.time" or "overdrive.gain". |
| `setInput(name, value)` | Write a circuit input, like setInput("delay.time", 350). Goes through the control wired to it. |
| `signals()` | Names of the signals this pedal has. |

### The screen's own inputs and outputs

A screen can have up to 16 inputs and 16 outputs, each analog (a number from -255 to 255) or binary (0 or 1).
Add them in the screen's inspector (Inputs and outputs) or with the +in and +out buttons on the screen's box in
the wiring diagram, then wire them there: a circuit output (Analog output or Binary output part) into a screen
input, a screen output into circuit inputs (the value goes in as it is, kept within the input's range).

| Call | What it does |
| --- | --- |
| `input(n)` | The value wired into input n (1 for the first), or by name: input("Level"). 0 when nothing is wired or the pedal is not playing. |
| `output(n, value)` | Set output n (or by name): output("Set", 120). Binary outputs take true / false or 0 / 1. |
| `outputValue(n)` | What output n is set to now. |
| `ports()` | The names: {ins = {...}, outs = {...}}. |

```lua
-- doubles what a circuit puts out and sends it on to another circuit
function draw()
  clear()
  local v = input("Level")
  output(1, v * 2)
  text(string.format("%.2f", v), 2, 2)
end
```

## Time and memory

| Call | What it does |
| --- | --- |
| `time()` | Seconds since the screen started. |
| `dt()` | Seconds since the last frame. |
| `frame()` | Frame counter. |
| `every(ms)` | True once every ms milliseconds (each every() call keeps its own timer). |
| `blink([ms])` | Switches between true and false, for blinking things. |
| `save(key, value)` | Keep a value with the preset (numbers, text, true / false, tables). |
| `load(key, [default])` | Read a kept value back. |
| `print(...)` | Show values in the editor console. |

## Language

Screen scripts use a small Lua: local x = 1, if ... then ... elseif ... else ... end, for i = 1, 10 do ... end, while ... do ... end, function name(a, b) ... end, tables {1, 2, x = 3}. Comments start with --. Also allowed: x += 1, != for not equal.

| Call | What it does |
| --- | --- |
| `math.floor, ceil, abs, min, max, sqrt, sin, cos, pi, random, clamp, lerp, round, map` | Maths. math.clamp(v, lo, hi), math.map(v, a, b, c, d) and math.round(v, digits) are extras. |
| `s:upper(), s:sub(i, j), s:rep(n), #s, string.format("%.1f", v), s:split(","), s:trim()` | Text. Join text with .. (two dots). |
| `table.insert(t, v), table.remove(t), table.concat(t, ", "), table.sort(t), #t` | Lists start at 1. |
| `for k, v in pairs(t) do ... end, for i, v in ipairs(list) do ... end` | Loop over a table. |
| `tostring(v), tonumber(s), type(v)` | Conversions. |
| `ok, err = pcall(fn, ...)` | Run a function and catch its error. |

## For circuit and plugin authors: the script host bridge

Scripts reach their pedal through a small bridge (`app/renderer/js/screenscript/host.js`). Every place a
screen runs (board, test mode, factory preview, editor preview) gives the same interface:

| Call | What it does |
| --- | --- |
| `controls()` | the pedal's controls: `[{name, kind, id}]` (kind: knob, switch, button, foot, dip) |
| `getControl(name)` / `setControl(name, v)` | read and set a control (on the board through `setParam`) |
| `getSignal(name)` | a signal value: `in`, `out`, `inDb`, `outDb`, `env`, `on`, `lfo`, `tempo`, `<stage>.<key>` |
| `setInput(name, v)` | write a circuit input (today through the control wired to it) |
| `signals()` | names a script can read |
| `screenInput(n)` / `screenOutput(n, v)` | this screen's own inputs and outputs (`io.cid` says which screen); an input reads the block status `cv[idx]` of the circuit output wired to it, an output sets the block param `u.s.<screen id>.<n - 1>` that drives the circuit inputs wired to it |
| `screenOutputValue(n)` / `screenPorts()` | an output's current value, and the port names and kinds |

`<stage>.<key>` is a stage of the design's circuit, by its id or type (`delay.time`, `overdrive.gain`): the
block's live status for that stage first, then the value the circuit runs with.

New signals and inputs plug in without changing the bridge:

```js
import { addSignalSource, addInputSink } from './screenscript/host.js';
addSignalSource({
  names: (ctx) => ['comp.gr'],
  get: (ctx, name) => (name === 'comp.gr' ? ctx.status?.c1?.gr : undefined), // ctx: design, block, def, mode, status, params()
});
addInputSink({ set: (ctx, name, v) => false /* true when handled */ });
```

Files: `lang.js` (tokenizer, parser, compiler), `stdlib.js`, `vm.js` (budget), `runtime.js` (the API),
`host.js` (bridge), `surface.js` / `board.js` / `factory-ui.js` (where screens run), `code-editor.js`,
`screen-editor.js`, `generator.js`, `gen-ui.js`, `templates.js`, `docs.js` (this reference).
Tests: `app/scripts/screenscript-test.js`.
