async page => {
  await page.clock.install();
  await page.addInitScript(() => {
    for (const key of ['sf-high', 'sf-level', 'sf-audio']) localStorage.removeItem(key);
    let value = 42;
    crypto.getRandomValues = array => { array[0] = value++; return array; };
  });
  const root = new URL('/', page.url()).href;
  await page.setViewportSize({width:1440,height:1024});
  await page.goto(root);
  await page.screenshot({path:'docs/screenshots/start-screen.png'});

  await page.locator('[data-mode=duo]').click();
  await page.locator('#start').click();
  await page.clock.runFor(5000);
  await page.keyboard.down('Space'); await page.keyboard.down('Enter');
  await page.clock.runFor(1800);
  await page.keyboard.up('Space'); await page.keyboard.up('Enter');
  await page.screenshot({path:'docs/screenshots/local-coop.png'});

  await page.locator('#reroll').click();
  await page.locator('[data-mode=demo]').click();
  await page.locator('[data-ai="2"]').click();
  await page.locator('#start').click();
  await page.clock.runFor(12000);
  const demo = await page.evaluate(async () => (await import('/src/main.js')).inspectGame());
  if(demo.status !== 'playing') throw Error('Demo screenshot must show a running battle');
  await page.screenshot({path:'docs/screenshots/ai-demo.png'});

  await page.locator('#nav-editor').click();
  await page.locator('#editor-random').click();
  await page.locator('#level-name').fill('城市防线');
  await page.screenshot({path:'docs/screenshots/level-editor.png'});
  await page.locator('#editor-dialog .close-dialog').click();

  await page.locator('#fullscreen').click();
  await page.waitForFunction(() => document.fullscreenElement?.id === 'battle-screen');
  await page.screenshot({path:'docs/screenshots/fullscreen.png'});
  await page.locator('#fullscreen').click();
  await page.waitForFunction(() => document.fullscreenElement === null);

  await page.setViewportSize({width:390,height:844});
  await page.goto(root);
  await page.locator('#start').click();
  await page.clock.runFor(3000);
  await page.screenshot({path:'docs/screenshots/mobile.png',fullPage:true});
  return {files:6, source:'actual Chromium UI', desktop:'1440×1024',mobile:'390×844, full-page',demo};
}
