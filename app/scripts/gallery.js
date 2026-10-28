// expression: lay out a gallery of block types (for screenshots)
const types = process.argv[2].split(',');
const cols = +(process.argv[3] || 6);
console.log(`(() => {
  const S = window.__tz.state; const ed = window.__tz.editor;
  const types = ${JSON.stringify(types)};
  const p = { version:1, name:'Gallery', blocks:[{id:'__in',type:'__in',x:-9999,y:-9999,params:{}},{id:'__out',type:'__out',x:-9999,y:-8000,params:{}}], cables:[] };
  types.forEach((t,i)=>p.blocks.push({id:'g'+i,type:t,x:0,y:0,params:{},bypass:false}));
  import('./js/state.js').then(m=>{ m.loadPreset(p,null);
    let x=0,y=0,rowH=0,c=0;
    for (const b of S.preset.blocks) { if (b.id.startsWith('__')) { ed.views.get(b.id).g.style.display='none'; continue; }
      const v = ed.views.get(b.id); v.setPosition(x,y); x += v.w + 60; rowH = Math.max(rowH, v.h); if (++c % ${cols} === 0) { x=0; y+=rowH+70; rowH=0; } }
    const blocks = S.preset.blocks.filter(b=>!b.id.startsWith('__'));
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; for (const b of blocks){const v=ed.views.get(b.id); x0=Math.min(x0,b.x);y0=Math.min(y0,b.y);x1=Math.max(x1,b.x+v.w);y1=Math.max(y1,b.y+v.h);}
    document.getElementById('browser').style.display='none'; document.getElementById('inspector').style.display='none'; const r = ed.svg.getBoundingClientRect(); const z=Math.min((r.width-40)/(x1-x0),(r.height-90)/(y1-y0+30)); ed.view={z, x:(r.width-(x1-x0)*z)/2-x0*z, y:20-y0*z}; ed.applyView();
    document.getElementById('browser').style.display='none'; document.getElementById('inspector').style.display='none';
  });
})()`);
