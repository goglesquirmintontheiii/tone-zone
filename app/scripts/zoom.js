// helper expression generator: zoom to a block type
const type = process.argv[2], z = process.argv[3] || 2;
console.log(`(() => { const ed = window.__tz.editor; const b = window.__tz.state.preset.blocks.find(b => b.type === '${type}'); const v = ed.views.get(b.id); const r = ed.svg.getBoundingClientRect(); ed.view.z = ${z}; ed.view.x = r.width/2 - (b.x + v.w/2) * ${z}; ed.view.y = r.height/2 - (b.y + v.h/2) * ${z}; ed.applyView(); })()`);
