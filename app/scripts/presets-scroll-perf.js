// Scroll the presets tab for 10 s and print per-process CPU (renderer / gpu-process). usage: node scripts/presets-scroll-perf.js [shot.png]
const { _electron: electron } = require('playwright');
const path = require('path'); const fs = require('fs');
const APP = '/home/claude/tone-zone/app';
let ROOT = 0;
function inTree(pid){for(let p=+pid,i=0;p>1&&i<20;i++){if(p===ROOT)return true;try{p=+fs.readFileSync(`/proc/${p}/stat`,'utf8').split(') ')[1].split(' ')[1];}catch{return false;}}return false;}
function procTimes(){const out={};for(const pid of fs.readdirSync('/proc').filter(x=>/^\d+$/.test(x))){try{const cmd=fs.readFileSync(`/proc/${pid}/cmdline`,'utf8');if(!/electron|tonezone-engine/.test(cmd))continue;if(!inTree(pid))continue;const st=fs.readFileSync(`/proc/${pid}/stat`,'utf8').split(') ')[1].split(' ');let type=(cmd.match(/--type=([a-z-]+)/)||[,'main'])[1];if(/tonezone-engine/.test(cmd))type='engine';out[type]=(out[type]||0)+(+st[11]+ +st[12])/100;}catch{}}return out;}
(async()=>{
  const app = await electron.launch({ executablePath: require('electron'), args:[APP,'--no-sandbox'] });
  ROOT = app.process().pid;
  const win = await app.firstWindow();
  await win.setViewportSize({width:1600,height:950}).catch(()=>{});
  await win.waitForFunction(()=>window.__tz&&window.__tz.ready,null,{timeout:120000});
  await win.click('#tabs [data-tab="presets"]');
  await win.waitForTimeout(8000); // thumbnails
  const a=procTimes(), t0=Date.now();
  await win.evaluate(async()=>{const sc=[...document.querySelectorAll('#view-presets *')].find(e=>e.scrollHeight>e.clientHeight+50&&getComputedStyle(e).overflowY!=='visible');window.__sc=sc;let d=1;const end=performance.now()+10000;while(performance.now()<end){sc.scrollTop+=d*40;if(sc.scrollTop+sc.clientHeight>=sc.scrollHeight-2)d=-1;if(sc.scrollTop<=0)d=1;await new Promise(r=>requestAnimationFrame(r));}});
  const b=procTimes(), dt=(Date.now()-t0)/1000;
  const r={};for(const k in b)r[k]=+(((b[k]-(a[k]||0))/dt)*100).toFixed(1);
  console.log(JSON.stringify(r));
  await win.screenshot({path:process.argv[2]||'/tmp/ps.png'});
  await app.close();
})();
