import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, GRID, TILE, BASE, POWERS, ENEMY_TYPES, blankMap, generateMap, validateMap, findPath, protectedCell, BASE_WALLS } from '../src/engine.js';
import { nextStageOptions, retryStageOptions } from '../src/campaign.js';

const tick = (game, seconds, inputs = []) => { for (let t = 0; t < seconds * 60; t++) game.update(1 / 60, inputs); };
function isolated(options = {}) { const game = new Game({ map: blankMap(), seed: 42, ...options }); game.spawnTimer = 999; return game; }

test('1000 generated maps have legal connected routes and protected spawn areas', () => {
  for (let seed = 0; seed < 1000; seed++) {
    const map = generateMap(seed); assert.equal(validateMap(map).valid, true, `seed ${seed}`);
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (protectedCell(x, y)) assert.equal(map[y][x], 0);
  }
  assert.deepEqual(generateMap(17), generateMap(17)); assert.notDeepEqual(generateMap(17), generateMap(18));
});

test('all free ground is connected without breaking any walls, including every spawn and base approach', () => {
  for (let seed = 0; seed < 1000; seed++) {
    const map = generateMap(seed), seen = new Set(['8,24']), queue = [[8, 24]];
    const allowed = (x, y) => x >= 0 && x < 26 && y >= 0 && y < 26 && !(y >= 24 && x >= 12 && x <= 13) && [0, 4, 5].includes(map[y][x]);
    for (let head = 0; head < queue.length; head++) {
      const [x, y] = queue[head];
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        const key = `${nx},${ny}`;
        if (allowed(nx, ny) && !seen.has(key)) { seen.add(key); queue.push([nx, ny]); }
      }
    }
    for (const [x, y] of [[2, 1], [12, 1], [23, 1], [17, 24], [12, 22], [13, 22]]) assert.ok(seen.has(`${x},${y}`), `seed ${seed} must connect ${x},${y}`);
    for (let y = 0; y < 26; y++) for (let x = 0; x < 26; x++) if (allowed(x, y)) assert.ok(seen.has(`${x},${y}`), `seed ${seed} has an isolated free cell at ${x},${y}`);
    for (const [x, y] of BASE_WALLS) assert.equal(map[y][x], 1, 'connectivity repair must preserve fortification');
  }
});

test('old fixed lanes now vary with the seed rather than being forcibly cleared', () => {
  const maps = Array.from({ length: 100 }, (_, seed) => generateMap(seed));
  for (const x of [2, 12, 23]) {
    const occupancy = maps.map(map => map.slice(3, 21).filter(row => [1, 2, 3].includes(row[x])).length);
    assert.ok(occupancy.some(n => n > 0), `column ${x} must not be permanently cleared`);
    assert.ok(new Set(occupancy).size > 3, `column ${x} must vary naturally`);
  }
  for (const y of [1, 10, 18, 22]) assert.ok(maps.some(map => map[y].some(t => [1, 2, 3].includes(t))), `row ${y} must not be a fixed full-width road`);
  // Straight passages are allowed: this checks variation, not a ban on line of sight.
  assert.equal(new Set(maps.map(map => JSON.stringify(map))).size, 100);
});

test('the generator retains varied terrain and deterministic behavior across full-width seeds', () => {
  const types = new Set();
  for (const seed of [0, 1, 8, 42, 101, 1985, 0x7fffffff, 0x80000000, 0xffffffff, -1]) {
    const map = generateMap(seed);
    assert.deepEqual(map, generateMap(seed)); assert.equal(validateMap(map).valid, true);
    const filled = map.flat().filter(t => t > 0).length;
    assert.ok(filled > 100 && filled < 500, `seed ${seed} should keep both terrain and maneuvering space`);
    map.flat().forEach(t => types.add(t));
  }
  assert.deepEqual([...types].sort(), [0, 1, 2, 3, 4, 5]);
});
test('map import rejects bad dimensions, unknown tiles, blocked spawns and sealed routes', () => {
  assert.equal(validateMap([]).valid, false);
  let map = blankMap(); map[3][3] = 7; assert.equal(validateMap(map).valid, false);
  map = blankMap(); map[1][2] = 2; assert.equal(validateMap(map).valid, false);
  map = blankMap(); map[4].fill(2); assert.equal(validateMap(map).valid, false);
  map[4][12] = 1; assert.equal(validateMap(map).valid, true, 'destructible escape is valid');
});

test('map validation accepts legitimate routes around the bottom rows and the base footprint', () => {
  const map = blankMap();
  map[22].fill(2); map[23].fill(2);
  for (const x of [1, 24]) { map[22][x] = 0; map[23][x] = 0; }
  map[22][12] = 0;
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (protectedCell(x, y)) map[y][x] = 0;
  assert.equal(validateMap(map).valid, true);
  assert.equal(validateMap(generateMap(658)).valid, true, 'regression for a generated bottom-route map');
});
test('weighted pathfinding avoids water and steel, but can route through breakable brick', () => {
  const map = blankMap(); for (let y = 0; y < GRID; y++) map[y][3] = 2;
  map[5][3] = 1;
  const path = findPath(map, { x: 60, y: 60 }, { x: 132, y: 60 });
  assert.ok(path.some(p => p.x === 84 && p.y === 132)); assert.deepEqual(path.at(-1), { x: 132, y: 60 });
  map[5][3] = 3; const blocked = findPath(map, { x: 60, y: 60 }, { x: 132, y: 60 }); assert.notDeepEqual(blocked.at(-1), { x: 132, y: 60 });
});
test('two human players move and shoot independently with friendly fire disabled', () => {
  const g = isolated({ mode: 'duo' });
  tick(g, 0.4, [{ dir: 0, fire: true }, { dir: 3, fire: true }]);
  assert.ok(g.players[0].y < 560); assert.ok(g.players[1].x < 400);
  assert.ok(g.bullets.some(b => b.owner === g.players[0].id)); assert.ok(g.bullets.some(b => b.owner === g.players[1].id));
  const p = g.players[0]; p.shield = 0;
  g.bullets = [{ x: p.x, y: p.y + 8, dir: 0, speed: 300, player: true, owner: g.players[1].id, damage: 1 }];
  g.stepBullets(1 / 30); assert.equal(p.lives, 3);
});
test('walls block movement; shells destroy bricks, pass water and need upgraded firepower for steel', () => {
  for (const [tile, steel, destroyed] of [[1, false, true], [2, false, false], [2, true, true], [3, false, false]]) {
    const g = isolated(); g.map[5][5] = tile;
    const p = g.players[0]; Object.assign(p, { x: 132, y: 156, dir: 0 });
    assert.equal(g.canMove(p, 132, 143), false);
    g.bullets = [{ x: 132, y: 149, dir: 0, speed: 350, player: true, owner: p.id, damage: 1, steel }];
    for (let i = 0; i < 5; i++) g.stepBullets(1 / 30);
    assert.equal(g.map[5][5] === 0, destroyed);
    if (tile === 3) assert.ok(g.bullets.length, 'water lets bullets through');
  }
});
test('four enemy tiers have distinct armor; hits award score exactly once', () => {
  const g = isolated(); for (let i = 0; i < 6; i++) g.spawnEnemy();
  // Free up the spawn points to inspect the fourth tier too.
  g.enemies = []; g.spawned = 5; g.spawnEnemy(); const e = g.enemies[0];
  assert.equal(e.type, 3); assert.equal(e.hp, 4); assert.equal(new Set(ENEMY_TYPES.map(e => e.speed)).size, 4);
  g.killEnemy(e); g.killEnemy(e); assert.equal(g.kills, 1); assert.equal(g.score, 400);
});
test('all seven powerups implement their advertised effects and expire correctly', () => {
  const g = isolated(); const p = g.players[0];
  const power = key => { const v = { ...POWERS.find(p => p.key === key), life: 10 }; g.applyPower(p, v); assert.equal(v.life, 0); };
  power('star'); power('star'); power('star'); assert.equal(p.level, 3);
  power('shield'); assert.equal(p.shield, 12);
  power('life'); assert.equal(p.lives, 4);
  power('clock'); assert.equal(g.freeze, 8);
  power('speed'); assert.equal(p.boost, 12);
  power('shovel'); assert.ok(BASE_WALLS.every(([x, y]) => g.map[y][x] === 2));
  g.spawnEnemy(); power('bomb'); assert.equal(g.enemies.filter(e => e.alive).length, 0); assert.equal(g.kills, 1);
  tick(g, 20.2); assert.equal(g.baseShield <= 0, true); assert.ok(BASE_WALLS.every(([x, y]) => g.map[y][x] === 1));
  assert.equal(p.boost, 0); assert.equal(p.shield, 0); assert.equal(g.freeze, 0);
});
test('death consumes a life, respawns with protection and ends only when the squad is out', () => {
  const g = isolated({ mode: 'duo' }), p = g.players[0]; p.shield = 0; p.level = 3; g.hitPlayer(p);
  assert.equal(p.lives, 2); assert.equal(p.alive, false); assert.equal(p.level, 1);
  tick(g, 1.6); assert.equal(p.alive, true); assert.ok(p.shield > 0);
  for (const player of g.players) Object.assign(player, { lives: 0, alive: false });
  g.update(1 / 60); assert.equal(g.status, 'lost');
});
test('base destruction loses and clearing the final enemy wins', () => {
  const g = isolated();
  g.bullets = [{ x: BASE.x, y: BASE.y - 25, dir: 2, speed: 300, player: false, damage: 1 }];
  tick(g, 0.1); assert.equal(g.baseAlive, false); assert.equal(g.status, 'lost');
  const win = isolated(); win.kills = win.total; win.update(1 / 60); assert.equal(win.status, 'won');
});
test('only victory advances to a new random stage and carries the final player state', () => {
  const g = isolated({ mode: 'demo', aiCount: 2 }); g.players[0].level = 3; g.score = 800; g.status = 'won';
  const config = { mode: 'demo', aiCount: 2, difficulty: 'normal' };
  const next = new Game(nextStageOptions(g, config, 999));
  assert.equal(next.level, 2); assert.equal(next.score, 800); assert.equal(next.players[0].level, 3); assert.notDeepEqual(next.map, g.map); assert.equal(next.players.length, 2);
  for (const status of ['lost', 'playing', 'ready']) { g.status = status; assert.throws(() => nextStageOptions(g, config, 777), /只有胜利/); }
});

test('failure retries the original map and stage, restoring entry score, lives and firepower', () => {
  for (const mode of ['solo', 'duo', 'demo']) {
    const config = { mode, aiCount: 2, difficulty: 'hard' };
    const g = new Game({ ...config, seed: 77, level: 4, score: 1200, carry: [{ lives: 2, level: 3 }, { lives: 4, level: 2 }] });
    const original = g.initialMap.map(row => [...row]);
    g.map[5][5] = g.map[5][5] === 0 ? 1 : 0; g.baseAlive = false; g.score += 900;
    g.players.forEach(p => { p.lives = 0; p.level = 1; }); g.status = 'lost';
    const retry = new Game(retryStageOptions(g, config));
    assert.equal(retry.level, 4); assert.equal(retry.seed, 77); assert.equal(retry.attempt, 1);
    assert.deepEqual(retry.map, original); assert.equal(retry.score, 1200); assert.equal(retry.baseAlive, true);
    assert.equal(retry.players[0].lives, 2); assert.equal(retry.players[0].level, 3);
    if (retry.players[1]) { assert.equal(retry.players[1].lives, 4); assert.equal(retry.players[1].level, 2); }
    assert.equal(retry.kills, 0); assert.equal(retry.remaining, retry.total);
    assert.notEqual(retry.random(), new Game({ ...config, seed: 77 }).random(), 'retry can vary enemy behavior without changing terrain');
    retry.status = 'lost'; const again = new Game(retryStageOptions(retry, config));
    assert.equal(again.level, 4); assert.equal(again.attempt, 2); assert.deepEqual(again.map, original); assert.equal(again.score, 1200);
    again.status = 'won'; const next = new Game(nextStageOptions(again, config, 999));
    assert.equal(next.level, 5); assert.equal(next.attempt, 0); assert.notDeepEqual(next.map, original);
  }
});

test('retry keeps a custom map and cannot restart a stage that has not failed', () => {
  const g = isolated({ mode: 'demo', level: 3 }); g.initialMap[6][6] = 4; g.map[6][6] = 0; g.status = 'lost';
  const retry = new Game(retryStageOptions(g, { mode: 'demo' })); assert.equal(retry.map[6][6], 4); assert.equal(retry.level, 3);
  for (const status of ['won', 'playing', 'ready']) { g.status = status; assert.throws(() => retryStageOptions(g, {}), /只有失败/); }
});
test('one-bot and two-bot demos fight autonomously and reach a real result across seeds', () => {
  let wins = 0, losses = 0;
  for (const aiCount of [1, 2]) for (const seed of [1985, 42, 101, 17, 1234]) {
    const g = new Game({ mode: 'demo', aiCount, seed });
    const startY = g.players[0].y;
    for (let i = 0; i < 180 * 30 && g.status === 'playing'; i++) g.update(1 / 30);
    assert.ok(g.kills > 0, `AI must fight on seed ${seed}`); assert.notEqual(g.players[0].y, startY);
    assert.notEqual(g.status, 'playing', `AI should not deadlock on seed ${seed}`);
    if (g.status === 'won') wins++; else losses++;
  }
  assert.ok(wins > 0); assert.equal(wins + losses, 10);
});

function defenseArena() {
  const game = isolated({ mode: 'demo' });
  Object.assign(game.players[0], { x: 300, y: 300, shield: 0, cooldown: 0, dir: 1 });
  return game;
}
function incoming(x, y, dir, speed = 240) { return { x, y, dir, speed, player: false, owner: 999, damage: 1, dead: false }; }
function defendFor(game, seconds, plannedDir = -1) {
  const p = game.players[0];
  for (let i = 0; i < seconds * 60 && p.alive; i++) {
    p.cooldown = Math.max(0, p.cooldown - 1 / 60);
    if (!game.defend(p, plannedDir, 1 / 60)) game.move(p, plannedDir, 1 / 60);
    game.stepBullets(1 / 60);
  }
}
test('AI turns and actually cancels a head-on shell when trapped in a corridor', () => {
  const g = defenseArena(), p = g.players[0];
  for (let y = 4; y < 22; y++) { g.map[y][11] = 2; g.map[y][13] = 2; }
  g.bullets.push(incoming(300, 168, 2));
  defendFor(g, 0.8);
  assert.equal(p.lives, 3); assert.equal(p.alive, true);
  assert.equal(g.aiStats.counterShots, 1); assert.equal(g.aiStats.interceptions, 1);
  assert.equal(g.bullets.filter(b => !b.player).length, 0);
});
test('AI gives a defensive shot priority over shooting a different aligned enemy', () => {
  const g = defenseArena(), p = g.players[0];
  g.enemies.push({ id: 50, x: 396, y: 300, alive: true, hp: 4, type: 3 });
  g.bullets.push(incoming(300, 192, 2));
  g.brain(p, 1 / 60);
  const shot = g.bullets.find(b => b.player);
  assert.ok(shot); assert.equal(shot.dir, 0, 'must face incoming shell, not shoot east at the decoy');
  assert.equal(g.aiStats.counterShots, 1);
});
test('AI dodges toward the open side while reloading instead of attempting a blocked side', () => {
  const g = defenseArena(), p = g.players[0]; p.cooldown = 0.8;
  g.map[12][13] = 2;
  g.bullets.push(incoming(300, 252, 2));
  defendFor(g, 0.5, 0);
  assert.equal(p.lives, 3); assert.ok(p.x < 287);
  assert.ok(g.aiStats.evasions > 0); assert.equal(g.aiStats.counterShots, 0);
});
test('AI avoids crossfire by reevaluating all shells through the escape maneuver', () => {
  const g = defenseArena(), p = g.players[0]; p.cooldown = 1.5;
  g.bullets.push(incoming(300, 204, 2), incoming(204, 300, 1));
  defendFor(g, 0.8);
  assert.equal(p.lives, 3); assert.equal(p.alive, true);
  assert.ok(Math.abs(p.x - 300) > 13 && Math.abs(p.y - 300) > 13);
});
test('AI predicts danger from walking into a firing lane before it is directly targeted', () => {
  const g = defenseArena(), p = g.players[0]; p.x = 276; p.cooldown = 1;
  g.bullets.push(incoming(300, 252, 2));
  assert.equal(g.defend(p, 1, 1 / 60), true);
  assert.ok(p.x <= 276, 'must not continue east into the shell lane');
  defendFor(g, 0.5, 1); assert.equal(p.lives, 3);
});
test('AI ignores shells behind cover, shells moving away and dead projectiles', () => {
  for (const type of ['cover', 'away', 'dead']) {
    const g = defenseArena(), p = g.players[0];
    const b = incoming(300, 204, type === 'away' ? 0 : 2);
    if (type === 'cover') g.map[10][12] = 1;
    if (type === 'dead') b.dead = true;
    g.bullets.push(b);
    assert.equal(g.defend(p, -1, 1 / 60), false, type);
    assert.equal(g.aiStats.counterShots, 0);
  }
});
test('AI cannot fire countershots while reloading or when all projectile slots are occupied', () => {
  for (const blockedBy of ['cooldown', 'slots']) {
    const g = defenseArena(), p = g.players[0];
    if (blockedBy === 'cooldown') p.cooldown = 0.7;
    else for (let i = 0; i < 2; i++) g.bullets.push({ x: 100, y: 80 + i * 30, dir: 0, speed: 320, player: true, owner: p.id });
    g.bullets.push(incoming(300, 204, 2)); g.defend(p, -1, 1 / 60);
    assert.equal(g.aiStats.counterShots, 0); assert.ok(g.aiStats.evasions > 0);
  }
});

test('base defense takes priority over an earlier personal threat and an aligned enemy', () => {
  const g = defenseArena(), p = g.players[0]; Object.assign(p, { x: 300, y: 540 });
  g.enemies.push({ id: 50, x: 396, y: 540, alive: true, hp: 4, type: 3 });
  g.bullets.push(incoming(300, 396, 2), incoming(228, 540, 1));
  g.brain(p, 1 / 60);
  assert.equal(g.bullets.find(b => b.player).dir, 0, 'must counter the shell heading toward the base first');
});
test('AI sacrifices a life to physically block a base-bound shell when it cannot fire', () => {
  const g = defenseArena(), p = g.players[0]; Object.assign(p, { x: 348, y: 540, cooldown: 2 });
  g.bullets.push(incoming(300, 396, 2));
  tick(g, 0.9);
  assert.equal(g.baseAlive, true); assert.equal(p.lives, 2); assert.equal(p.alive, false);
  assert.equal(g.aiStats.baseBlocks, 1); assert.equal(g.aiStats.counterShots, 0);
  assert.equal(g.bullets.filter(b => !b.player).length, 0);
});
test('AI first uses a countershot to save the base when shooting is available', () => {
  const g = defenseArena(), p = g.players[0]; Object.assign(p, { x: 300, y: 540 });
  g.bullets.push(incoming(300, 396, 2));
  tick(g, 0.9);
  assert.equal(g.baseAlive, true); assert.equal(p.lives, 3);
  assert.equal(g.aiStats.baseInterceptions, 1); assert.equal(g.aiStats.baseBlocks, 0);
});
test('two AI players assign body interception to the shielded defender and avoid two sacrifices', () => {
  const g = isolated({ mode: 'demo', aiCount: 2 }), [p1, p2] = g.players;
  Object.assign(p1, { x: 348, y: 540, cooldown: 2, shield: 0 });
  Object.assign(p2, { x: 252, y: 540, cooldown: 2, shield: 2 });
  g.bullets.push(incoming(300, 396, 2));
  assert.equal(g.protectBase(p1, 1 / 60), false); assert.equal(g.protectBase(p2, 1 / 60), true);
  tick(g, 0.9);
  assert.equal(g.baseAlive, true); assert.equal(p1.lives, 3); assert.equal(p2.lives, 3);
  assert.equal(g.aiStats.baseBlocks, 1);
});
test('base defenders ignore a distant pickup while an attacker is in the base approach', () => {
  const g = defenseArena(), p = g.players[0]; Object.assign(p, { x: 300, y: 516 });
  g.enemies.push({ id: 50, x: 300, y: 468, alive: true, hp: 4, type: 3 });
  g.powers.push({ key: 'star', x: 276, y: 516, life: 20 });
  g.brain(p, 1 / 60);
  assert.equal(p.x, 300); assert.equal(p.attackTargetId, 50);
  assert.ok(g.bullets.some(b => b.player && b.dir === 0), 'must fire on the attacker instead of going west for the pickup');
});

test('a countershot blocked by an enemy tank is not assumed to protect the base', () => {
  const g = defenseArena(), p = g.players[0]; Object.assign(p, { x: 300, y: 540 });
  g.enemies.push({ id: 50, x: 300, y: 480, alive: true, hp: 4, type: 3 });
  g.bullets.push(incoming(300, 396, 2));
  assert.equal(g.protectBase(p, 1 / 60), true);
  assert.equal(g.aiStats.counterShots, 0);
  assert.equal(p.baseBullet, g.bullets[0], 'must prepare to body-block instead of trusting an obstructed shot');
});

test('AI leaves a stale defense position to engage an enemy in an outer lane', () => {
  const g = defenseArena(), p = g.players[0]; Object.assign(p, { x: 204, y: 444 });
  g.enemies.push({ id: 60, x: 60, y: 180, alive: true, hp: 1, type: 0 });
  g.brain(p, 1 / 60);
  assert.ok(p.x < 204 || p.y < 444);
  assert.ok(p.attackPoint.x < 204 || p.attackPoint.y < 444, 'must create a firing lane instead of waiting at x=204');
});

test('AI proactively shoots breakable cover even before reaching the wall', () => {
  const g = defenseArena(), p = g.players[0]; Object.assign(p, { x: 300, y: 444 });
  g.enemies.push({ id: 60, x: 300, y: 300, alive: true, hp: 1, type: 0 });
  g.map[15][12] = 1;
  g.brain(p, 1 / 60);
  assert.ok(g.bullets.some(b => b.player && b.dir === 0));
  for (let i = 0; i < 30; i++) g.stepBullets(1 / 60);
  assert.equal(g.map[15][12], 0);
});

test('AI chooses a reachable flank when steel blocks its direct attack lane', () => {
  const g = defenseArena(), p = g.players[0]; Object.assign(p, { x: 300, y: 444 });
  const enemy = { id: 60, x: 300, y: 300, alive: true, hp: 1, type: 0 };
  g.enemies.push(enemy); for (let y = 14; y <= 16; y++) g.map[y][12] = 2;
  const point = g.planAttack(p, g.enemies);
  assert.notEqual(point.x, 300); assert.equal(point.y, 300);
  assert.ok(g.attackLane({ ...p, ...point }, enemy));
  const path = findPath(g.map, p, point); assert.ok(path.length > 0);
  assert.deepEqual(path.at(-1), { x: point.x, y: point.y });
});

test('two AI players engage separate targets while the support player keeps a rear firing lane', () => {
  const g = isolated({ mode: 'demo', aiCount: 2 }), [p1, p2] = g.players;
  Object.assign(p1, { x: 204, y: 444 }); Object.assign(p2, { x: 420, y: 516 });
  g.enemies.push({ id: 61, x: 60, y: 180, alive: true }, { id: 62, x: 564, y: 180, alive: true });
  g.planAttack(p1, g.enemies); const rear = g.planAttack(p2, g.enemies);
  assert.equal(p1.attackTargetId, 61); assert.equal(p2.attackTargetId, 62);
  assert.ok(rear.y >= 444);
});

test('AI sustains effective fire to destroy heavy armor without closing to point blank', () => {
  const g = defenseArena(), p = g.players[0]; Object.assign(p, { x: 300, y: 444 });
  g.enemies.push({ id: 60, x: 300, y: 300, alive: true, hp: 4, type: 3, speed: 0, dir: 2, cooldown: 999, shield: 0, brainTimer: 0, path: [], boost: 0 });
  tick(g, 2);
  assert.equal(g.kills, 1); assert.equal(g.score, 400); assert.equal(p.lives, 3);
  assert.ok(p.y >= 324, 'must sustain fire rather than ram the target');
});

test('an AI without a living teammate falls back to a position that covers the exposed base', () => {
  const g = isolated({ mode: 'demo', aiCount: 2 }), [p1, p2] = g.players;
  Object.assign(p1, { alive: false, lives: 0 }); Object.assign(p2, { x: 324, y: 180 });
  g.enemies.push({ id: 60, x: 60, y: 108, alive: true });
  const target = g.planAttack(p2, g.enemies);
  assert.ok(target.y >= 324);
});

function pickupArena() {
  const g = defenseArena(); g.supplyTimer = 999;
  Object.assign(g.players[0], { x: 300, y: 444, lives: 2 });
  g.enemies.push({ id: 70, x: 60, y: 108, alive: true, hp: 1, type: 0, speed: 0, dir: 2, cooldown: 999, shield: 0, brainTimer: 0, path: [], boost: 0 });
  return g;
}
for (const spec of POWERS) test(`AI actually routes to and applies ${spec.key} while enemies are present`, () => {
  const g = pickupArena(), p = g.players[0];
  const power = { ...spec, x: 396, y: 444, life: 20 }; g.powers.push(power);
  tick(g, 1.4);
  assert.equal(g.aiStats.pickups, 1, 'must collect the power, not only select a target');
  assert.equal(g.powers.length, 0); assert.equal(p.powerTarget, null);
  if (spec.key === 'star') assert.equal(p.level, 2);
  if (spec.key === 'shield') assert.ok(p.shield > 10);
  if (spec.key === 'life') assert.equal(p.lives, 3);
  if (spec.key === 'bomb') assert.equal(g.kills, 1);
  if (spec.key === 'clock') assert.ok(g.freeze > 6);
  if (spec.key === 'shovel') assert.ok(g.baseShield > 18);
  if (spec.key === 'speed') assert.ok(p.boost > 10);
});

test('AI collects a nearby power above the old defense-line cutoff', () => {
  const g = pickupArena(), p = g.players[0]; Object.assign(p, { x: 300, y: 300 });
  g.powers.push({ ...POWERS[0], x: 300, y: 276, life: 20 });
  tick(g, 0.5); assert.equal(p.level, 2); assert.equal(g.aiStats.pickups, 1);
});

test('AI compares actual route time and expiry rather than chasing unreachable or expiring powers', () => {
  const g = pickupArena(), p = g.players[0];
  const trapped = { ...POWERS.find(p => p.key === 'life'), x: 396, y: 444, life: 20 };
  for (const [x, y] of [[15, 18], [17, 18], [16, 17], [16, 19]]) g.map[y][x] = 2;
  const expiring = { ...POWERS[0], x: 204, y: 444, life: 0.2 };
  g.powers.push(trapped, expiring);
  assert.equal(g.selectPower(p, g.enemies), null);
  const available = { ...POWERS[0], x: 252, y: 444, life: 20 }; g.powers.push(available);
  assert.equal(g.selectPower(p, g.enemies), available);
});

test('AI values needed firepower and lives over already-saturated upgrades', () => {
  const g = pickupArena(), p = g.players[0]; Object.assign(p, { level: 3, lives: 1 });
  const star = { ...POWERS[0], x: 348, y: 444, life: 20 };
  const life = { ...POWERS.find(p => p.key === 'life'), x: 396, y: 444, life: 20 };
  g.powers.push(star, life); assert.equal(g.selectPower(p, g.enemies), life);
});

test('two AI players assign one power to the closer suitable collector', () => {
  const g = isolated({ mode: 'demo', aiCount: 2 }), [p1, p2] = g.players; g.supplyTimer = 999;
  Object.assign(p1, { x: 204, y: 444, shield: 0 }); Object.assign(p2, { x: 420, y: 444, shield: 0 });
  const star = { ...POWERS[0], x: 372, y: 444, life: 20 }; g.powers.push(star);
  assert.equal(g.selectPower(p1, []), null); assert.equal(g.selectPower(p2, []), star);
  tick(g, 1); assert.equal(p1.level, 1); assert.equal(p2.level, 2); assert.equal(g.aiStats.pickups, 1);
});

test('AI abandons a loot target when a base-bound shell requires immediate interception', () => {
  const g = pickupArena(), p = g.players[0]; Object.assign(p, { x: 300, y: 540 });
  const power = { ...POWERS[0], x: 348, y: 540, life: 20 }; g.powers.push(power); p.powerTarget = power;
  g.bullets.push(incoming(300, 396, 2));
  g.brain(p, 1 / 60); assert.equal(p.powerTarget, null);
  assert.ok(g.bullets.some(b => b.player && b.dir === 0)); assert.equal(g.aiStats.pickups, 0);
});

test('AI does not route across an incoming shell for a pickup', () => {
  const g = pickupArena(), p = g.players[0]; p.x = 276; p.cooldown = 1;
  g.powers.push({ ...POWERS[0], x: 348, y: 444, life: 20 });
  g.bullets.push(incoming(300, 396, 2));
  assert.equal(g.selectPower(p, g.enemies), null);
  tick(g, 0.25); assert.equal(p.lives, 2);
});

test('supply placement can traverse legitimate bottom-row routes in the new generator', () => {
  const map = blankMap(); map[23].fill(2); map[22].fill(2);
  map[23][1] = 0; map[22][1] = 0;
  const g = isolated({ mode: 'demo', map });
  g.dropPower(); assert.equal(g.powers.length, 1);
  assert.ok(g.powers[0].y / TILE < 22);
});
