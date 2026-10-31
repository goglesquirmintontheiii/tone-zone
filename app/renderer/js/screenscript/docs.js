// The screen script API reference: used by the editor's reference panel, highlighter and type hints, and to
// write docs/screen-scripts.md. API items are [name, signature, description]; SIGS below adds parameter types
// for autocomplete, signature help, hovers and the light checks, so the docs and the hints stay in sync.
export const API = [
  {
    group: 'Running',
    intro: 'Code at the top runs once when the screen starts. Then draw() runs for every frame (about 20 to 30 a second). The functions below are called by name when you define them. For more events, and several handlers for one, see on() under Events.',
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
    group: 'Events',
    intro: 'on(event, [name], fn) runs fn when something happens: a footswitch pressed, an encoder turned, a control changed, a screen input changed ... Add handlers once, at the top of the script (not inside draw()). The function gets one table e with the details.',
    items: [
      ['on', 'h = on(event, [name], function(e) ... end)', 'Run the function on an event, for one control (or input) by name or number, or for all of them when the name is left out. Returns a handle.'],
      ['off', 'h:off() or off(h)', 'Stop a handler.'],
      ['events', 'events()', 'The names of the events.'],
    ],
    guide: [
      ['h', 'The events'],
      ['list', [
        '**change** (control): any control changed. e.name, e.kind, e.value, e.old.',
        '**switch** (switch): a toggle or rotary switch moved. e.value and e.old (positions from 1), e.option (its label).',
        '**encoder** (knob): an encoder (or knob) turned by at least one step. e.dir is 1 (clockwise) or -1 (counter clockwise), e.steps how many steps (per turn: the Steps setting of the encoder, 24 by default and for plain knobs), e.value the position. Endless encoders wrap around without a jump in direction.',
        '**footswitch_down** / **footswitch_up** (footswitch): a footswitch turned on / off. e.name, e.on. The bypass switch counts too.',
        '**button_down** / **button_up** (push button): the same for latching push buttons.',
        '**dip** (DIP switch): e.name, e.n (its number in the block), e.on.',
        '**input** (screen input): a value wired into this screen changed. e.port (number), e.name, e.value, e.old.',
        '**bypass**: the pedal was turned on or off. e.on is true when it is on.',
        '**tap**: the tap tempo footswitch was pressed (on the board). e.count counts the taps.',
        '**preset**: a preset was loaded on the board (the pedal may be the same, its settings may have changed).',
        '**touch**, **drag**, **release**: the screen was pressed, dragged, let go. e.x, e.y.',
        '**wheel**: e.d is 1 (up) or -1 (down), e.x, e.y.',
        '**key**: a key was typed while the screen has focus. e.key.',
        '**timer**: on("timer", 500, fn) runs every 500 ms. e.count counts the runs.',
      ]],
      ['p', 'Names work like everywhere else: a label (any case), "Knob 2", a number (the second knob is on("encoder", 2, fn)) or a footswitch letter. Screen inputs by number or name.'],
      ['h', 'When they run'],
      ['list', [
        'Control, input, bypass and timer events are checked once per frame, before update() and draw(). Each change fires once, even if it was fast.',
        'The order: controls in panel order (onControl and onFoot first, then on() handlers in the order they were added; change before the more specific event), then screen inputs, bypass and timers. touch, drag, release, wheel and key run right when they happen.',
        'Each handler has its own work budget. An error in a handler shows in the console with its line and the other handlers and draw() keep running.',
        'The older functions (onControl, onFoot, onPress, onMove, onRelease, onWheel, onKey) still work, next to on().',
      ]],
      ['code', '-- count presses of footswitch A and show how long it was held\nlocal presses, held, downAt = 0, 0, 0\non("footswitch_down", "A", function(e)\n  presses += 1\n  downAt = time()\nend)\non("footswitch_up", "A", function(e)\n  held = time() - downAt\nend)\nfunction draw()\n  clear()\n  text("A: " .. presses, 2, 2)\n  text(string.format("held %.1f s", held), 2, 12, colors.dim)\nend\n'],
      ['code', '-- an encoder steps through a list of presets\nlocal names = {"CLEAN", "CRUNCH", "LEAD", "AMBIENT"}\nlocal pick = 1\non("encoder", "Select", function(e)\n  pick = (pick - 1 + e.dir * e.steps) % #names + 1\nend)\nfunction draw()\n  clear()\n  text(names[pick], W / 2, H / 2, colors.fg, "big", "middle")\nend\n'],
      ['code', '-- flash the screen when a control changes, and when a screen input goes high\nlocal flash, msg = 0, ""\non("change", function(e)\n  msg = e.name .. ": " .. tostring(e.old) .. " > " .. tostring(e.value)\n  flash = 0.3\nend)\non("input", "Gate", function(e)\n  if e.value == 1 then flash = 0.3 end\nend)\nfunction draw(dt)\n  clear(flash > 0 and colors.accent or colors.bg)\n  flash = math.max(0, flash - dt)\n  text(msg, 2, 2)\nend\n'],
      ['code', '-- a handler that runs once, then stops itself\nlocal h\nh = on("touch", function(e)\n  print("first touch at", e.x, e.y)\n  h:off()\nend)\n'],
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
      ['closeKeyboard', 'closeKeyboard([keep])', 'Closes the on-screen keyboard, like pressing OK. closeKeyboard(false) cancels instead and puts the old text back.'],
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
    group: 'Screen ports',
    intro: 'A screen can have its own inputs and outputs in the wiring diagram, up to 16 of each. Inputs bring values from a circuit into the script. Outputs let the script drive circuit inputs. A port is analog (a number from -255 to 255) or binary (0 or 1), and is found by number (1 is the first) or by its name (any case).',
    items: [
      ['input', 'input(n) or input(name)', 'The value wired into this input: analog -255 to 255, binary 0 or 1. 0 when nothing is wired, when the pedal is not playing, or when there is no such input.'],
      ['output', 'output(n, value) or output(name, value)', 'Set an output. Analog takes a number (kept within -255 to 255), binary takes true / false or 0 / 1. Only changes are sent. Returns false when there is no such output.'],
      ['outputValue', 'outputValue(n) or outputValue(name)', 'What the output is set to now (its default, 0, until the script sets it). Saved with the preset.'],
      ['ports', 'ports()', 'The port names: ports().ins and ports().outs are lists, in order.'],
    ],
    // a longer guide, shown in the Reference panel and in docs/screen-scripts.md
    guide: [
      ['h', 'Adding inputs and outputs'],
      ['list', [
        'Select the screen in the Pedal Factory. In the inspector, **Inputs and outputs** has **+ Input** and **+ Output**. The screen\'s box in the wiring diagram has **+in** and **+out** buttons too.',
        'Each port has a **name** (up to 16 characters, "In 1", "Out 1" ... to start with) and a **Signal**: Analog or Binary.',
        'An input **Reads** one source: usually a circuit output (an Analog output or Binary output part inside a circuit). Pick it in the inspector or drag a wire to the screen\'s input in the wiring diagram. In the diagram you can also wire a control, an EXP or footswitch IN jack, or another screen\'s output straight to it.',
        'An output **Drives** one or more circuit inputs: Analog input or Binary input parts, a circuit\'s on / off, or the wet / dry mix. Use **Drive a circuit input** in the inspector, or drag a wire from the screen\'s output to the circuit\'s input.',
        'Scripts find ports by number or name. Removing a port renumbers the ones after it, and renaming one breaks scripts that use the old name, so update the code too.',
      ]],
      ['h', 'Reading inputs'],
      ['p', 'input() reads the newest value the audio engine reported for the circuit output wired to it. The engine reports about 30 times a second and a board screen draws about 22 frames a second, so read inputs inside draw() (or update()) every frame. A very fast signal is sampled, so put an Envelope follower or a Smoother in the circuit when you want a steady reading.'],
      ['list', [
        'Analog inputs give the value the circuit output puts out (most parts put out 0 to 1), kept within -255 to 255. Wired straight from a control or a jack they read 0 to 1 (a switch: its position from 0 to 1), from another screen\'s output its value as it is.',
        'Binary inputs give 1 or 0 (values above 0.5 count as 1).',
        'An input reads 0 when nothing is wired to it, when what it read is gone, when the pedal is not playing (the engine is off), and when an EXP jack it reads has nothing plugged in. A circuit output also reads 0 while the pedal is bypassed (its circuits are not running); a control, jack or screen wired straight to the input keeps its value. Circuit outputs also read 0 on the factory stage outside Test mode, since the circuit only plays in Test mode and on the board. In the code editor preview it reads what you set in the Test tab.',
        'In Lua 0 counts as true, so compare a binary input with 1: if input("Gate") == 1 then ... end',
      ]],
      ['code', '-- input "Env" (analog) reads a circuit\'s Analog output, wired from an Envelope follower (0 to 1)\nfunction draw()\n  clear()\n  local env = input("Env")\n  text("ENV", 2, 2, colors.dim)\n  meter(2, 12, W - 4, 8, env)\n  graph(2, 24, W - 4, H - 26, history("env", env, 60), colors.fg, 0, 1)\nend\n'],
      ['code', '-- input "Gate" (binary) reads a Binary output, for example from a Comparator\nfunction draw()\n  clear()\n  if input("Gate") == 1 then\n    fillCircle(W - 8, 8, 5, colors.good)\n  else\n    circle(W - 8, 8, 5, colors.dim)\n  end\n  text("GATE", 2, 4, colors.fg)\nend\n'],
      ['code', '-- or react only when the input changes, with on()\nlocal hits = 0\non("input", "Gate", function(e)\n  if e.value == 1 then hits += 1 end\nend)\nfunction draw()\n  clear()\n  text("HITS " .. hits, 2, 2)\nend\n'],
      ['h', 'Writing outputs'],
      ['p', 'output(n, value) sets an output, and the circuit inputs it drives follow. The value goes in as it is (no 0 to 1 mapping like a knob), kept within the circuit input\'s own range: an Analog input part is 0 to 1 unless you change its Low and High, a Binary input takes 0 or 1. When a knob and a screen output drive the same input, the values are combined (averaged unless the input says otherwise). Until the script sets an output, it sends its default value (0 unless the design gives the output another one) to the inputs it drives.'],
      ['code', '-- output "Boost" (binary) drives a circuit\'s Binary input\nlocal on = outputValue("Boost") == 1\nfunction draw()\n  clear()\n  on = toggle("BOOST", 2, 2, W - 4, 14, on)\n  output("Boost", on)\nend\n'],
      ['code', '-- output "Rate" (analog) drives an LFO\'s Rate input (set that Analog input\'s Low and High to 0.1 and 10)\nlocal rate = outputValue("Rate")\nif rate == 0 then rate = 1 end\nfunction draw()\n  clear()\n  rate = slider("RATE", 2, 2, W - 4, 12, rate, 0.1, 10)\n  output("Rate", math.round(rate, 2))\n  text(string.format("%.2f Hz", rate), 2, 18)\nend\n'],
      ['p', 'Tips for outputs:'],
      ['list', [
        'Calling output() every frame is fine: only changes are sent to the engine.',
        'On the board an output change is saved with the preset and can be undone, like turning a knob (a burst of changes is one undo step). outputValue() gives the saved value back when the screen starts again, as in the examples above.',
        'Outputs change at the screen\'s frame rate (about 20 a second). For a smooth sweep put a Smoother part after the circuit input, or ease the value in the script: shown = shown + (target - shown) * 0.3',
        'Round values that change all the time (math.round(v, 2)) or send them less often with if every(50) then ... end, so the engine and the undo history get fewer changes.',
        'For a button that is only on while pressed: output("Hold", mouse.down and inside(0, 0, W, H))',
        'On the board a screen runs only while its pedal is in view, so its outputs stop changing when you scroll away. Build anything that must keep running into the circuit itself.',
      ]],
      ['h', 'Listing the ports'],
      ['code', '-- every input with its value\nfunction draw()\n  clear()\n  for i, name in ipairs(ports().ins) do\n    text(name .. ": " .. string.format("%.2f", input(i)), 2, 2 + (i - 1) * 9)\n  end\nend\n'],
      ['h', 'A screen wired both ways'],
      ['p', 'An auto wah with a screen that shows the envelope and sets the sensitivity. In the circuit, an Envelope follower goes to an Analog output "Env", and the circuit has an Analog input "Sensitivity" (0 to 1) and a Binary input "Freeze". The screen has input 1 "Env" (analog, reads the circuit\'s "Env"), output 1 "Sens" (analog, drives "Sensitivity") and output 2 "Hold" (binary, drives "Freeze").'],
      ['code', '-- reads the envelope, sets the sensitivity, holds the sweep\nlocal sens = outputValue("Sens")\nif sens == 0 then sens = 0.5 end\nlocal hold = outputValue("Hold") == 1\n\nfunction draw()\n  clear()\n  local env = input("Env")\n  text("ENV", 2, 2, colors.dim, "small")\n  bar(22, 2, W - 24, 6, env)\n  sens = slider("SENS", 2, 12, W - 4, 10, sens)\n  output("Sens", math.round(sens, 2))\n  hold = toggle("HOLD", 2, 26, 40, 12, hold)\n  output("Hold", hold)\n  if hold then fillCircle(W - 8, 32, 4, colors.warn) end\nend\n'],
      ['h', 'Trying it out'],
      ['list', [
        'In the code editor the **Test** tab has a slider (analog) or a check box (binary) for each screen input, and shows what each output is set to.',
        'In the factory\'s **Test** mode and on the board the inputs and outputs are live: the circuit runs and the screen reads and drives it.',
      ]],
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
    group: 'Code files',
    intro: 'A pedal can have code files next to the code of each screen: write shared functions once and use them from every screen of the pedal. Add them with New in the file list on the left of the code editor (a code file ends in .lua). Code files are saved with the design and with the saved pedal.',
    items: [
      ['require', 'm = require(name)', 'Run a code file of this pedal and get what it returns (usually a table of functions). name is the file without .lua, folders with / or . ("util", "lib/notes"). A file runs once: the next require gives the same value.'],
    ],
    guide: [
      ['h', 'Writing a code file'],
      ['list', [
        'A code file is a normal script. What it returns is what require gives back, so most code files make a table, put functions in it and return it at the end.',
        'Functions written without local (function helper() ... end) become globals that every file can call, like in Lua. A local table you return keeps things tidy.',
        'Code files can require other code files. Two files that require each other in a loop are an error that names both.',
        'All files share the screen\'s globals (W, H, colors, the drawing functions ...) and its work budget.',
        'An error in a code file names the file and its line, like **util.lua line 3**. Click it in the status to open the file at that line. The hints know the functions of the other files: after m. the completion lists what util.lua returns.',
        'A screen restarts when its code or any code file changes. require only loads code saved with the design: a .lua file a script writes with fs.write is data.',
      ]],
      ['code', '-- util.lua: shared helpers\nlocal M = {}\nfunction M.db(v)\n  return 20 * math.log(math.max(v, 0.00001), 10)\nend\nfunction M.title(s)\n  text(s, 2, 2, colors.dim, "small")\nend\nreturn M\n'],
      ['code', '-- the screen: use them\nlocal util = require("util")\nfunction draw()\n  clear()\n  util.title("LEVEL")\n  text(string.format("%.1f dB", util.db(signal("in"))), 2, 12)\nend\n'],
    ],
  },
  {
    group: 'Files',
    intro: 'Every pedal has its own small store of files, shared by all its screens: settings, user presets, lists, logs or your own file formats. Paths look like "presets/1.txt": letters, digits, space, _ - and ., with / between folders (no .., no / at the start). Everything together (the screens\' code, code files and data files) can use 1 MB per pedal.',
    items: [
      ['fs.read', 'fs.read(path)', 'The text of a file, or nil when there is no such file.'],
      ['fs.write', 'fs.write(path, text)', 'Write a file (made if needed, replaced if it is there). Folders are made as needed.'],
      ['fs.append', 'fs.append(path, text)', 'Add text to the end of a file (made if needed).'],
      ['fs.exists', 'fs.exists(path)', 'True when there is a file or folder there.'],
      ['fs.remove', 'fs.remove(path)', 'Remove a file (or an empty folder). True when something was removed.'],
      ['fs.rename', 'fs.rename(from, to)', 'Rename or move a file.'],
      ['fs.list', 'fs.list([folder])', 'The names in a folder (the top when left out): files first, then folders with / at the end.'],
      ['fs.mkdir', 'fs.mkdir(path)', 'Make an empty folder.'],
      ['fs.isDir', 'fs.isDir(path)', 'True when the path is a folder.'],
      ['fs.size', 'fs.size(path)', 'Size of a file in bytes, or nil.'],
      ['fs.free', 'fs.free(), fs.used(), fs.budget()', 'Bytes left, bytes used and the budget (1048576) of the pedal\'s files.'],
      ['fs.readBytes', 'fs.readBytes(path)', 'A file as a list of numbers from 0 to 255.'],
      ['fs.readBin', 'fs.readBin(path)', 'A file as a byte string (one character per byte), for bin.unpack and s:byte(i).'],
      ['fs.writeBytes', 'fs.writeBytes(path, bytes)', 'Write bytes: a list of numbers from 0 to 255, or a byte string from bin.pack.'],
      ['fs.appendBytes', 'fs.appendBytes(path, bytes)', 'Add bytes to the end of a file.'],
    ],
    guide: [
      ['h', 'Where files are kept'],
      ['list', [
        '**Files you make in the code editor** (code files and any starting data) belong to the design: they are saved with it and with the saved pedal.',
        '**Files a script writes on the board** belong to that pedal on the board: they are saved with the preset, so user presets kept on a pedal are still there next time. Each pedal on the board has its own. A script that writes over a file of the design changes it for that pedal only, and a new version of the design still brings its new code.',
        '**In the code editor preview and in Test mode** scripts write to a sandbox for this session. The file list shows those files marked preview: **Keep** copies one into the design, **Reset** forgets them.',
        'Writing is cheap: files are saved a moment after the last write, not on every call. Undo does not undo file writes.',
      ]],
      ['h', 'Text and bytes'],
      ['list', [
        'fs.read and fs.write are for text (saved as UTF-8). For your own formats use fs.readBin / fs.writeBytes with bin.pack and bin.unpack (or lists of numbers with fs.readBytes).',
        'A byte string has one character per byte (0 to 255): s:byte(i) gives byte i, #s the length, string.char(65, 66) makes one.',
        'When a write would go over 1 MB, or a path is not allowed, the call stops the script with an error that says why (use pcall to catch it). fs.free() tells how much room is left.',
      ]],
      ['code', '-- user presets kept on the pedal: tap SAVE to store the knobs, tap a slot to load it\nlocal slot = 1\nfunction draw()\n  clear()\n  slot = tabs({"1", "2", "3"}, 0, 0, W, 12, slot)\n  local path = "presets/" .. slot .. ".txt"\n  if button("SAVE", 2, 16, 40, 14) then\n    fs.write(path, knob(1) .. "," .. knob(2))\n  end\n  if fs.exists(path) and button("LOAD", 46, 16, 40, 14) then\n    local v = fs.read(path):split(",")\n    setKnob(1, tonumber(v[1]))\n    setKnob(2, tonumber(v[2]))\n  end\n  text(string.format("%d KB free", fs.free() // 1024), 2, H - 9, colors.dim, "small")\nend\n'],
      ['code', '-- a log that keeps the last notes, one line each\non("footswitch_down", function(e)\n  fs.append("log.txt", string.format("%.1f %s\\n", time(), e.name))\nend)\nfunction draw()\n  clear()\n  local lines = (fs.read("log.txt") or ""):split("\\n")\n  for i = math.max(1, #lines - 4), #lines do\n    text(lines[i], 2, 2 + (i - math.max(1, #lines - 4)) * 9)\n  end\nend\n'],
    ],
  },
  {
    group: 'Binary data',
    intro: 'bin turns numbers and text into bytes and back, for your own file formats. The format is a string of letters, like Lua\'s string.pack: "<I2 f s1" is a 16 bit number, a float and a short text.',
    items: [
      ['bin.pack', 'bin.pack(fmt, ...)', 'The values packed into a byte string.'],
      ['bin.unpack', 'a, b, next = bin.unpack(fmt, data, [pos])', 'The values from a byte string, starting at byte pos (default 1), and the position after them.'],
      ['bin.size', 'bin.size(fmt)', 'How many bytes a format takes (not for s and z).'],
      ['bin.bytes', 'bin.bytes(data, [i], [j])', 'The bytes of a byte string as a list of numbers.'],
      ['bin.str', 'bin.str(list)', 'A byte string from a list of numbers from 0 to 255.'],
      ['bin.hex', 'bin.hex(data, [sep])', 'The bytes as hex text, like "01 ff 3a", to look at in print().'],
      ['bin.utf8', 'bin.utf8(text), bin.text(data)', 'Text to UTF-8 bytes, and back.'],
    ],
    guide: [
      ['h', 'Format letters'],
      ['list', [
        '**<** little endian (the default), **>** big endian.',
        '**b** / **B** 8 bit number (signed / unsigned), **h** / **H** 16 bit, **i** / **I** 32 bit (i1 to i4 and I1 to I4 for other sizes).',
        '**f** 32 bit float, **d** 64 bit float.',
        '**s** text with its length in front (s1, s2 or s4 bytes for the length, s is s4), **z** text ending with a zero byte, **c8** exactly 8 bytes of text (padded with zeros), **x** one zero byte.',
        'Spaces are ignored. A number that does not fit its size is an error.',
      ]],
      ['code', '-- a small custom format: a header, then points\nlocal pts = {{10, 0.5}, {20, 0.25}, {30, 1}}\nlocal data = bin.pack("<c4 I2", "PNTS", #pts)\nfor _, p in ipairs(pts) do data = data .. bin.pack("<H f", p[1], p[2]) end\nfs.writeBytes("points.bin", data)\n\n-- and read it back\nlocal s = fs.readBin("points.bin")\nlocal magic, n, pos = bin.unpack("<c4 I2", s)\nlocal back = {}\nfor i = 1, n do\n  local x, y\n  x, y, pos = bin.unpack("<H f", s, pos)\n  back[i] = {x, y}\nend\nfunction draw()\n  clear()\n  text(magic .. " " .. n .. " points, " .. #s .. " bytes", 2, 2)\n  text(bin.hex(s:sub(1, 8)), 2, 12, colors.dim, "small")\nend\n'],
    ],
  },
  {
    group: 'Audio',
    intro: 'Scripts run at the screen\'s frame rate (20 to 30 a second), not for every sample, so they never slow the audio down. They read what the engine measures on the pedal\'s audio jacks, and they start and steer small sound makers that run inside the engine: oscillators, noise, envelopes and sample players that play buffers the script fills. Jacks are found by label (any case), "in" (the first input), "out" (the main output), "in 2", "out 2".',
    items: [
      ['audio.level', 'audio.level([jack])', 'How loud the jack is (RMS, 0 to 1). Default: the first input.'],
      ['audio.peak', 'audio.peak([jack])', 'The peak level (0 to 1).'],
      ['audio.spectrum', 'audio.spectrum([jack], [bins])', 'A list of bins (4 to 64, default 32) from 0 to 1, low to high (40 Hz to 16 kHz).'],
      ['audio.wave', 'audio.wave([jack], [n])', 'The last n samples (16 to 1024, default 128) from -1 to 1, to draw a scope.'],
      ['audio.pitch', 'audio.pitch([jack])', 'The pitch in Hz, 0 when there is none.'],
      ['audio.onset', 'audio.onset([jack])', 'True in the frame a new note started.'],
      ['audio.analysis', 'audio.analysis([jack], [bins], [n])', 'All of it in one table: rms, peak, pitch, onset, onsets (a count), bands, wave.'],
      ['audio.jacks', 'audio.jacks()', 'The names of the pedal\'s audio jacks.'],
      ['audio.ready', 'audio.ready()', 'True when the engine takes sounds (on the board without it, audio.gen gives false).'],
      ['audio.gen', 'audio.gen(name, settings)', 'Start a sound maker, or change one that runs: {type = "saw", freq = 110, amp = 0.3, to = "out"}. Only changes are sent.'],
      ['audio.note', 'audio.note(name, [freq], [amp])', 'Start a note on a sound maker (its envelope starts again).'],
      ['audio.release', 'audio.release(name)', 'Let the note go (the envelope releases).'],
      ['audio.stop', 'audio.stop(name)', 'Stop and remove a sound maker or a processor.'],
      ['audio.buffer', 'audio.buffer(name, samples, [rate])', 'Fill a buffer with samples from -1 to 1 (a wavetable or a short sample, up to 96000 samples). rate in Hz, default 48000.'],
      ['audio.play', 'audio.play(name, buffer, [settings])', 'Play a buffer, from the start each time: {loop = true, rate = 1, amp = 0.5, to = "out"}.'],
      ['audio.fx', 'audio.fx(name, settings)', 'A simple processor on a jack: {type = "lowpass", jack = "out", freq = 800, q = 0.7}. Types: gain, lowpass, highpass, bandpass, drive.'],
    ],
    guide: [
      ['h', 'Settings'],
      ['list', [
        '**type**: sine, square, saw, tri, pulse, noise or sample (audio.play sets sample).',
        '**freq** (Hz), **amp** (0 to 1), **pw** (pulse width for pulse, 0 to 1).',
        '**attack**, **decay**, **release** (seconds) and **sustain** (0 to 1): an envelope. With one, **gate = true** starts the note and **gate = false** lets it go (audio.note and audio.release do that for you). Without an envelope the sound plays while it runs.',
        '**to**: where it goes. An output jack ("out") adds it after the circuit, an input jack ("in") adds it to what goes into the circuit, "circuit:Name" feeds a circuit input part with that name.',
        '**buffer**, **loop**, **rate** (1 is as written), **start** (0 to 1) for samples, **pan** (-1 to 1).',
        'For audio.fx: **jack**, **gain**, **freq**, **q**, **amount** (drive) and **mix** (0 to 1).',
      ]],
      ['h', 'Keep it light'],
      ['list', [
        'A screen can run 16 sound makers and 16 processors, with 192000 samples of buffers. Sounds stop when the screen starts again (a code change, a new preset).',
        'Only changes reach the engine, so calling audio.gen every frame is fine. Steer the circuit itself with output() and setInput() as before.',
        'There is no code for every sample: make your own sound by writing it into a buffer (a wavetable, a short sample) and playing it.',
        'In the code editor preview the jacks carry a demo guitar plus your own sounds (not played out loud), so the analysis moves. On the board the engine does the work.',
      ]],
      ['code', '-- a spectrum and a scope of the input\nfunction draw()\n  clear()\n  local bands = audio.spectrum("in", 32)\n  local bw = W / #bands\n  for i, v in ipairs(bands) do\n    fillRect((i - 1) * bw, H - v * H, bw - 1, v * H, hsv(i * 8, 0.8, 1))\n  end\n  graph(0, 0, W, H / 2, audio.wave("in", 128), colors.fg, -1, 1)\nend\n'],
      ['code', '-- a drone: a knob sets the pitch, the footswitch plays a note\naudio.gen("drone", {type = "saw", freq = 55, amp = 0.2, attack = 0.05, release = 0.8, to = "out"})\non("footswitch_down", function(e) audio.note("drone") end)\non("footswitch_up", function(e) audio.release("drone") end)\nfunction draw()\n  clear()\n  local f = 40 + knob(1) * 200\n  audio.gen("drone", {freq = math.round(f)})\n  text(math.round(f) .. " Hz", 2, 2)\n  meter(2, H - 10, W - 4, 8, audio.level("out"))\nend\n'],
      ['code', '-- a wavetable made in the script, played in a loop\nlocal wt = {}\nfor i = 1, 256 do\n  local t = (i - 1) / 256\n  wt[i] = 0.6 * math.sin(t * 2 * math.pi) + 0.3 * math.sin(t * 6 * math.pi)\nend\naudio.buffer("table", wt)\naudio.play("pad", "table", {loop = true, rate = 220 * 256 / 48000, amp = 0.25})\nfunction draw()\n  clear()\n  graph(0, 0, W, H, wt, colors.accent, -1, 1)\n  text(audio.ready() and "PLAYING" or "NO ENGINE", 2, 2, colors.dim, "small")\nend\n'],
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
for (const n of ['fs', 'bin', 'audio', 'fs.used', 'fs.budget', 'bin.text', 'H', 'icons', 'palettes', 'unclip', 'pop', 'rotate', 'scale', 'smooth', 'setCtl', 'setPedalOn', 'ipairs', 'tonumber', 'type', 'error', 'assert', 'select', 'unpack', 'next']) API_NAMES.add(n);

// ------------------------------------------------------------------ types for the editor's hints
// One line per function: name(param: type, optional?: type, rest...: type) -> returns, overloads joined by " | ".
// Types: number, string (text only), text (anything shown as text), color, bool, table, function, any, and the
// named lists font, size, align, theme, icon, kind, signal, control (or control.knob ...) and port.in / port.out.
const SIG_SRC = `
draw(dt: number)
update(dt: number)
setup()
onPress(x: number, y: number)
onMove(x: number, y: number)
onRelease(x: number, y: number)
onWheel(d: number, x: number, y: number)
onControl(name: string, value: any)
onFoot(name: string, on: bool)
onKey(key: string)
clear(color?: color)
pixel(x: number, y: number, color?: color)
line(x1: number, y1: number, x2: number, y2: number, color?: color, width?: number)
rect(x: number, y: number, w: number, h: number, color?: color, width?: number)
fillRect(x: number, y: number, w: number, h: number, color?: color)
roundRect(x: number, y: number, w: number, h: number, r: number, color?: color, width?: number)
fillRoundRect(x: number, y: number, w: number, h: number, r: number, color?: color)
circle(x: number, y: number, r: number, color?: color, width?: number)
fillCircle(x: number, y: number, r: number, color?: color)
arc(x: number, y: number, r: number, from: number, to: number, color?: color, width?: number)
pie(x: number, y: number, r: number, from: number, to: number, color?: color)
polygon(points: table, color?: color, filled?: bool)
polyline(points: table, color?: color, width?: number)
gradient(x: number, y: number, w: number, h: number, color1: color, color2: color, vertical?: bool)
sprite(rows: table, x: number, y: number, scale?: number, colors?: table)
icon(name: icon, x: number, y: number, size?: number, color?: color)
icons() -> table
scanlines(amount?: number, step?: number)
glow(radius?: number, color?: color)
alpha(a?: number)
lineWidth(w?: number)
smooth(on?: bool)
clip(x: number, y: number, w: number, h: number)
unclip()
push()
pop()
translate(x: number, y: number)
rotate(deg: number)
scale(k: number, ky?: number)
text(s: text, x: number, y: number, color?: color, size?: size, align?: align, font?: font) -> number
font(name: font, size?: size)
textWidth(s: text, size?: size, font?: font) -> number
digits(s: text, x: number, y: number, size?: number, color?: color, unlit?: color)
color(c?: color) -> color
theme(name: theme) -> table
palette(name: theme) -> table
palettes() -> table
rgb(r: number, g: number, b: number, a?: number) -> color
hsv(hue: number, sat?: number, val?: number) -> color
mix(c1: color, c2: color, t?: number) -> color
fade(c: color, a?: number) -> color
bar(x: number, y: number, w: number, h: number, value: number, color?: color, back?: color)
meter(x: number, y: number, w: number, h: number, value: number, segments?: number)
ring(x: number, y: number, r: number, value: number, color?: color, width?: number, back?: color)
gauge(x: number, y: number, r: number, value: number, color?: color, from?: number, to?: number)
graph(x: number, y: number, w: number, h: number, values: table, color?: color, min?: number, max?: number, filled?: bool)
history(name: string, value: number, count?: number) -> table
button(label: text, x: number, y: number, w: number, h: number, color?: color) -> bool
toggle(label: text, x: number, y: number, w: number, h: number, on: bool) -> bool
slider(label: text, x: number, y: number, w: number, h: number, value: number, min?: number, max?: number) -> number
dial(label: text, x: number, y: number, r: number, value: number) -> number
list(items: table, x: number, y: number, w: number, h: number, selected: number) -> number
tabs(names: table, x: number, y: number, w: number, h: number, current: number) -> number
pager(count: number, page: number, x?: number, y?: number, w?: number, h?: number) -> number
textfield(name: string, x: number, y: number, w: number, h: number, text: text, max?: number) -> string
tapped(x: number, y: number, w: number, h: number) -> bool
inside(x: number, y: number, w: number, h: number) -> bool
focused() -> bool
closeKeyboard(keep?: bool)
knob(name: control.knob) -> number
setKnob(name: control.knob, value: number) -> bool
switch(name: control.switch) -> number
setSwitch(name: control.switch, position: number) -> bool
dip(n: control.dip) -> bool | dip(label: string, n: number) -> bool
setDip(n: control.dip, on: bool) -> bool | setDip(label: string, n: number, on: bool) -> bool
footswitch(name?: control.foot) -> bool
setFootswitch(name: control.foot, on: bool) -> bool
pushbutton(name?: control.button) -> bool
setPushbutton(name: control.button, on: bool) -> bool
ctl(name: control) -> any
setCtl(name: control, value: any) -> bool
valueText(name: control) -> string
controls(kind?: kind) -> table
controlInfo(name: control) -> table
pedalOn() -> bool
setPedalOn(on: bool)
bypassed() -> bool
lastControl() -> table
signal(name: signal) -> number
setInput(name: string, value: number) -> bool
signals() -> table
input(port?: port.in) -> number
output(port: port.out, value: number) -> bool
outputValue(port?: port.out) -> number
ports() -> table
time() -> number
dt() -> number
frame() -> number
every(ms: number) -> bool
blink(ms?: number) -> bool
save(key: string, value: any)
load(key: string, default?: any) -> any
print(values...: any)
on(event: event, fn: function) -> table | on(event: event, name: target, fn: function) -> table
off(handle: table) -> bool
events() -> table
require(name: module) -> any
fs.read(path: file) -> string
fs.write(path: file, text: text) -> bool
fs.append(path: file, text: text) -> bool
fs.exists(path: file) -> bool
fs.remove(path: file) -> bool
fs.rename(from: file, to: string) -> bool
fs.list(folder?: string) -> table
fs.mkdir(path: string) -> bool
fs.isDir(path: string) -> bool
fs.size(path: file) -> number
fs.used() -> number
fs.free() -> number
fs.budget() -> number
fs.readBytes(path: file) -> table
fs.readBin(path: file) -> string
fs.writeBytes(path: file, bytes: any) -> bool
fs.appendBytes(path: file, bytes: any) -> bool
bin.pack(fmt: string, values...: any) -> string
bin.unpack(fmt: string, data: string, pos?: number) -> any
bin.size(fmt: string) -> number
bin.bytes(data: string, i?: number, j?: number) -> table
bin.str(bytes: table) -> string
bin.hex(data: string, sep?: string) -> string
bin.utf8(text: text) -> string
bin.text(data: string) -> string
audio.level(jack?: jack) -> number
audio.peak(jack?: jack) -> number
audio.spectrum(jack?: jack, bins?: number) -> table
audio.wave(jack?: jack, n?: number) -> table
audio.pitch(jack?: jack) -> number
audio.onset(jack?: jack) -> bool
audio.analysis(jack?: jack, bins?: number, n?: number) -> table
audio.jacks() -> table
audio.ready() -> bool
audio.gen(name: text, settings: table) -> bool
audio.note(name: text, freq?: number, amp?: number) -> bool
audio.release(name: text) -> bool
audio.stop(name: text) -> bool
audio.buffer(name: text, samples: table, rate?: number) -> bool
audio.play(name: text, buffer: text, settings?: table) -> bool
audio.fx(name: text, settings: table) -> bool
tostring(v: any) -> string
tonumber(v: any) -> number
type(v: any) -> string
pairs(t: table)
ipairs(t: table)
next(t: table, key?: any)
unpack(t: table)
select(n: any, values...: any)
pcall(fn: function, args...: any)
error(message: any)
assert(v: any, message?: any)
math.floor(x: number) -> number
math.ceil(x: number) -> number
math.abs(x: number) -> number
math.sqrt(x: number) -> number
math.sin(rad: number) -> number
math.cos(rad: number) -> number
math.tan(rad: number) -> number
math.asin(x: number) -> number
math.acos(x: number) -> number
math.atan(y: number, x?: number) -> number
math.exp(x: number) -> number
math.log(x: number, base?: number) -> number
math.pow(x: number, y: number) -> number
math.min(values...: number) -> number
math.max(values...: number) -> number
math.fmod(a: number, b: number) -> number
math.modf(x: number) -> number
math.random(m?: number, n?: number) -> number
math.randomseed(seed?: number)
math.tointeger(x: number) -> number
math.type(x: any) -> string
math.clamp(v: number, lo?: number, hi?: number) -> number
math.lerp(a: number, b: number, t: number) -> number
math.round(x: number, digits?: number) -> number
math.map(v: number, a: number, b: number, c: number, d: number) -> number
math.sign(x: number) -> number
math.rad(deg: number) -> number
math.deg(rad: number) -> number
string.len(s: string) -> number
string.sub(s: string, i?: number, j?: number) -> string
string.upper(s: string) -> string
string.lower(s: string) -> string
string.rep(s: string, n: number, sep?: string) -> string
string.reverse(s: string) -> string
string.byte(s: string, i?: number, j?: number) -> number
string.char(codes...: number) -> string
string.format(fmt: string, values...: any) -> string
string.find(s: string, sub: string, init?: number) -> number
string.match(s: string, sub: string) -> string
string.gsub(s: string, from: string, to: string) -> string
string.split(s: string, sep?: string) -> table
string.trim(s: string) -> string
string.startsWith(s: string, prefix: string) -> bool
string.endsWith(s: string, suffix: string) -> bool
string.pad(s: text, n: number, ch?: string) -> string
table.insert(t: table, value: any, more?: any)
table.remove(t: table, pos?: number) -> any
table.concat(t: table, sep?: string, i?: number, j?: number) -> string
table.sort(t: table, cmp?: function)
table.unpack(t: table)
table.count(t: table) -> number
table.contains(t: table, value: any) -> bool
`;

// what a parameter means, by name (fn.param wins over param)
const PDOC = {
  x: 'Pixels from the left edge.', y: 'Pixels from the top.', w: 'Width in pixels.', h: 'Height in pixels.', r: 'Radius in pixels.',
  x1: 'Start, pixels from the left.', y1: 'Start, pixels from the top.', x2: 'End, pixels from the left.', y2: 'End, pixels from the top.',
  color: 'A colour: "#rrggbb", a name like "red", or a theme colour like "fg" or "accent".', width: 'Line width in pixels.', back: 'Colour of the empty part.',
  from: 'Start angle in degrees, 0 is up, clockwise.', to: 'End angle in degrees.', value: 'The value to show or set.', label: 'Text on the widget.',
  name: 'A name.', s: 'The text (numbers are fine).', size: 'Pixels, or tiny, small, normal, big, huge.', align: 'left, center, right or middle.', font: 'pixel, mono, sans, condensed, bold or digits.',
  on: 'true or false.', ms: 'Milliseconds.', t: 'A table.', key: 'The name to keep it under.', points: 'A list {x1, y1, x2, y2, ...}.', dt: 'Seconds since the last frame.',
  port: 'The port number (1 is the first) or its name.', kind: 'knob, switch, dip, foot or button.', v: 'Any value.', values: 'A list of numbers.',
  'clear.color': 'The fill colour (default: the theme background).', 'arc.r': 'Radius in pixels.', 'icon.name': 'An icon name: icons() lists them.', 'icon.size': 'Size in pixels (default 12).',
  'glow.radius': 'How far it glows, in pixels. 0 turns it off.', 'alpha.a': '0 (invisible) to 1 (solid).', 'scale.k': 'How much bigger (1 is the same size).', 'rotate.deg': 'Degrees, clockwise.',
  'text.color': 'Text colour.', 'digits.size': 'Height in pixels (default 16).', 'digits.unlit': 'Colour of the dark segments.', 'gradient.vertical': 'true (default) fades top to bottom.',
  'polygon.filled': 'true (default) fills it, false draws the outline.', 'sprite.rows': 'A list of strings, one per row of pixels.', 'sprite.colors': 'Which colour each character is: {["#"] = "fg"}.',
  'theme.name': 'oled, lcd, amber, tft, phosphor, ice, sunset, paper, neon, mono, amp or pico.', 'palette.name': 'A theme name.', 'rgb.r': 'Red, 0 to 255.', 'rgb.g': 'Green, 0 to 255.', 'rgb.b': 'Blue, 0 to 255.', 'rgb.a': 'See through, 0 to 1.',
  'hsv.hue': 'Hue, 0 to 360.', 'hsv.sat': 'Saturation, 0 to 1.', 'hsv.val': 'Brightness, 0 to 1.', 'mix.t': '0 is c1, 1 is c2.', 'fade.a': 'How solid, 0 to 1.',
  'bar.value': '0 (empty) to 1 (full).', 'meter.value': '0 to 1.', 'meter.segments': 'How many LEDs.', 'ring.value': '0 to 1.', 'gauge.value': '0 to 1.', 'gauge.from': 'Angle at 0 (default -60).', 'gauge.to': 'Angle at 1 (default 60).',
  'graph.min': 'Value at the bottom.', 'graph.max': 'Value at the top.', 'history.name': 'Which history to keep.', 'history.count': 'How many values to keep (default: the screen width).',
  'toggle.on': 'The current state.', 'slider.value': 'The current value.', 'slider.min': 'Lowest value (default 0).', 'slider.max': 'Highest value (default 1).', 'dial.value': 'The current value, 0 to 1.',
  'list.items': 'A list of strings.', 'list.selected': 'The picked item number.', 'tabs.names': 'A list of tab names.', 'tabs.current': 'The open tab number.', 'pager.count': 'How many pages.', 'pager.page': 'The current page.',
  'textfield.name': 'A name for the field (keeps its keyboard state).', 'textfield.text': 'The current text.', 'textfield.max': 'Longest text allowed.',
  'knob.name': 'A knob label, "Knob 2" or a number.', 'setKnob.name': 'A knob label, "Knob 2" or a number.', 'setKnob.value': '0 to 1.', 'switch.name': 'A switch label or number.', 'setSwitch.name': 'A switch label or number.', 'setSwitch.position': 'From 1.',
  'dip.n': 'A DIP switch number, or its name like "DIP 2".', 'dip.label': 'The DIP block label.', 'setDip.n': 'A DIP switch number, or its name.', 'setDip.label': 'The DIP block label.',
  'footswitch.name': 'A footswitch label, number or letter ("A").', 'setFootswitch.name': 'A footswitch label, number or letter.', 'pushbutton.name': 'A button label or number.', 'setPushbutton.name': 'A button label or number.',
  'ctl.name': 'Any control label.', 'setCtl.name': 'Any control label.', 'valueText.name': 'Any control label.', 'controlInfo.name': 'Any control label.',
  'signal.name': 'in, out, inDb, outDb, env, on, lfo, tempo, or "stage.key".', 'setInput.name': 'A circuit input like "delay.time".',
  'input.port': 'Input number (1 is the first, the default) or its name.', 'output.port': 'Output number or its name.', 'output.value': 'Analog: a number (-255 to 255). Binary: true / false or 0 / 1.', 'outputValue.port': 'Output number or its name.',
  'on.event': 'change, switch, encoder, footswitch_down, footswitch_up, button_down, button_up, dip, input, bypass, touch, drag, release, wheel, key or timer.',
  'on.name': 'Which control (or screen input, or the milliseconds for timer). Leave it out to hear them all.', 'on.fn': 'function(e) ... end, e has the details.',
  'off.handle': 'What on() gave back.',
  'every.ms': 'How often, in milliseconds.', 'blink.ms': 'Milliseconds on, then off (default 500).', 'save.value': 'Numbers, text, true / false or tables.', 'load.default': 'What to give when nothing is kept.',
  path: 'A path like "presets/1.txt" in the pedal\'s files.', 'fs.list.folder': 'A folder (the top when left out).', 'fs.rename.from': 'The file to rename.', 'fs.rename.to': 'The new path.',
  'fs.write.text': 'The text to write.', 'fs.append.text': 'The text to add.', bytes: 'A list of numbers from 0 to 255, or a byte string.', fmt: 'Format letters, like "<I2 f s1".',
  data: 'A byte string (from fs.readBin or bin.pack).', 'bin.unpack.pos': 'Where to start, from 1 (default 1).', 'require.name': 'A code file of this pedal, without .lua.',
  jack: 'An audio jack: its label, "in", "out", "in 2" ... (default: the first input).', bins: 'How many bands, 4 to 64 (default 32).', 'audio.wave.n': 'How many samples, 16 to 1024 (default 128).', 'audio.analysis.n': 'How many samples for wave (default 128).',
  'audio.gen.name': 'Your name for the sound, like "bass".', settings: 'A table: {type = "saw", freq = 110, amp = 0.3, to = "out"} ...', freq: 'Pitch in Hz.', amp: 'Volume, 0 to 1.',
  samples: 'A list of numbers from -1 to 1.', 'audio.buffer.rate': 'Samples per second (default 48000).', 'audio.play.buffer': 'The name of a buffer from audio.buffer.',
  'math.round.digits': 'Digits after the point (default 0).', 'string.format.fmt': 'Like "%.1f" or "%d ms".',
};
// short descriptions for names the API list only mentions next to others
const EXTRA_DESC = {
  H: 'Height of the screen in pixels.', unclip: 'Stop clipping (see clip).', pop: 'Restore what push() saved.', rotate: 'Turn what you draw next.', scale: 'Scale what you draw next.',
  translate: 'Move what you draw next.', smooth: 'Smooth (true) or crisp pixel (false) scaling of images.', icons: 'The names of the built in icons.', palettes: 'The names of the themes.',
  setCtl: 'Set any control by name.', setPedalOn: 'Turn the pedal on or off.', tonumber: 'A number from text (nil when it is not one).', type: 'The type of a value: number, string, table ...',
  ipairs: 'Loop over a list: for i, v in ipairs(list) do ... end', pairs: 'Loop over a table: for k, v in pairs(t) do ... end', next: 'The next key and value of a table.', unpack: 'The items of a list as separate values.',
  select: 'select(n, ...) gives the values from n on, select("#", ...) how many.', error: 'Stop with an error message.', assert: 'Stop with an error when v is false or nil.', tostring: 'A value as text.', print: 'Show values in the editor console.',
  W: 'Width of the screen in pixels.', screen: 'screen.type and screen.name.', colors: 'The colours of the current theme: colors.bg, colors.fg ...', mouse: 'The pointer: mouse.x, mouse.y, mouse.down, mouse.pressed, mouse.released.',
  math: 'Maths functions: math.floor, math.clamp ...', string: 'Text functions: string.format, s:upper() ...', table: 'List functions: table.insert, table.sort ...',
};
const MEMBER_DESC = {
  'math.floor': 'Round down.', 'math.ceil': 'Round up.', 'math.abs': 'The value without its sign.', 'math.sqrt': 'Square root.', 'math.sin': 'Sine (radians).', 'math.cos': 'Cosine (radians).', 'math.tan': 'Tangent (radians).',
  'math.asin': 'Arc sine.', 'math.acos': 'Arc cosine.', 'math.atan': 'Arc tangent, or the angle of y, x.', 'math.exp': 'e to the power x.', 'math.log': 'Logarithm (natural, or to a base).', 'math.pow': 'x to the power y.',
  'math.min': 'The smallest value.', 'math.max': 'The largest value.', 'math.fmod': 'Remainder of a / b.', 'math.modf': 'Whole and fraction parts.', 'math.random': 'random() 0 to 1, random(n) 1 to n, random(m, n) m to n.',
  'math.randomseed': 'Does nothing (kept for Lua code).', 'math.tointeger': 'The number when it is whole, else nil.', 'math.type': 'integer, float or nil.', 'math.clamp': 'Keep v between lo and hi (default 0 and 1).',
  'math.lerp': 'Between a and b (t from 0 to 1).', 'math.round': 'Round to the nearest, with optional digits.', 'math.map': 'Map v from a..b to c..d.', 'math.sign': '-1, 0 or 1.', 'math.rad': 'Degrees to radians.', 'math.deg': 'Radians to degrees.',
  'math.pi': 'Pi, 3.14159...', 'math.huge': 'Infinity.', 'math.maxinteger': 'The biggest whole number.', 'math.mininteger': 'The smallest whole number.',
  'string.len': 'Length of the text (or #s).', 'string.sub': 'Part of the text, from i to j.', 'string.upper': 'In capitals.', 'string.lower': 'In small letters.', 'string.rep': 'The text n times.', 'string.reverse': 'Backwards.',
  'string.byte': 'Character codes.', 'string.char': 'Text from character codes.', 'string.format': 'Format values: string.format("%.1f dB", v).', 'string.find': 'Where sub is (plain text).', 'string.match': 'sub when the text has it.',
  'string.gsub': 'Replace every from with to (plain text).', 'string.split': 'A list of the parts between sep.', 'string.trim': 'Without spaces at the ends.', 'string.startsWith': 'True when the text starts with prefix.',
  'string.endsWith': 'True when the text ends with suffix.', 'string.pad': 'Padded on the left to n characters.',
  'table.insert': 'Add to the end, or at a position: table.insert(t, pos, v).', 'table.remove': 'Take out the last item (or the one at pos).', 'table.concat': 'Join the items into text.', 'table.sort': 'Sort a list (cmp(a, b) says a comes first).',
  'fs.used': 'Bytes the pedal\'s files use (with the screens\' code).', 'fs.budget': 'The budget of the pedal\'s files: 1048576 bytes (1 MB).', 'bin.text': 'Text from UTF-8 bytes.',
  fs: 'The pedal\'s files: fs.read, fs.write, fs.list ...', bin: 'Bytes for your own file formats: bin.pack, bin.unpack ...', audio: 'Audio of the jacks and sounds in the engine: audio.level, audio.gen ...',
  'table.unpack': 'The items as separate values.', 'table.count': 'How many keys a table has.', 'table.contains': 'True when the table has the value.',
};
// fields of the built in tables (for completion after a dot)
export const FIELDS = {
  colors: ['bg', 'fg', 'dim', 'accent', 'warn', 'good', 'bad', 'panel'],
  mouse: ['x', 'y', 'down', 'pressed', 'released', 'wheel'],
  screen: ['w', 'h', 'type', 'name'],
};

function parseParams(s) {
  if (!s.trim()) return [];
  return s.split(',').map((p) => {
    const m = /^\s*([A-Za-z_][\w]*)(\.\.\.|\?)?\s*:\s*([\w.]+)\s*$/.exec(p);
    return { name: m[1], opt: m[2] === '?' || m[2] === '...', rest: m[2] === '...', type: m[3] };
  });
}
/** name -> { name, desc, overloads: [{ params: [{name, type, opt, rest, doc}], ret }], callback } */
export const SIGS = new Map();
{
  const desc = new Map();
  for (const g of API) for (const [n, , d] of g.items) desc.set(n, d);
  for (const line of SIG_SRC.split('\n')) {
    if (!line.trim()) continue;
    const overloads = [];
    let name = '';
    for (const part of line.split(' | ')) {
      const m = /^([\w.]+)\((.*)\)(?:\s*->\s*(\w+))?$/.exec(part.trim());
      name = m[1];
      const params = parseParams(m[2]);
      for (const p of params) p.doc = PDOC[name + '.' + p.name] || PDOC[p.name] || '';
      overloads.push({ params, ret: m[3] || '' });
    }
    SIGS.set(name, { name, overloads, desc: desc.get(name) || MEMBER_DESC[name] || EXTRA_DESC[name] || '', callback: false });
  }
  for (const g of API) if (g.group === 'Running') for (const [n] of g.items) SIGS.get(n).callback = true;
}
/** A short description for any API word (functions, tables, constants). */
export function describe(name) {
  const s = SIGS.get(name);
  if (s) return s.desc;
  for (const g of API) for (const [n, , d] of g.items) if (n === name) return d;
  return MEMBER_DESC[name] || EXTRA_DESC[name] || '';
}
/** Parameter type as shown to people. */
export const typeLabel = (t) => (t.startsWith('control') ? 'control' : t.startsWith('port') ? 'port' : t === 'target' ? 'name' : t === 'file' ? 'path' : t);
/** "rect(x: number, y: number, [color: color]) -> nil" as plain text. */
export function sigText(name, ov) {
  const ps = ov.params.map((p) => (p.opt && !p.rest ? `[${p.name}: ${typeLabel(p.type)}]` : `${p.name}${p.rest ? '...' : ''}: ${typeLabel(p.type)}`));
  return `${name}(${ps.join(', ')})${ov.ret ? ' -> ' + ov.ret : ''}`;
}

// ------------------------------------------------------------------ Markdown
const mdText = (s) => s.replace(/\|/g, '\\|');
function guideMarkdown(blocks, out) {
  for (const [k, v] of blocks) {
    if (k === 'h') out.push(`### ${v}`, '');
    else if (k === 'p') out.push(v, '');
    else if (k === 'list') out.push(...v.map((x) => '* ' + x), '');
    else if (k === 'code') out.push('```lua', v.replace(/\n$/, ''), '```', '');
  }
}
/** The reference as Markdown (docs/screen-scripts.md has it between "# API reference" and the host bridge). */
export function apiMarkdown() {
  const out = [];
  for (const g of API) {
    out.push(`## ${g.group}`, '');
    if (g.intro) out.push(g.intro, '');
    out.push('| Call | What it does |', '| --- | --- |');
    for (const [, sig, desc] of g.items) out.push(`| \`${mdText(sig)}\` | ${mdText(desc)} |`);
    out.push('');
    if (g.guide) guideMarkdown(g.guide, out);
  }
  return out.join('\n');
}
