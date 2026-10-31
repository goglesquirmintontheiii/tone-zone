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

### Several files

The file list on the left of the code editor has **main** (this screen's own code) and the pedal's other
files. All screens of a pedal share them.

* **New** makes a file: a name ending in `.lua` is a code file (for `require`), anything else is data
  (`presets.txt`, `notes.json`). Use `/` for folders: `lib/notes.lua`.
* **Rename**, **Copy** and **Delete** work on the selected file. Data files open as plain text, files of
  bytes as a read only hex view.
* The bar at the bottom shows how much of the 1 MB the pedal's files use (the screens' code counts too).
* Files the preview writes while you try the screen are marked in italics with **Keep** (copy it into the
  design). **Reset** forgets them and runs the screen again.
* An error in a code file shows its file and line in the status. Click it to open the file there. The file
  with the error is marked red in the list.

### Hints while you type

The code editor knows the API and the pedal you are working on:

* **Completion**: a list opens as you type (Tone Zone functions, widgets, your own variables and functions,
  `math.` / `string.` / `colors.` fields). Inside quotes it offers values that fit: control names from this
  pedal for `knob("`, this screen's port names for `input("` and `output("`, colours, fonts, themes, icons and
  signals. Up and Down pick, Enter or Tab inserts, Esc closes, Ctrl+Space opens it by hand.
* **Signature help**: after `(` a box shows the parameters with their types and what they mean, with the one
  you are typing in bold. Ctrl+Shift+Space shows it again.
* **Hovers**: rest the pointer on an API name to see its parameters and description, or on your own function
  to see where it is defined.
* **Other files**: after `local util = require("util")`, typing `util.` lists the functions util.lua
  returns, and functions other code files define as globals are offered too. Inside `require("` the code
  files are offered, inside `fs.read("` the pedal's files.
* **Checks**: obvious mistakes get a dotted underline and a mark in the line numbers: a wrong number of
  arguments, a function that does not exist, text where a number goes (or the other way round), and a control
  or port name the pedal does not have. They are only hints: the script still runs. Hover the underline to
  read it, or click the hint count under the code to jump to the first one.

## How a script runs

* The top of the script runs once when the screen starts (set up variables here).
* `draw()` runs for every frame, about 20 to 30 times a second. Draw the whole screen there, starting with
  `clear()`. On the board, screens only repaint while the pedal is in view.
* Event functions (`onPress`, `onControl`, `onFoot` ...) run when something happens.
* Variables keep their values while the screen runs. `save(key, value)` keeps a value with the preset so it
  is still there next time. For more, a pedal has its own files (`fs.write`, `fs.read`).
* A screen can use code files of its pedal with `require("util")`, so several screens share functions.
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

Scripts run in a sandbox: they can only call the functions on this page, with no access to the app, the
computer's files, the network or other pedals. The only files a script sees are its own pedal's files (see
Files below), inside a 1 MB budget. Each frame has a work budget, so a loop that never ends is stopped (the screen shows
the error and its line) instead of freezing the app. Errors never crash the app: the screen shows
`ERROR LINE n` and the editor marks the line.

# API reference

## Running

Code at the top runs once when the screen starts. Then draw() runs for every frame (about 20 to 30 a second). The functions below are called by name when you define them. For more events, and several handlers for one, see on() under Events.

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

## Events

on(event, [name], fn) runs fn when something happens: a footswitch pressed, an encoder turned, a control changed, a screen input changed ... Add handlers once, at the top of the script (not inside draw()). The function gets one table e with the details.

| Call | What it does |
| --- | --- |
| `h = on(event, [name], function(e) ... end)` | Run the function on an event, for one control (or input) by name or number, or for all of them when the name is left out. Returns a handle. |
| `h:off() or off(h)` | Stop a handler. |
| `events()` | The names of the events. |

### The events

* **change** (control): any control changed. e.name, e.kind, e.value, e.old.
* **switch** (switch): a toggle or rotary switch moved. e.value and e.old (positions from 1), e.option (its label).
* **encoder** (knob): an encoder (or knob) turned by at least one step. e.dir is 1 (clockwise) or -1 (counter clockwise), e.steps how many steps (per turn: the Steps setting of the encoder, 24 by default and for plain knobs), e.value the position. Endless encoders wrap around without a jump in direction.
* **footswitch_down** / **footswitch_up** (footswitch): a footswitch turned on / off. e.name, e.on. The bypass switch counts too.
* **button_down** / **button_up** (push button): the same for latching push buttons.
* **dip** (DIP switch): e.name, e.n (its number in the block), e.on.
* **input** (screen input): a value wired into this screen changed. e.port (number), e.name, e.value, e.old.
* **bypass**: the pedal was turned on or off. e.on is true when it is on.
* **tap**: the tap tempo footswitch was pressed (on the board). e.count counts the taps.
* **preset**: a preset was loaded on the board (the pedal may be the same, its settings may have changed).
* **touch**, **drag**, **release**: the screen was pressed, dragged, let go. e.x, e.y.
* **wheel**: e.d is 1 (up) or -1 (down), e.x, e.y.
* **key**: a key was typed while the screen has focus. e.key.
* **timer**: on("timer", 500, fn) runs every 500 ms. e.count counts the runs.

Names work like everywhere else: a label (any case), "Knob 2", a number (the second knob is on("encoder", 2, fn)) or a footswitch letter. Screen inputs by number or name.

### When they run

* Control, input, bypass and timer events are checked once per frame, before update() and draw(). Each change fires once, even if it was fast.
* The order: controls in panel order (onControl and onFoot first, then on() handlers in the order they were added; change before the more specific event), then screen inputs, bypass and timers. touch, drag, release, wheel and key run right when they happen.
* Each handler has its own work budget. An error in a handler shows in the console with its line and the other handlers and draw() keep running.
* The older functions (onControl, onFoot, onPress, onMove, onRelease, onWheel, onKey) still work, next to on().

```lua
-- count presses of footswitch A and show how long it was held
local presses, held, downAt = 0, 0, 0
on("footswitch_down", "A", function(e)
  presses += 1
  downAt = time()
end)
on("footswitch_up", "A", function(e)
  held = time() - downAt
end)
function draw()
  clear()
  text("A: " .. presses, 2, 2)
  text(string.format("held %.1f s", held), 2, 12, colors.dim)
end
```

```lua
-- an encoder steps through a list of presets
local names = {"CLEAN", "CRUNCH", "LEAD", "AMBIENT"}
local pick = 1
on("encoder", "Select", function(e)
  pick = (pick - 1 + e.dir * e.steps) % #names + 1
end)
function draw()
  clear()
  text(names[pick], W / 2, H / 2, colors.fg, "big", "middle")
end
```

```lua
-- flash the screen when a control changes, and when a screen input goes high
local flash, msg = 0, ""
on("change", function(e)
  msg = e.name .. ": " .. tostring(e.old) .. " > " .. tostring(e.value)
  flash = 0.3
end)
on("input", "Gate", function(e)
  if e.value == 1 then flash = 0.3 end
end)
function draw(dt)
  clear(flash > 0 and colors.accent or colors.bg)
  flash = math.max(0, flash - dt)
  text(msg, 2, 2)
end
```

```lua
-- a handler that runs once, then stops itself
local h
h = on("touch", function(e)
  print("first touch at", e.x, e.y)
  h:off()
end)
```

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
| `closeKeyboard([keep])` | Closes the on-screen keyboard, like pressing OK. closeKeyboard(false) cancels instead and puts the old text back. |

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

## Screen ports

A screen can have its own inputs and outputs in the wiring diagram, up to 16 of each. Inputs bring values from a circuit into the script. Outputs let the script drive circuit inputs. A port is analog (a number from -255 to 255) or binary (0 or 1), and is found by number (1 is the first) or by its name (any case).

| Call | What it does |
| --- | --- |
| `input(n) or input(name)` | The value wired into this input: analog -255 to 255, binary 0 or 1. 0 when nothing is wired, when the pedal is not playing, or when there is no such input. |
| `output(n, value) or output(name, value)` | Set an output. Analog takes a number (kept within -255 to 255), binary takes true / false or 0 / 1. Only changes are sent. Returns false when there is no such output. |
| `outputValue(n) or outputValue(name)` | What the output is set to now (its default, 0, until the script sets it). Saved with the preset. |
| `ports()` | The port names: ports().ins and ports().outs are lists, in order. |

### Adding inputs and outputs

* Select the screen in the Pedal Factory. In the inspector, **Inputs and outputs** has **+ Input** and **+ Output**. The screen's box in the wiring diagram has **+in** and **+out** buttons too.
* Each port has a **name** (up to 16 characters, "In 1", "Out 1" ... to start with) and a **Signal**: Analog or Binary.
* An input **Reads** one source: usually a circuit output (an Analog output or Binary output part inside a circuit). Pick it in the inspector or drag a wire to the screen's input in the wiring diagram. In the diagram you can also wire a control, an EXP or footswitch IN jack, or another screen's output straight to it.
* An output **Drives** one or more circuit inputs: Analog input or Binary input parts, a circuit's on / off, or the wet / dry mix. Use **Drive a circuit input** in the inspector, or drag a wire from the screen's output to the circuit's input.
* Scripts find ports by number or name. Removing a port renumbers the ones after it, and renaming one breaks scripts that use the old name, so update the code too.

### Reading inputs

input() reads the newest value the audio engine reported for the circuit output wired to it. The engine reports about 30 times a second and a board screen draws about 22 frames a second, so read inputs inside draw() (or update()) every frame. A very fast signal is sampled, so put an Envelope follower or a Smoother in the circuit when you want a steady reading.

* Analog inputs give the value the circuit output puts out (most parts put out 0 to 1), kept within -255 to 255. Wired straight from a control or a jack they read 0 to 1 (a switch: its position from 0 to 1), from another screen's output its value as it is.
* Binary inputs give 1 or 0 (values above 0.5 count as 1).
* An input reads 0 when nothing is wired to it, when what it read is gone, when the pedal is not playing (the engine is off), and when an EXP jack it reads has nothing plugged in. A circuit output also reads 0 while the pedal is bypassed (its circuits are not running); a control, jack or screen wired straight to the input keeps its value. Circuit outputs also read 0 on the factory stage outside Test mode, since the circuit only plays in Test mode and on the board. In the code editor preview it reads what you set in the Test tab.
* In Lua 0 counts as true, so compare a binary input with 1: if input("Gate") == 1 then ... end

```lua
-- input "Env" (analog) reads a circuit's Analog output, wired from an Envelope follower (0 to 1)
function draw()
  clear()
  local env = input("Env")
  text("ENV", 2, 2, colors.dim)
  meter(2, 12, W - 4, 8, env)
  graph(2, 24, W - 4, H - 26, history("env", env, 60), colors.fg, 0, 1)
end
```

```lua
-- input "Gate" (binary) reads a Binary output, for example from a Comparator
function draw()
  clear()
  if input("Gate") == 1 then
    fillCircle(W - 8, 8, 5, colors.good)
  else
    circle(W - 8, 8, 5, colors.dim)
  end
  text("GATE", 2, 4, colors.fg)
end
```

```lua
-- or react only when the input changes, with on()
local hits = 0
on("input", "Gate", function(e)
  if e.value == 1 then hits += 1 end
end)
function draw()
  clear()
  text("HITS " .. hits, 2, 2)
end
```

### Writing outputs

output(n, value) sets an output, and the circuit inputs it drives follow. The value goes in as it is (no 0 to 1 mapping like a knob), kept within the circuit input's own range: an Analog input part is 0 to 1 unless you change its Low and High, a Binary input takes 0 or 1. When a knob and a screen output drive the same input, the values are combined (averaged unless the input says otherwise). Until the script sets an output, it sends its default value (0 unless the design gives the output another one) to the inputs it drives.

```lua
-- output "Boost" (binary) drives a circuit's Binary input
local on = outputValue("Boost") == 1
function draw()
  clear()
  on = toggle("BOOST", 2, 2, W - 4, 14, on)
  output("Boost", on)
end
```

```lua
-- output "Rate" (analog) drives an LFO's Rate input (set that Analog input's Low and High to 0.1 and 10)
local rate = outputValue("Rate")
if rate == 0 then rate = 1 end
function draw()
  clear()
  rate = slider("RATE", 2, 2, W - 4, 12, rate, 0.1, 10)
  output("Rate", math.round(rate, 2))
  text(string.format("%.2f Hz", rate), 2, 18)
end
```

Tips for outputs:

* Calling output() every frame is fine: only changes are sent to the engine.
* On the board an output change is saved with the preset and can be undone, like turning a knob (a burst of changes is one undo step). outputValue() gives the saved value back when the screen starts again, as in the examples above.
* Outputs change at the screen's frame rate (about 20 a second). For a smooth sweep put a Smoother part after the circuit input, or ease the value in the script: shown = shown + (target - shown) * 0.3
* Round values that change all the time (math.round(v, 2)) or send them less often with if every(50) then ... end, so the engine and the undo history get fewer changes.
* For a button that is only on while pressed: output("Hold", mouse.down and inside(0, 0, W, H))
* On the board a screen runs only while its pedal is in view, so its outputs stop changing when you scroll away. Build anything that must keep running into the circuit itself.

### Listing the ports

```lua
-- every input with its value
function draw()
  clear()
  for i, name in ipairs(ports().ins) do
    text(name .. ": " .. string.format("%.2f", input(i)), 2, 2 + (i - 1) * 9)
  end
end
```

### A screen wired both ways

An auto wah with a screen that shows the envelope and sets the sensitivity. In the circuit, an Envelope follower goes to an Analog output "Env", and the circuit has an Analog input "Sensitivity" (0 to 1) and a Binary input "Freeze". The screen has input 1 "Env" (analog, reads the circuit's "Env"), output 1 "Sens" (analog, drives "Sensitivity") and output 2 "Hold" (binary, drives "Freeze").

```lua
-- reads the envelope, sets the sensitivity, holds the sweep
local sens = outputValue("Sens")
if sens == 0 then sens = 0.5 end
local hold = outputValue("Hold") == 1

function draw()
  clear()
  local env = input("Env")
  text("ENV", 2, 2, colors.dim, "small")
  bar(22, 2, W - 24, 6, env)
  sens = slider("SENS", 2, 12, W - 4, 10, sens)
  output("Sens", math.round(sens, 2))
  hold = toggle("HOLD", 2, 26, 40, 12, hold)
  output("Hold", hold)
  if hold then fillCircle(W - 8, 32, 4, colors.warn) end
end
```

### Trying it out

* In the code editor the **Test** tab has a slider (analog) or a check box (binary) for each screen input, and shows what each output is set to.
* In the factory's **Test** mode and on the board the inputs and outputs are live: the circuit runs and the screen reads and drives it.

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

## Code files

A pedal can have code files next to the code of each screen: write shared functions once and use them from every screen of the pedal. Add them with New in the file list on the left of the code editor (a code file ends in .lua). Code files are saved with the design and with the saved pedal.

| Call | What it does |
| --- | --- |
| `m = require(name)` | Run a code file of this pedal and get what it returns (usually a table of functions). name is the file without .lua, folders with / or . ("util", "lib/notes"). A file runs once: the next require gives the same value. |

### Writing a code file

* A code file is a normal script. What it returns is what require gives back, so most code files make a table, put functions in it and return it at the end.
* Functions written without local (function helper() ... end) become globals that every file can call, like in Lua. A local table you return keeps things tidy.
* Code files can require other code files. Two files that require each other in a loop are an error that names both.
* All files share the screen's globals (W, H, colors, the drawing functions ...) and its work budget.
* An error in a code file names the file and its line, like **util.lua line 3**. Click it in the status to open the file at that line. The hints know the functions of the other files: after m. the completion lists what util.lua returns.
* A screen restarts when its code or any code file changes. require only loads code saved with the design: a .lua file a script writes with fs.write is data.

```lua
-- util.lua: shared helpers
local M = {}
function M.db(v)
  return 20 * math.log(math.max(v, 0.00001), 10)
end
function M.title(s)
  text(s, 2, 2, colors.dim, "small")
end
return M
```

```lua
-- the screen: use them
local util = require("util")
function draw()
  clear()
  util.title("LEVEL")
  text(string.format("%.1f dB", util.db(signal("in"))), 2, 12)
end
```

## Files

Every pedal has its own small store of files, shared by all its screens: settings, user presets, lists, logs or your own file formats. Paths look like "presets/1.txt": letters, digits, space, _ - and ., with / between folders (no .., no / at the start). Everything together (the screens' code, code files and data files) can use 1 MB per pedal.

| Call | What it does |
| --- | --- |
| `fs.read(path)` | The text of a file, or nil when there is no such file. |
| `fs.write(path, text)` | Write a file (made if needed, replaced if it is there). Folders are made as needed. |
| `fs.append(path, text)` | Add text to the end of a file (made if needed). |
| `fs.exists(path)` | True when there is a file or folder there. |
| `fs.remove(path)` | Remove a file (or an empty folder). True when something was removed. |
| `fs.rename(from, to)` | Rename or move a file. |
| `fs.list([folder])` | The names in a folder (the top when left out): files first, then folders with / at the end. |
| `fs.mkdir(path)` | Make an empty folder. |
| `fs.isDir(path)` | True when the path is a folder. |
| `fs.size(path)` | Size of a file in bytes, or nil. |
| `fs.free(), fs.used(), fs.budget()` | Bytes left, bytes used and the budget (1048576) of the pedal's files. |
| `fs.readBytes(path)` | A file as a list of numbers from 0 to 255. |
| `fs.readBin(path)` | A file as a byte string (one character per byte), for bin.unpack and s:byte(i). |
| `fs.writeBytes(path, bytes)` | Write bytes: a list of numbers from 0 to 255, or a byte string from bin.pack. |
| `fs.appendBytes(path, bytes)` | Add bytes to the end of a file. |

### Where files are kept

* **Files you make in the code editor** (code files and any starting data) belong to the design: they are saved with it and with the saved pedal.
* **Files a script writes on the board** belong to that pedal on the board: they are saved with the preset, so user presets kept on a pedal are still there next time. Each pedal on the board has its own. A script that writes over a file of the design changes it for that pedal only, and a new version of the design still brings its new code.
* **In the code editor preview and in Test mode** scripts write to a sandbox for this session. The file list shows those files marked preview: **Keep** copies one into the design, **Reset** forgets them.
* Writing is cheap: files are saved a moment after the last write, not on every call. Undo does not undo file writes.

### Text and bytes

* fs.read and fs.write are for text (saved as UTF-8). For your own formats use fs.readBin / fs.writeBytes with bin.pack and bin.unpack (or lists of numbers with fs.readBytes).
* A byte string has one character per byte (0 to 255): s:byte(i) gives byte i, #s the length, string.char(65, 66) makes one.
* When a write would go over 1 MB, or a path is not allowed, the call stops the script with an error that says why (use pcall to catch it). fs.free() tells how much room is left.

```lua
-- user presets kept on the pedal: tap SAVE to store the knobs, tap a slot to load it
local slot = 1
function draw()
  clear()
  slot = tabs({"1", "2", "3"}, 0, 0, W, 12, slot)
  local path = "presets/" .. slot .. ".txt"
  if button("SAVE", 2, 16, 40, 14) then
    fs.write(path, knob(1) .. "," .. knob(2))
  end
  if fs.exists(path) and button("LOAD", 46, 16, 40, 14) then
    local v = fs.read(path):split(",")
    setKnob(1, tonumber(v[1]))
    setKnob(2, tonumber(v[2]))
  end
  text(string.format("%d KB free", fs.free() // 1024), 2, H - 9, colors.dim, "small")
end
```

```lua
-- a log that keeps the last notes, one line each
on("footswitch_down", function(e)
  fs.append("log.txt", string.format("%.1f %s\n", time(), e.name))
end)
function draw()
  clear()
  local lines = (fs.read("log.txt") or ""):split("\n")
  for i = math.max(1, #lines - 4), #lines do
    text(lines[i], 2, 2 + (i - math.max(1, #lines - 4)) * 9)
  end
end
```

## Binary data

bin turns numbers and text into bytes and back, for your own file formats. The format is a string of letters, like Lua's string.pack: "<I2 f s1" is a 16 bit number, a float and a short text.

| Call | What it does |
| --- | --- |
| `bin.pack(fmt, ...)` | The values packed into a byte string. |
| `a, b, next = bin.unpack(fmt, data, [pos])` | The values from a byte string, starting at byte pos (default 1), and the position after them. |
| `bin.size(fmt)` | How many bytes a format takes (not for s and z). |
| `bin.bytes(data, [i], [j])` | The bytes of a byte string as a list of numbers. |
| `bin.str(list)` | A byte string from a list of numbers from 0 to 255. |
| `bin.hex(data, [sep])` | The bytes as hex text, like "01 ff 3a", to look at in print(). |
| `bin.utf8(text), bin.text(data)` | Text to UTF-8 bytes, and back. |

### Format letters

* **<** little endian (the default), **>** big endian.
* **b** / **B** 8 bit number (signed / unsigned), **h** / **H** 16 bit, **i** / **I** 32 bit (i1 to i4 and I1 to I4 for other sizes).
* **f** 32 bit float, **d** 64 bit float.
* **s** text with its length in front (s1, s2 or s4 bytes for the length, s is s4), **z** text ending with a zero byte, **c8** exactly 8 bytes of text (padded with zeros), **x** one zero byte.
* Spaces are ignored. A number that does not fit its size is an error.

```lua
-- a small custom format: a header, then points
local pts = {{10, 0.5}, {20, 0.25}, {30, 1}}
local data = bin.pack("<c4 I2", "PNTS", #pts)
for _, p in ipairs(pts) do data = data .. bin.pack("<H f", p[1], p[2]) end
fs.writeBytes("points.bin", data)

-- and read it back
local s = fs.readBin("points.bin")
local magic, n, pos = bin.unpack("<c4 I2", s)
local back = {}
for i = 1, n do
  local x, y
  x, y, pos = bin.unpack("<H f", s, pos)
  back[i] = {x, y}
end
function draw()
  clear()
  text(magic .. " " .. n .. " points, " .. #s .. " bytes", 2, 2)
  text(bin.hex(s:sub(1, 8)), 2, 12, colors.dim, "small")
end
```

## Audio

Scripts run at the screen's frame rate (20 to 30 a second), not for every sample, so they never slow the audio down. They read what the engine measures on the pedal's audio jacks, and they start and steer small sound makers that run inside the engine: oscillators, noise, envelopes and sample players that play buffers the script fills. Jacks are found by label (any case), "in" (the first input), "out" (the main output), "in 2", "out 2".

| Call | What it does |
| --- | --- |
| `audio.level([jack])` | How loud the jack is (RMS, 0 to 1). Default: the first input. |
| `audio.peak([jack])` | The peak level (0 to 1). |
| `audio.spectrum([jack], [bins])` | A list of bins (4 to 64, default 32) from 0 to 1, low to high (40 Hz to 16 kHz). |
| `audio.wave([jack], [n])` | The last n samples (16 to 1024, default 128) from -1 to 1, to draw a scope. |
| `audio.pitch([jack])` | The pitch in Hz, 0 when there is none. |
| `audio.onset([jack])` | True in the frame a new note started. |
| `audio.analysis([jack], [bins], [n])` | All of it in one table: rms, peak, pitch, onset, onsets (a count), bands, wave. |
| `audio.jacks()` | The names of the pedal's audio jacks. |
| `audio.ready()` | True when the engine takes sounds (on the board without it, audio.gen gives false). |
| `audio.gen(name, settings)` | Start a sound maker, or change one that runs: {type = "saw", freq = 110, amp = 0.3, to = "out"}. Only changes are sent. |
| `audio.note(name, [freq], [amp])` | Start a note on a sound maker (its envelope starts again). |
| `audio.release(name)` | Let the note go (the envelope releases). |
| `audio.stop(name)` | Stop and remove a sound maker or a processor. |
| `audio.buffer(name, samples, [rate])` | Fill a buffer with samples from -1 to 1 (a wavetable or a short sample, up to 96000 samples). rate in Hz, default 48000. |
| `audio.play(name, buffer, [settings])` | Play a buffer, from the start each time: {loop = true, rate = 1, amp = 0.5, to = "out"}. |
| `audio.fx(name, settings)` | A simple processor on a jack: {type = "lowpass", jack = "out", freq = 800, q = 0.7}. Types: gain, lowpass, highpass, bandpass, drive. |

### Settings

* **type**: sine, square, saw, tri, pulse, noise or sample (audio.play sets sample).
* **freq** (Hz), **amp** (0 to 1), **pw** (pulse width for pulse, 0 to 1).
* **attack**, **decay**, **release** (seconds) and **sustain** (0 to 1): an envelope. With one, **gate = true** starts the note and **gate = false** lets it go (audio.note and audio.release do that for you). Without an envelope the sound plays while it runs.
* **to**: where it goes. An output jack ("out") adds it after the circuit, an input jack ("in") adds it to what goes into the circuit, "circuit:Name" feeds a circuit input part with that name.
* **buffer**, **loop**, **rate** (1 is as written), **start** (0 to 1) for samples, **pan** (-1 to 1).
* For audio.fx: **jack**, **gain**, **freq**, **q**, **amount** (drive) and **mix** (0 to 1).

### Keep it light

* A screen can run 16 sound makers and 16 processors, with 192000 samples of buffers. Sounds stop when the screen starts again (a code change, a new preset).
* Only changes reach the engine, so calling audio.gen every frame is fine. Steer the circuit itself with output() and setInput() as before.
* There is no code for every sample: make your own sound by writing it into a buffer (a wavetable, a short sample) and playing it.
* In the code editor preview the jacks carry a demo guitar plus your own sounds (not played out loud), so the analysis moves. On the board the engine does the work.

```lua
-- a spectrum and a scope of the input
function draw()
  clear()
  local bands = audio.spectrum("in", 32)
  local bw = W / #bands
  for i, v in ipairs(bands) do
    fillRect((i - 1) * bw, H - v * H, bw - 1, v * H, hsv(i * 8, 0.8, 1))
  end
  graph(0, 0, W, H / 2, audio.wave("in", 128), colors.fg, -1, 1)
end
```

```lua
-- a drone: a knob sets the pitch, the footswitch plays a note
audio.gen("drone", {type = "saw", freq = 55, amp = 0.2, attack = 0.05, release = 0.8, to = "out"})
on("footswitch_down", function(e) audio.note("drone") end)
on("footswitch_up", function(e) audio.release("drone") end)
function draw()
  clear()
  local f = 40 + knob(1) * 200
  audio.gen("drone", {freq = math.round(f)})
  text(math.round(f) .. " Hz", 2, 2)
  meter(2, H - 10, W - 4, 8, audio.level("out"))
end
```

```lua
-- a wavetable made in the script, played in a loop
local wt = {}
for i = 1, 256 do
  local t = (i - 1) / 256
  wt[i] = 0.6 * math.sin(t * 2 * math.pi) + 0.3 * math.sin(t * 6 * math.pi)
end
audio.buffer("table", wt)
audio.play("pad", "table", {loop = true, rate = 220 * 256 / 48000, amp = 0.25})
function draw()
  clear()
  graph(0, 0, W, H, wt, colors.accent, -1, 1)
  text(audio.ready() and "PLAYING" or "NO ENGINE", 2, 2, colors.dim, "small")
end
```

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
| `screenInput(n)` / `screenOutput(n, v)` | this screen's own inputs and outputs (`io.cid` says which screen); an input reads the block status `cv[idx]` of the circuit output wired to it (or a control, jack or screen output linked straight to it, see `pages/circuit-links.js`), an output sets the block param `u.s.<screen id>.<n - 1>` that drives the circuit inputs wired to it |
| `screenOutputValue(n)` / `screenPorts()` | an output's current value, and the port names and kinds |
| `io.screenIn(i)` (optional) | a value for input i (0 based) that wins over the wiring: the code editor's Test tab uses it |
| `files` / `codeFile(path)` / `codeFiles()` | the pedal's file store (`files.js`, shared by its screens), and the code files saved with the design (for `require`) |
| `audio` | script audio: analysis of the jacks and engine side generators, see below |

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

### Where files are stored

* `D.files` in the design: `{ "path": "utf-8 text" | { b64 } , "folder/": true }`. Code files and starting
  data made in the code editor. Saved with the design and the saved custom block.
* `block.params._fs` on the board: a JSON string with what that block's scripts wrote, on top of `D.files`
  (`null` marks a design file removed for this block). Saved with the preset, written about 0.6 s after the
  last write (`setParam` without an undo step, the preset is marked changed). Code is always read from
  `D.files`, so a new version of the design brings its new code to every pedal on the board.
* The factory preview and test mode use a sandbox in memory per design (`sandboxStore`), thumbnails a
  throwaway one.
* The budget is 1 MB per pedal for the screens' own code, code files and data files together, checked on
  every write (`FileStore.write`). Paths are relative, `/` between folders, no `..` or `.`, at most 6 folders
  and 160 characters.

### Script audio

Lua runs at the screen's frame rate in the renderer, so scripts never process samples. They read analysis
and drive small engine side sound makers through `host.audio`, which calls a backend the engine side
registers:

```js
import { setAudioBackend } from './screenscript/host.js';
setAudioBackend({
  analysis(ctx, jack, want) { return { rms, peak, bands, wave, pitch, onset }; }, // or null
  gen(ctx, id, params) { return true; },        // start or update a generator (only changes are sent)
  stop(ctx, id) {},
  buffer(ctx, id, samples, rate) { return true; }, // Float32Array, up to 96000 samples
  fx(ctx, id, params) { return true; },          // gain, lowpass, highpass, bandpass, drive on a jack
  reset(ctx) {},                                  // a screen starts again: drop what ctx.screen made
});
```

* `ctx` = `{ design, block, blockId, def, mode, screen }`. Ids are `"<screen id>:<script name>"`, unique per
  block.
* `jack` = `{ dir: 'in' | 'out', index, name, id }`, the block's audio ports in `jackList()` order.
  `want` = `{ bands: 4..64, wave: 16..1024 }`. bands are 0..1 on a dB scale (-72 to 0) at log spaced
  centres from 40 Hz to 16 kHz, `wave` the newest samples last, `onset` a counter of note starts.
* Generator params: `type` (sine, square, saw, tri, pulse, noise, sample), `freq`, `amp`, `pw`, `attack`,
  `decay`, `sustain`, `release`, `gate`, `trig` (a counter, a new value restarts the note), `buffer`, `loop`,
  `rate`, `start`, `pan`, `to` (`{ dir, index }` for a jack, `{ circuit: name }` for a circuit input part).
* Limits per screen: 16 generators, 16 processors, 192000 samples of buffers. There is no per sample script
  code on purpose.
* Without a backend the board answers analysis from the level meters (rms and peak only) and generators
  give false (`audio.ready()` is false). The code editor preview has its own fake (`audio.js`): the input
  jack carries a demo guitar, generators add to the jacks they go to, nothing is played out loud.

The full contract is at the top of `host.js`.

Files: `lang.js` (tokenizer, parser, compiler), `stdlib.js`, `vm.js` (budget), `runtime.js` (the API),
`host.js` (bridge), `files.js` (the file store), `binfmt.js` (bin.pack), `audio.js` (jacks, the preview's fake audio), `surface.js` / `board.js` / `factory-ui.js` (where screens run), `code-editor.js`,
`hints.js` (completion, signature help, hovers, checks), `screen-editor.js`, `generator.js`, `gen-ui.js`, `templates.js`, `docs.js` (this reference).
Tests: `app/scripts/screenscript-test.js`.
