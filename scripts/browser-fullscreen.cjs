async page => {
  await page.goto(new URL('/', page.url()).href);
  await page.locator('#start').click();
  await page.keyboard.press('p');
  const before = await page.evaluate(async () => (await import('/src/main.js')).inspectGame());
  await page.locator('#fullscreen').click();
  await page.waitForFunction(() => document.fullscreenElement?.id === 'battle-screen');
  const fullscreen = await page.evaluate(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top:r.top, bottom:r.bottom, left:r.left, right:r.right }; };
    return { target:document.fullscreenElement.id, game:rect('.battle-section'), status:rect('.right-column'), width:innerWidth, height:innerHeight };
  });
  if (fullscreen.status.left < fullscreen.game.right || fullscreen.status.right > fullscreen.width + 1) throw Error('Fullscreen status column is missing or clipped');
  if (Math.abs(fullscreen.game.top-fullscreen.status.top)>1 || Math.abs(fullscreen.game.bottom-fullscreen.status.bottom)>1) throw Error('Fullscreen game and status must align');
  if (fullscreen.game.top < 0 || fullscreen.game.bottom > fullscreen.height + 1) throw Error('Fullscreen game must fit vertically');
  if (await page.locator('#fullscreen').getAttribute('aria-label') !== '退出全屏') throw Error('Exit label must reflect fullscreen state');
  await page.screenshot({path:'output/playwright/fullscreen-with-status.png'});
  await page.locator('#fullscreen').click();
  await page.waitForFunction(() => document.fullscreenElement === null);
  const after = await page.evaluate(async () => (await import('/src/main.js')).inspectGame());
  if (after.seed !== before.seed || after.level !== before.level || after.time !== before.time || !after.paused) throw Error('Fullscreen toggle must preserve battle state');
  await page.locator('#fullscreen').click();
  await page.waitForFunction(() => document.fullscreenElement?.id === 'battle-screen');
  await page.locator('#reroll').click();
  await page.waitForFunction(() => document.fullscreenElement === null);
  if (!await page.locator('#setup-screen').isVisible()) throw Error('Returning to setup must exit fullscreen');
  await page.locator('#return-battle').click();
  const restored = await page.evaluate(() => {
    const header = document.querySelector('.topbar').getBoundingClientRect(), main = document.querySelector('.dashboard').getBoundingClientRect();
    return Math.abs(header.left-main.left)<1 && Math.abs(header.right-main.right)<1;
  });
  if (!restored) throw Error('Normal layout must restore after fullscreen');
  return {fullscreen, battleStatePreserved:true, exitButton:true, exitOnSetup:true, normalLayoutRestored:true};
}
