const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  await win.waitForTimeout(2000);
  await win.evaluate(() => {
    window.__t3log = [];
    const orig = document.createElement.bind(document);
  });
  await win.click('#tabs [data-tab="tone3000"]');
  await win.evaluate(() => {
    const wv = document.querySelector('webview');
    ['did-start-loading','did-stop-loading','did-fail-load','did-finish-load','dom-ready','crashed','render-process-gone','console-message'].forEach(ev => wv.addEventListener(ev, e => window.__t3log.push(ev + ' ' + (e.errorCode||'') + ' ' + (e.errorDescription||'') + ' ' + (e.message||'') + ' ' + (e.validatedURL||''))));
  });
  await win.waitForTimeout(12000);
  console.log(await win.evaluate(() => { const wv = document.querySelector('webview'); let u=''; try { u = wv.getURL(); } catch(e) { u = 'ERR ' + e.message; } return u + '\n' + window.__t3log.join('\n'); }));
  await app.close();
})();
