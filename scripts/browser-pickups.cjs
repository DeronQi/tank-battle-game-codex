async page => {
  await page.clock.install();
  await page.addInitScript(() => { let value = 0; crypto.getRandomValues = array => { array[0] = value++; return array; }; });
  await page.goto(new URL('/', page.url()).href);
  await page.locator('[data-mode=demo]').click();
  await page.locator('[data-ai="2"]').click();
  await page.locator('#start').click();
  const inspect = () => page.evaluate(async () => (await import('/src/main.js')).inspectGame());
  let state;
  for (let i = 0; i < 100; i++) {
    await page.clock.runFor(500);
    state = await inspect();
    if (state.aiStats.pickups >= 2) break;
    if (state.status !== 'playing') throw Error('Expected AI to collect supplies before the battle ended');
  }
  if (state.aiStats.pickups < 2) throw Error('AI did not actively collect supplies');
  if (state.level !== 1 || state.players.length !== 2) throw Error('Unexpected demo state');
  await page.screenshot({path:'output/playwright/ai-pickups.png'});
  return state;
}
