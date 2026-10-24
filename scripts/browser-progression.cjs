async page => {
  await page.clock.install();
  await page.addInitScript(() => {
    let value = 10;
    crypto.getRandomValues = array => { array[0] = value++; return array; };
  });
  const state = () => page.evaluate(async () => (await import('/src/main.js')).inspectGame());
  const runUntil = async expected => {
    for (let i = 0; i < 960; i++) {
      await page.clock.runFor(250);
      const s = await state();
      if (s.status === expected) return s;
      if (s.status !== 'playing') throw Error(`Expected ${expected}, got ${s.status}`);
    }
    throw Error('Battle did not finish in simulation budget');
  };
  await page.reload();
  await page.locator('[data-mode=demo]').click();
  await page.locator('#difficulty').selectOption('hard');
  await page.locator('#start').click();
  const initial = await state();
  const lost = await runUntil('lost');
  const button = await page.locator('#game-overlay button').innerText();
  if (!button.includes('重试当前关卡')) throw Error('Loss button must retry');
  if (!(await page.locator('#game-overlay .overlay-hint').innerText()).includes('重试第 1 关')) throw Error('Loss countdown must retry');
  await page.clock.runFor(3600);
  const automaticRetry = await state();
  if (automaticRetry.level !== 1 || automaticRetry.seed !== initial.seed || automaticRetry.attempt !== 1 || automaticRetry.score !== 0) throw Error('Automatic loss advanced or failed to reset: '+JSON.stringify(automaticRetry));
  await page.reload();
  await page.locator('[data-mode=demo]').click();
  await page.locator('#difficulty').selectOption('hard');
  await page.locator('#start').click();
  await runUntil('lost');
  await page.locator('#game-overlay button').click();
  const manualRetry = await state();
  if (manualRetry.level !== 1 || manualRetry.seed !== initial.seed || manualRetry.attempt !== 1) throw Error('Manual retry advanced');
  await page.reload();
  await page.locator('[data-mode=demo]').click();
  await page.locator('[data-ai="2"]').click();
  await page.locator('#difficulty').selectOption('easy');
  await page.locator('#start').click();
  const beforeWin = await state();
  const won = await runUntil('won');
  if (!(await page.locator('#game-overlay button').innerText()).includes('进入下一关')) throw Error('Victory button must advance');
  await page.clock.runFor(3600);
  const next = await state();
  if (next.level !== 2 || next.seed === beforeWin.seed || next.attempt !== 0 || next.score < won.score) throw Error('Victory did not advance correctly');
  return {lost, automaticRetry, manualRetry, won, next};
}
