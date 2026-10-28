const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: ['/home/claude/tone-zone/app', '--no-sandbox'] });
  const win = await app.firstWindow();
  win.on('console', (m) => console.log('console', m.type(), m.text()));
  await win.waitForTimeout(3000);
  const r = await win.evaluate(async () => {
    try {
      const w = window.open('about:blank', 'tz-panel-x', 'width=300,height=400');
      if (!w) return 'null window';
      const out = [];
      out.push('url ' + w.location.href);
      const d = w.document;
      out.push('body ' + !!d.body);
      d.body.appendChild(d.createElement('div')).textContent = 'hello';
      await new Promise((r) => setTimeout(r, 500));
      out.push('after ' + d.body.innerHTML + ' same doc ' + (w.document === d));
      return out.join(' | ');
    } catch (e) { return 'ERR ' + e.message; }
  });
  console.log(r);
  await app.close();
})();
