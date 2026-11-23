// בדיקת האתר החי: מצלם, בודק שגיאות ושהאלמנטים העיקריים במקום. רץ ב-GitHub Actions.
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.SITE_URL || 'https://yanai-lez.github.io/background-studio/';
const OUT = process.env.OUT_DIR || 'qa-out';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const report = { url: URL, time: new Date().toISOString(), checks: [], errors: [] };
  const ok = (name, pass, info = '') => { report.checks.push({ name, pass, info }); console.log(pass ? 'PASS' : 'FAIL', name, info); };
  const b = await chromium.launch();
  for (const [name, vp] of [['mobile', { width: 400, height: 860 }], ['desktop', { width: 1280, height: 900 }]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, locale: 'he-IL' });
    const p = await ctx.newPage();
    p.on('pageerror', e => report.errors.push(name + ': ' + e.message));
    p.on('requestfailed', r => { if (!/puter|fonts|gradio|hf\.space|huggingface/.test(r.url())) report.errors.push(name + ' request failed: ' + r.url()); });
    await p.goto(URL, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => report.errors.push('goto: ' + e.message));
    await p.waitForTimeout(1500);
    const info = await p.evaluate(() => {
      const q = id => document.getElementById(id);
      const g = q('gen'), f = q('fmts');
      return {
        title: document.title,
        modes: [...document.querySelectorAll('#modeSeg button')].map(x => x.textContent.trim()),
        gen: !!g, genAfterFormats: !!(g && f && (f.compareDocumentPosition(g) & 4)),
        gallery: document.querySelectorAll('.gitem').length,
        logo: !!document.querySelector('h1 .logo'),
        og: (document.querySelector('meta[property="og:image"]') || {}).content || '',
        scaleDefault: q('scale') && q('scale').value,
        sw: 'serviceWorker' in navigator,
      };
    });
    ok(name + ': נטען', !!info.title, info.title);
    ok(name + ': שני מצבים', info.modes.length === 2, info.modes.join(' | '));
    ok(name + ': כפתור היצירה אחרי הפורמטים', info.genAfterFormats);
    ok(name + ': גלריה', info.gallery >= 8, String(info.gallery));
    ok(name + ': לוגו בכותרת', info.logo);
    ok(name + ': תמונת תצוגה לשיתוף', /og-image/.test(info.og), info.og);
    await p.screenshot({ path: `${OUT}/${name}-top.png` });
    await p.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true });
    // תמונה לדוגמה, כדי לבדוק שהתהליך לא נשבר
    await p.setInputFiles('#file', 'qa/sample.png');
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${OUT}/${name}-loaded.png` });
    await p.click('#modeSeg button:nth-child(2)');
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${OUT}/${name}-ready-bg-mode.png`, fullPage: true });
    await ctx.close();
  }
  for (const f of ['manifest.json', 'sw.js', 'icons/icon-512.png', 'icons/og-image.jpg', 'backgrounds/backgrounds.json']) {
    const r = await fetch(URL + f); ok('קובץ ' + f, r.ok, String(r.status));
  }
  ok('אין שגיאות JS', report.errors.length === 0, report.errors.slice(0, 5).join(' ; '));
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  await b.close();
  process.exit(report.checks.every(c => c.pass) ? 0 : 1);
})();
