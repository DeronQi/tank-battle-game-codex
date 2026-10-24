// Simulation is independent of the DOM so maps, combat and AI can be tested headlessly.
export const GRID = 26;
export const TILE = 24;
export const SIZE = GRID * TILE;
export const TERRAIN = { EMPTY: 0, BRICK: 1, STEEL: 2, WATER: 3, FOREST: 4, ICE: 5 };
export const DIRECTIONS = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
export const ENEMY_TYPES = [
  { name: '侦察型', hp: 1, speed: 51, cooldown: 1.8, score: 100, color: '#d3b87c' },
  { name: '突击型', hp: 1, speed: 79, cooldown: 1.7, score: 200, color: '#e28d54' },
  { name: '速射型', hp: 2, speed: 55, cooldown: 0.85, score: 300, color: '#a3bcc0' },
  { name: '重装型', hp: 4, speed: 39, cooldown: 1.35, score: 400, color: '#b89dd3' },
];
export const POWERS = [
  { key: 'star', symbol: '★', name: '火力升级', color: '#efc96d' },
  { key: 'shield', symbol: '◇', name: '无敌护盾', color: '#7fbdc1' },
  { key: 'bomb', symbol: '✹', name: '全屏轰炸', color: '#ef9c75' },
  { key: 'life', symbol: '♥', name: '额外生命', color: '#e79a98' },
  { key: 'clock', symbol: '◷', name: '时间冻结', color: '#aaa4d9' },
  { key: 'shovel', symbol: '▣', name: '基地加固', color: '#b9c992' },
  { key: 'speed', symbol: 'ϟ', name: '极速突袭', color: '#edcb8b' },
];
export const BASE = { x: 312, y: 600, half: 20 };
export const PLAYER_SPAWNS = [{ x: 204, y: 588 }, { x: 420, y: 588 }];
export const ENEMY_SPAWNS = [{ x: 60, y: 36 }, { x: 300, y: 36 }, { x: 564, y: 36 }];
export const BASE_WALLS = [[11, 23], [12, 23], [13, 23], [14, 23], [11, 24], [14, 24], [11, 25], [14, 25]];

export function seededRandom(seed = Date.now()) {
  let n = seed >>> 0;
  return () => { n += 0x6D2B79F5; let t = Math.imul(n ^ n >>> 15, 1 | n); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function protectedCell(x, y) {
  if (x >= 12 && x <= 13 && y >= 24) return true;
  return [...PLAYER_SPAWNS, ...ENEMY_SPAWNS].some(s => Math.abs(Math.floor(s.x / TILE) - x) <= 1 && Math.abs(Math.floor(s.y / TILE) - y) <= 1);
}
export function blankMap() { return Array.from({ length: GRID }, () => Array(GRID).fill(0)); }
export function generateMap(seed = Date.now()) {
  const random = seededRandom(seed), map = blankMap();
  // Ruins, woodland, wetlands and frost vary terrain balance without imposing a road grid.
  const profiles = [
    [0.57, 0.18, 0.05, 0.15, 0.05],
    [0.42, 0.12, 0.08, 0.33, 0.05],
    [0.42, 0.13, 0.20, 0.20, 0.05],
    [0.43, 0.16, 0.05, 0.10, 0.26],
  ];
  const weights = profiles[Math.floor(random() * profiles.length)];
  const patches = 68 + Math.floor(random() * 24);
  for (let i = 0; i < patches; i++) {
    let roll = random(), type = 1;
    while (type < 5 && roll >= weights[type - 1]) { roll -= weights[type - 1]; type++; }
    const x = Math.floor(random() * GRID), y = Math.floor(random() * GRID);
    const width = 1 + Math.floor(random() * 4), height = 1 + Math.floor(random() * 4);
    for (let yy = y; yy < Math.min(y + height, GRID); yy++) for (let xx = x; xx < Math.min(x + width, GRID); xx++) {
      // Occasional irregular corners break up rectangular patches, rather than tile noise.
      if ((xx === x || xx === x + width - 1) && (yy === y || yy === y + height - 1) && random() < 0.18) continue;
      map[yy][xx] = type;
    }
  }
  // Reserve only actual spawn pads, the base, its walls and a small front landing.
  for (const [x, y] of BASE_WALLS) map[y][x] = 1;
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (protectedCell(x, y)) map[y][x] = 0;
  map[22][12] = 0; map[22][13] = 0;
  connectMapRegions(map, random);
  return map;
}

function connectMapRegions(map, random) {
  const count = GRID * GRID, anchor = 22 * GRID + 12;
  const fortification = new Set(BASE_WALLS.map(([x, y]) => y * GRID + x));
  const baseCell = id => Math.floor(id / GRID) >= 24 && id % GRID >= 12 && id % GRID <= 13;
  const passable = id => !baseCell(id) && [0, 4, 5].includes(map[Math.floor(id / GRID)][id % GRID]);
  // Costs vary by seed. Prefer opening brick over removing steel or draining water;
  // there is deliberately no turn requirement, ray test or straight-line penalty.
  const noise = Array.from({ length: count }, () => 0.8 + random() * 0.4);
  const neighbors = id => {
    const x = id % GRID, y = Math.floor(id / GRID), result = [];
    for (const d of DIRECTIONS) {
      const nx = x + d.x, ny = y + d.y;
      if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID) result.push(ny * GRID + nx);
    }
    return result;
  };
  const flood = () => {
    const seen = new Uint8Array(count), queue = [anchor]; seen[anchor] = 1;
    for (let head = 0; head < queue.length; head++) for (const next of neighbors(queue[head])) {
      if (!seen[next] && passable(next)) { seen[next] = 1; queue.push(next); }
    }
    return { seen, queue };
  };
  // Join disconnected free-ground regions with the cheapest local connector.
  // This guarantees routes without carving any fixed full-height/full-width lanes.
  for (let repair = 0; repair < count; repair++) {
    const { seen, queue } = flood();
    if (!map.some((row, y) => row.some((_, x) => passable(y * GRID + x) && !seen[y * GRID + x]))) return;
    const costs = new Float64Array(count).fill(Infinity), parents = new Int16Array(count).fill(-1), heap = new Heap();
    for (const id of queue) { costs[id] = 0; heap.push({ id, f: 0 }); }
    let target = -1;
    while (heap.items.length) {
      const { id, f } = heap.pop();
      if (f !== costs[id]) continue;
      if (!seen[id] && passable(id)) { target = id; break; }
      for (const next of neighbors(id)) {
        if (baseCell(next) || fortification.has(next)) continue;
        const tile = map[Math.floor(next / GRID)][next % GRID];
        const cost = f + ([1, 2, 4.5, 6, 1, 1][tile] * noise[next]);
        if (cost >= costs[next]) continue;
        costs[next] = cost; parents[next] = id; heap.push({ id: next, f: cost });
      }
    }
    if (target < 0) throw new Error('无法连接随机地图的可行走区域');
    for (let id = target; id >= 0 && !seen[id]; id = parents[id]) {
      const y = Math.floor(id / GRID), x = id % GRID;
      if (!passable(id)) map[y][x] = 0;
    }
  }
  throw new Error('随机地图连通性修复超出限制');
}
export function validateMap(value) {
  const map = value?.tiles ?? value;
  if (!Array.isArray(map) || map.length !== GRID || map.some(row => !Array.isArray(row) || row.length !== GRID || row.some(t => !Number.isInteger(t) || t < 0 || t > 5))) return { valid: false, error: '地图必须是 26 × 26 的网格，地形编号为 0–5。' };
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (protectedCell(x, y) && map[y][x] !== 0) return { valid: false, error: '出生区和基地必须保持空旷。' };
  // Bricks can be destroyed; steel/water cannot be crossed at initial firepower.
  const walkable = (x, y) => x >= 0 && y >= 0 && x < GRID && y < GRID && !(y >= 24 && x >= 12 && x <= 13) && ![2, 3].includes(map[y][x]);
  for (const s of [...PLAYER_SPAWNS, ...ENEMY_SPAWNS]) {
    const start = [Math.floor(s.x / TILE), Math.floor(s.y / TILE)], seen = new Set([start.join(',')]), q = [start];
    let connected = false;
    for (let head = 0; head < q.length; head++) {
      const [x, y] = q[head];
      if (y === 22 && x >= 10 && x <= 15) { connected = true; break; }
      for (const d of DIRECTIONS) { const nx = x + d.x, ny = y + d.y, key = `${nx},${ny}`; if (walkable(nx, ny) && !seen.has(key)) { seen.add(key); q.push([nx, ny]); } }
    }
    if (!connected) return { valid: false, error: '存在被钢墙或水域封闭的出生点，请留出通向基地前方的路线。' };
  }
  return { valid: true, error: '' };
}

const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const wall = t => t === 1 || t === 2 || t === 3;

// Continuous relative-motion collision, including shots that cross between frames.
function sweptHit(x, y, vx, vy, half, horizon) {
  let enter = 0, leave = horizon;
  for (const [p, v] of [[x, vx], [y, vy]]) {
    if (Math.abs(v) < 0.0001) { if (Math.abs(p) > half) return Infinity; continue; }
    const a = (-half - p) / v, b = (half - p) / v;
    enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
    if (enter > leave) return Infinity;
  }
  return enter;
}

// A small binary heap makes weighted A* cheap enough for multiple simultaneous bots.
class Heap {
  items = [];
  push(item) { const a = this.items; a.push(item); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= item.f) break; a[i] = a[p]; i = p; } a[i] = item; }
  pop() { const a = this.items, first = a[0], last = a.pop(); if (a.length) { let i = 0; while (i * 2 + 1 < a.length) { let c = i * 2 + 1; if (c + 1 < a.length && a[c + 1].f < a[c].f) c++; if (a[c].f >= last.f) break; a[i] = a[c]; i = c; } a[i] = last; } return first; }
}
export function findPath(map, from, to, canBreakSteel = false) {
  const sx = clamp(Math.floor(from.x / TILE), 0, 25), sy = clamp(Math.floor(from.y / TILE), 0, 25);
  const tx = clamp(Math.floor(to.x / TILE), 0, 25), ty = clamp(Math.floor(to.y / TILE), 0, 25);
  const start = sy * GRID + sx, goal = ty * GRID + tx, heap = new Heap();
  const costs = new Float32Array(GRID * GRID).fill(Infinity), parents = new Int16Array(GRID * GRID).fill(-1);
  costs[start] = 0; heap.push({ id: start, f: 0, g: 0 });
  let closest = start, best = Infinity;
  while (heap.items.length) {
    const { id, g } = heap.pop(); if (g !== costs[id]) continue;
    const x = id % GRID, y = Math.floor(id / GRID), h = Math.abs(x - tx) + Math.abs(y - ty);
    if (h < best) { best = h; closest = id; }
    if (id === goal) break;
    for (const d of DIRECTIONS) {
      const nx = x + d.x, ny = y + d.y;
      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID || (ny >= 24 && nx >= 12 && nx <= 13)) continue;
      const t = map[ny][nx]; if (t === 3 || (t === 2 && !canBreakSteel)) continue;
      const next = ny * GRID + nx, cost = g + (t === 1 ? 3 : t === 2 ? 7 : 1);
      if (cost >= costs[next]) continue;
      costs[next] = cost; parents[next] = id; heap.push({ id: next, g: cost, f: cost + Math.abs(nx - tx) + Math.abs(ny - ty) });
    }
  }
  const path = [];
  for (let id = closest; id !== start && id >= 0; id = parents[id]) path.push({ x: (id % GRID) * TILE + 12, y: Math.floor(id / GRID) * TILE + 12 });
  return path.reverse();
}

export class Game {
  constructor({ seed = Date.now(), map, level = 1, attempt = 0, difficulty = 'normal', mode = 'solo', aiCount = 1, score = 0, carry, onEvent = () => {} } = {}) {
    this.seed = seed; this.attempt = attempt; this.random = seededRandom(seed ^ 0xabc123 ^ Math.imul(attempt, 0x9e3779b9)); this.map = (map ?? generateMap(seed)).map(row => [...row]);
    this.initialMap = this.map.map(row => [...row]); this.level = level; this.difficulty = difficulty; this.mode = mode; this.aiCount = aiCount; this.score = score; this.onEvent = onEvent;
    this.time = 0; this.status = 'playing'; this.kills = 0; this.total = Math.min(12 + (level - 1) * 2, 30); this.spawned = 0; this.spawnTimer = 0.8;
    this.baseAlive = true; this.baseShield = 0; this.freeze = 0; this.supplyTimer = 14; this.resultTime = 0;
    this.enemies = []; this.bullets = []; this.powers = []; this.effects = []; this.id = 1;
    this.aiStats = { evasions: 0, counterShots: 0, interceptions: 0, baseBlocks: 0, baseInterceptions: 0, pickups: 0 };
    const count = mode === 'duo' ? 2 : mode === 'demo' ? aiCount : 1;
    this.players = Array.from({ length: count }, (_, i) => this.createPlayer(i, carry?.[i]));
    this.startingState = { score: this.score, players: this.progression() };
  }
  createPlayer(index, carry) {
    const s = PLAYER_SPAWNS[index];
    return { id: this.id++, player: true, index, x: s.x, y: s.y, dir: 0, hp: 1, alive: true, lives: carry ? Math.max(1, carry.lives) : 3, level: carry?.level ?? 1, speed: 102, cooldown: 0, shield: 4, boost: 0, respawn: 0, path: [], brainTimer: 0, ai: this.mode === 'demo', track: 0 };
  }
  get remaining() { return this.total - this.kills; }
  emit(type, data = {}) { this.onEvent({ type, ...data }); }
  canMove(tank, x, y) {
    const half = 8;
    if (x < half || x > SIZE - half || y < half || y > SIZE - half) return false;
    for (let cy = Math.floor((y - half) / TILE); cy <= Math.floor((y + half) / TILE); cy++) for (let cx = Math.floor((x - half) / TILE); cx <= Math.floor((x + half) / TILE); cx++) if (wall(this.map[cy]?.[cx])) return false;
    if (Math.abs(x - BASE.x) < BASE.half + half && Math.abs(y - BASE.y) < BASE.half + half) return false;
    return ![...this.players, ...this.enemies].some(other => other !== tank && other.alive && Math.abs(other.x - x) < 17 && Math.abs(other.y - y) < 17);
  }
  movementPosition(tank, dir, dt, position = tank) {
    if (dir < 0) return { x: position.x, y: position.y };
    const d = DIRECTIONS[dir], ice = this.map[Math.floor(position.y / TILE)]?.[Math.floor(position.x / TILE)] === 5;
    const step = tank.speed * (tank.boost > 0 ? 1.35 : 1) * (ice ? 1.28 : 1) * dt;
    let x = position.x, y = position.y;
    // Soft alignment lets keyboard turns and bots enter one-tile-wide corridors.
    if (d.x) { const center = Math.floor(y / TILE) * TILE + 12; if (Math.abs(y - center) <= 7 && this.canMove(tank, x, center)) y = center; }
    else { const center = Math.floor(x / TILE) * TILE + 12; if (Math.abs(x - center) <= 7 && this.canMove(tank, center, y)) x = center; }
    const nx = x + d.x * step, ny = y + d.y * step;
    return this.canMove(tank, nx, ny) ? { x: nx, y: ny } : { x: position.x, y: position.y };
  }
  move(tank, dir, dt) {
    if (dir < 0) return;
    tank.dir = dir;
    const next = this.movementPosition(tank, dir, dt), step = distance(tank, next);
    if (step > 0) { tank.x = next.x; tank.y = next.y; tank.track += step; tank.stuck = 0; }
    else tank.stuck = (tank.stuck || 0) + dt;
  }
  shoot(tank, defensive = false) {
    if (!tank.alive || tank.cooldown > 0) return false;
    const max = tank.player ? tank.level >= 2 ? 3 : 2 : 2;
    if (this.bullets.filter(b => b.owner === tank.id && !b.dead).length >= max) return false;
    const d = DIRECTIONS[tank.dir];
    this.bullets.push({ x: tank.x + d.x * 13, y: tank.y + d.y * 13, dir: tank.dir, speed: tank.player ? 285 + tank.level * 38 : 205 + Math.min(this.level, 10) * 7, player: tank.player, ai: tank.ai === true, owner: tank.id, damage: tank.player && tank.level >= 2 ? 2 : 1, steel: tank.player && tank.level >= 3, dead: false });
    tank.cooldown = tank.player ? (0.39 - Math.min(tank.level, 3) * 0.055) * (tank.boost > 0 ? 0.6 : 1) : ENEMY_TYPES[tank.type].cooldown * (this.difficulty === 'easy' ? 1.4 : this.difficulty === 'hard' ? 0.8 : 1);
    this.effects.push({ kind: 'muzzle', x: tank.x + d.x * 16, y: tank.y + d.y * 16, life: 0.1, max: 0.1 }); this.emit('shoot', { player: tank.player });
    if (defensive) this.aiStats.counterShots++;
    return true;
  }
  spawnEnemy() {
    const spawns = [...ENEMY_SPAWNS].sort(() => this.random() - 0.5);
    const spawn = spawns.find(s => ![...this.players, ...this.enemies].some(t => t.alive && Math.abs(t.x - s.x) < 30 && Math.abs(t.y - s.y) < 30));
    if (!spawn) return false;
    // All four tiers appear from stage one, with heavy tanks becoming more common.
    const order = [0, 1, 0, 2, 1, 3, 0, 2, 1, 3, 2, 0];
    let type = order[this.spawned % order.length];
    if (this.level > 3 && this.random() < 0.3) type = 3;
    const spec = ENEMY_TYPES[type], hard = this.difficulty === 'hard' ? 1.13 : this.difficulty === 'easy' ? 0.85 : 1;
    this.enemies.push({ ...spawn, id: this.id++, type, player: false, alive: true, hp: spec.hp, dir: 2, speed: spec.speed * hard * (1 + Math.min(this.level - 1, 12) * 0.018), cooldown: 1, shield: 0.7, carrier: this.spawned % 4 === 2, path: [], brainTimer: 0, track: 0, boost: 0 });
    this.effects.push({ kind: 'spawn', ...spawn, life: 0.7, max: 0.7 });
    this.spawned++; return true;
  }
  lineClear(a, b) {
    const dist = distance(a, b), steps = Math.ceil(dist / 10);
    for (let i = 1; i < steps; i++) { const x = a.x + (b.x - a.x) * i / steps, y = a.y + (b.y - a.y) * i / steps, t = this.map[Math.floor(y / TILE)]?.[Math.floor(x / TILE)]; if (t === 1 || t === 2) return false; }
    return true;
  }
  aim(tank, target) {
    const dx = target.x - tank.x, dy = target.y - tank.y;
    if (Math.abs(dx) < (target === BASE ? 22 : 11) && Math.abs(dy) > 12) return dy > 0 ? 2 : 0;
    if (Math.abs(dy) < 11 && Math.abs(dx) > 12) return dx > 0 ? 1 : 3;
    return -1;
  }
  counterPathClear(from, point) {
    if (!this.lineClear(from, point)) return false;
    const t = this.map[Math.floor(from.y / TILE)]?.[Math.floor(from.x / TILE)];
    if (t === 1 || t === 2) return false;
    return !this.enemies.some(e => e.alive && Number.isFinite(sweptHit(from.x - e.x, from.y - e.y, point.x - from.x, point.y - from.y, 11, 1)));
  }
  interceptionTime(bullet) {
    let earliest = Infinity;
    const d = DIRECTIONS[bullet.dir];
    for (const own of this.bullets) {
      if (own.dead || !own.player) continue;
      const od = DIRECTIONS[own.dir];
      const t = sweptHit(own.x - bullet.x, own.y - bullet.y, od.x * own.speed - d.x * bullet.speed, od.y * own.speed - d.y * bullet.speed, 5, 0.8);
      if (!Number.isFinite(t)) continue;
      const hit = { x: bullet.x + d.x * bullet.speed * t, y: bullet.y + d.y * bullet.speed * t };
      if (this.lineClear(bullet, hit) && this.counterPathClear(own, hit)) earliest = Math.min(earliest, t);
    }
    return earliest;
  }
  trajectoryRisk(tank, dir, threats, horizon = 0.75) {
    let position = { x: tank.x, y: tank.y }, score = 0;
    const hits = [], seen = new Set(), step = 1 / 30;
    for (let time = 0; time < horizon; time += step) {
      const next = this.movementPosition(tank, dir, step, position);
      for (const threat of threats) {
        const b = threat.bullet;
        if (seen.has(b)) continue;
        const d = DIRECTIONS[b.dir], vx = d.x * b.speed, vy = d.y * b.speed;
        const hit = sweptHit(b.x + vx * time - position.x, b.y + vy * time - position.y, vx - (next.x - position.x) / step, vy - (next.y - position.y) / step, 13, step);
        const impact = time + hit;
        if (!Number.isFinite(hit) || impact < tank.shield || threat.blockTime + 0.025 < impact) continue;
        if (!this.lineClear(b, { x: b.x + vx * impact, y: b.y + vy * impact })) continue;
        seen.add(b); hits.push({ bullet: b, time: impact }); score += 2 - impact / horizon;
      }
      position = next;
    }
    return { score, hits, position };
  }
  defend(tank, plannedDir, dt) {
    const threats = this.bullets.filter(b => !b.dead && !b.player && distance(b, tank) < b.speed * 0.8 + 100).map(bullet => ({ bullet, blockTime: this.interceptionTime(bullet) }));
    if (!threats.length) return false;
    const standing = this.trajectoryRisk(tank, -1, threats), planned = plannedDir < 0 ? standing : this.trajectoryRisk(tank, plannedDir, threats);
    const impending = [...standing.hits, ...planned.hits].sort((a, b) => a.time - b.time);
    if (!impending.length) { tank.evasionDir = undefined; return false; }
    let counterDir;
    // Defense runs before offensive aiming, so an unrelated enemy cannot consume this shot.
    for (const { bullet: b } of impending) {
      const d = DIRECTIONS[b.dir], along = (tank.x - b.x) * d.x + (tank.y - b.y) * d.y;
      const lateral = Math.abs(d.x ? tank.y - b.y : tank.x - b.x);
      if (along < 20 || lateral > 4.5 || !this.lineClear(b, tank)) continue;
      tank.dir = (b.dir + 2) % 4;
      if (this.shoot(tank, true)) {
        counterDir = tank.dir;
        for (const threat of threats) threat.blockTime = this.interceptionTime(threat.bullet);
      }
      break;
    }
    const candidates = [...new Set([plannedDir, -1, 0, 1, 2, 3])].map(dir => {
      const risk = this.trajectoryRisk(tank, dir, threats);
      const travel = distance(tank, risk.position);
      const preference = dir === plannedDir ? 0 : dir === -1 ? 3 : 2;
      const commitment = dir === tank.evasionDir ? -1.2 : 0;
      return { dir, risk, cost: risk.score * 1000 + preference + commitment + (dir >= 0 && travel < 5 ? 5 : 0) };
    }).sort((a, b) => a.cost - b.cost);
    const best = candidates[0];
    if (best.dir !== plannedDir && best.dir >= 0 && tank.evasionDir !== best.dir) this.aiStats.evasions++;
    tank.evasionDir = best.dir;
    this.move(tank, best.dir, dt);
    if (counterDir !== undefined) tank.dir = counterDir;
    // Force a fresh route after the avoidance maneuver instead of following stale waypoints.
    tank.brainTimer = 0;
    return true;
  }
  baseThreats() {
    return this.bullets.filter(b => !b.dead && !b.player).map(bullet => {
      const d = DIRECTIONS[bullet.dir];
      const time = sweptHit(bullet.x - BASE.x, bullet.y - BASE.y, d.x * bullet.speed, d.y * bullet.speed, BASE.half, 2.6);
      return { bullet, time, point: { x: bullet.x + d.x * bullet.speed * time, y: bullet.y + d.y * bullet.speed * time } };
    }).filter(t => Number.isFinite(t.time) && this.lineClear(t.bullet, t.point)).sort((a, b) => a.time - b.time);
  }
  baseCounterDirection(tank, threat) {
    if (tank.cooldown > 0 || this.bullets.filter(b => !b.dead && b.owner === tank.id).length >= (tank.level >= 2 ? 3 : 2)) return -1;
    const b = threat.bullet, bd = DIRECTIONS[b.dir], speed = 285 + tank.level * 38;
    for (let dir = 0; dir < 4; dir++) {
      const d = DIRECTIONS[dir], muzzle = { x: tank.x + d.x * 13, y: tank.y + d.y * 13 };
      const time = sweptHit(muzzle.x - b.x, muzzle.y - b.y, d.x * speed - bd.x * b.speed, d.y * speed - bd.y * b.speed, 4, Math.max(0, threat.time - 0.04));
      if (!Number.isFinite(time)) continue;
      const point = { x: b.x + bd.x * b.speed * time, y: b.y + bd.y * b.speed * time };
      if (this.counterPathClear(muzzle, point) && this.lineClear(b, point)) return dir;
    }
    return -1;
  }
  baseBlockPlan(tank, threat) {
    const b = threat.bullet, d = DIRECTIONS[b.dir];
    const cache = tank.basePlanCache;
    if (cache?.bullet === b && this.time - cache.at < 0.12) return cache.plan;
    let best;
    const speed = tank.speed * (tank.boost > 0 ? 1.35 : 1);
    for (let cell = 1; cell < GRID; cell++) {
      const point = d.x ? { x: cell * TILE + 12, y: b.y } : { x: b.x, y: cell * TILE + 12 };
      const along = (point.x - b.x) * d.x + (point.y - b.y) * d.y;
      const arrival = (along - 11) / b.speed;
      if (arrival <= 0 || arrival >= threat.time || !this.canMove(tank, point.x, point.y)) continue;
      if (distance(tank, point) / speed > arrival) continue;
      const path = findPath(this.map, tank, point);
      const end = path.at(-1) ?? tank;
      if (Math.floor(end.x / TILE) !== Math.floor(point.x / TILE) || Math.floor(end.y / TILE) !== Math.floor(point.y / TILE)) continue;
      if (path.some(p => wall(this.map[Math.floor(p.y / TILE)][Math.floor(p.x / TILE)]))) continue;
      path.push(point);
      let length = 0, last = tank;
      for (const p of path) { length += distance(last, p); last = p; }
      const travel = length / speed;
      if (travel + 0.035 > arrival) continue;
      const cost = travel - (tank.shield > arrival ? 0.25 : 0) - tank.lives * 0.01;
      if (!best || cost < best.cost) best = { tank, point, path, cost };
    }
    tank.basePlanCache = { bullet: b, at: this.time, plan: best };
    return best;
  }
  protectBase(tank, dt) {
    for (const threat of this.baseThreats()) {
      const b = threat.bullet;
      b.baseThreat = true;
      // A shell already guaranteed to be canceled does not need a second defender.
      if (this.interceptionTime(b) + 0.04 < threat.time) continue;
      const counter = this.baseCounterDirection(tank, threat);
      if (counter >= 0) {
        tank.dir = counter; this.shoot(tank, true);
        tank.brainTimer = 0;
        return true;
      }
      const d = DIRECTIONS[b.dir];
      const blocker = this.players.find(p => {
        if (!p.alive || p.baseBullet !== b) return false;
        const ahead = (p.x - b.x) * d.x + (p.y - b.y) * d.y;
        const lateral = Math.abs(d.x ? p.y - b.y : p.x - b.x);
        return lateral < 10 && ahead > 0 && ahead / b.speed < threat.time;
      });
      if (blocker) {
        if (blocker !== tank) continue;
        // Once in the firing lane, hold through impact instead of abandoning the
        // block when the remaining reaction time falls below the planning margin.
        tank.dir = (b.dir + 2) % 4;
        return true;
      }
      const plans = this.players.filter(p => p.alive && p.ai).map(p => this.baseBlockPlan(p, threat)).filter(Boolean).sort((a, b) => a.cost - b.cost);
      const plan = plans[0];
      if (!plan || plan.tank !== tank) continue;
      tank.baseBullet = b;
      // Base survival overrides shell avoidance, including when this costs a life.
      while (plan.path.length && distance(tank, plan.path[0]) < 3) plan.path.shift();
      const waypoint = plan.path[0] ?? plan.point;
      const dx = waypoint.x - tank.x, dy = waypoint.y - tank.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) this.move(tank, Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 1 : 3 : dy > 0 ? 2 : 0, dt);
      tank.dir = (b.dir + 2) % 4;
      tank.brainTimer = 0;
      return true;
    }
    tank.baseBullet = null;
    return false;
  }
  attackLane(tank, target) {
    const dir = this.aim(tank, target);
    if (dir < 0) return null;
    const cells = new Set();
    const direction = DIRECTIONS[dir], length = direction.x ? Math.abs(target.x - tank.x) : Math.abs(target.y - tank.y);
    const steps = Math.ceil(length / 8);
    let obstacles = 0;
    for (let i = 1; i < steps; i++) {
      const x = Math.floor((tank.x + direction.x * length * i / steps) / TILE);
      const y = Math.floor((tank.y + direction.y * length * i / steps) / TILE);
      const key = y * GRID + x, tile = this.map[y]?.[x];
      if (tile === 2 && tank.level < 3) return null;
      if ((tile === 1 || tile === 2) && !cells.has(key)) { cells.add(key); obstacles += tile === 2 ? 2 : 1; }
    }
    return obstacles <= 3 ? { dir, obstacles } : null;
  }
  attackPosition(tank, enemy, minY, teammate, flankY = minY) {
    const range = distance(tank, enemy), current = this.attackLane(tank, enemy);
    // Sustain useful fire instead of ramming an enemy or repeatedly changing lanes.
    if (current && range >= 48 && range <= 192 && tank.y >= minY && current.obstacles <= 1) return { x: tank.x, y: tank.y };
    const ex = Math.floor(enemy.x / TILE) * TILE + 12, ey = Math.floor(enemy.y / TILE) * TILE + 12;
    const candidates = [];
    const add = (x, y, minimum = minY) => {
      if (x < 12 || x > SIZE - 12 || y < minimum || y > SIZE - 36 || !this.canMove(tank, x, y)) return;
      const lane = this.attackLane({ ...tank, x, y }, enemy);
      if (!lane) return;
      const separation = teammate && Math.abs(teammate.x - x) < 20 && Math.abs(teammate.y - y) < 144 ? 35 : 0;
      const stable = tank.attackPoint && distance(tank.attackPoint, { x, y }) < 4 ? -9 : 0;
      const penalty = lane.obstacles * 28 + Math.abs(distance({ x, y }, enemy) - 120) * 0.15 + separation + stable;
      candidates.push({ x, y, penalty, estimate: distance(tank, { x, y }) * 0.7 + penalty });
    };
    // Approach from the base side or flank into a firing lane, including outer lanes.
    for (let y = Math.max(ey + 48, Math.ceil((minY - 12) / TILE) * TILE + 12); y <= Math.min(ey + 240, SIZE - 36); y += TILE) add(ex, y);
    for (const offset of [48, 72, 96, 144, 192]) { add(ex - offset, ey, flankY); add(ex + offset, ey, flankY); }
    candidates.sort((a, b) => a.estimate - b.estimate);
    let best;
    for (const point of candidates) {
      if (best && point.estimate > best.cost) break;
      const path = findPath(this.map, tank, point, tank.level >= 3), end = path.at(-1) ?? tank;
      if (Math.floor(end.x / TILE) !== Math.floor(point.x / TILE) || Math.floor(end.y / TILE) !== Math.floor(point.y / TILE)) continue;
      let cost = point.penalty, previous = tank;
      for (const p of path) { cost += distance(previous, p) * 0.7 + (this.map[Math.floor(p.y / TILE)][Math.floor(p.x / TILE)] === 1 ? 28 : 0); previous = p; }
      if (!best || cost < best.cost) best = { point, cost };
    }
    return best?.point ?? { x: ex, y: Math.max(minY, Math.min(SIZE - 36, ey + 72)) };
  }
  powerValue(tank, power, opponents) {
    switch (power.key) {
      case 'star': return tank.level === 1 ? 115 : tank.level === 2 ? 95 : 8;
      case 'life': return [0, 155, 115, 80, 55, 35, 8][Math.min(tank.lives, 6)];
      case 'shield': return tank.shield > 8 ? 10 : tank.shield > 3 ? 35 : 85;
      case 'bomb': return opponents.length ? 75 + opponents.reduce((sum, e) => sum + 12 + (e.hp ?? 1) * 4, 0) : 20;
      case 'clock': return this.freeze > 4 ? 12 : opponents.length ? 85 : 35;
      case 'shovel': return this.baseShield > 10 ? 10 : BASE_WALLS.some(([x, y]) => this.map[y][x] === 0) ? 125 : 60;
      case 'speed': return tank.boost > 5 ? 12 : 70;
      default: return 0;
    }
  }
  powerPlan(tank, power, opponents) {
    if (power.life <= 0 || distance(tank, power) > 360) return null;
    const teammate = this.players.find(p => p !== tank && p.alive && p.ai);
    const support = teammate && tank.index === 1;
    const baseShells = this.baseThreats();
    const criticalEnemy = opponents.some(e => e.y > 432 && distance(e, BASE) < 200 || e.y > 360 && Math.abs(e.x - BASE.x) < 60 && this.lineClear(e, { x: e.x, y: 552 }));
    // An existing base-bound shell still requires interception. Bombs/freeze only
    // affect enemy tanks; they cannot be trusted to remove already-fired shells.
    if (baseShells.length && power.key !== 'shovel') return null;
    if (criticalEnemy && !['bomb', 'clock', 'shovel'].includes(power.key)) return null;
    const exposed = [12, 13].some(x => ![1, 2].includes(this.map[23][x]));
    if (support && power.y < (exposed ? 384 : 252) && distance(tank, power) > 48) return null;
    const path = findPath(this.map, tank, power, tank.level >= 3), end = path.at(-1) ?? tank;
    if (Math.floor(end.x / TILE) !== Math.floor(power.x / TILE) || Math.floor(end.y / TILE) !== Math.floor(power.y / TILE)) return null;
    const tile = this.map[Math.floor(power.y / TILE)]?.[Math.floor(power.x / TILE)];
    if (![0, 4, 5].includes(tile)) return null;
    let length = 0, obstacleDelay = 0, previous = tank;
    for (const point of [...path, power]) {
      length += distance(previous, point); previous = point;
      const tile = this.map[Math.floor(point.y / TILE)]?.[Math.floor(point.x / TILE)];
      if (tile === 1) obstacleDelay += tank.level >= 2 ? 0.25 : 0.5;
      else if (tile === 2) obstacleDelay += 0.8;
    }
    const eta = Math.max(0, length - 18) / (tank.speed * (tank.boost > 0 ? 1.35 : 1)) + obstacleDelay;
    const value = this.powerValue(tank, power, opponents);
    const budget = criticalEnemy || baseShells.length ? 0.65 : support ? 2.8 : value >= 100 ? 4 : 3.2;
    if (eta > budget || eta + 0.4 >= power.life || baseShells.some(t => eta + 0.15 >= t.time)) return null;
    const first = path.find(point => distance(tank, point) >= 4) ?? power;
    const dx = first.x - tank.x, dy = first.y - tank.y;
    const dir = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 1 : 3 : dy > 0 ? 2 : 0;
    const threats = this.bullets.filter(b => !b.dead && !b.player && distance(b, tank) < b.speed * 0.8 + 100).map(bullet => ({ bullet, blockTime: this.interceptionTime(bullet) }));
    if (threats.length && this.trajectoryRisk(tank, dir, threats).score > 0) return null;
    const score = value - eta * 20 + (tank.powerTarget === power ? 12 : 0);
    return score > 0 ? { power, eta, score } : null;
  }
  selectPower(tank, opponents) {
    let best;
    const teammates = this.players.filter(p => p !== tank && p.alive && p.ai);
    for (const power of this.powers) {
      const plan = this.powerPlan(tank, power, opponents);
      if (!plan) continue;
      const assignedElsewhere = teammates.some(other => {
        if (other.powerTarget?.life > 0 && other.powerTarget !== power) return false;
        const theirs = this.powerPlan(other, power, opponents);
        return theirs && (theirs.score > plan.score + 1 || Math.abs(theirs.score - plan.score) <= 1 && other.index < tank.index);
      });
      if (!assignedElsewhere && (!best || plan.score > best.score)) best = plan;
    }
    tank.powerTarget = best?.power ?? null;
    return tank.powerTarget;
  }
  planAttack(tank, opponents) {
    const teammate = this.players.find(p => p !== tank && p.alive && p.ai);
    const support = teammate && tank.index === 1;
    const exposed = [12, 13].some(x => ![1, 2].includes(this.map[23][x]));
    const urgent = opponents.filter(e => e.y > 384 || Math.abs(e.x - BASE.x) < 36 && this.lineClear(e, { x: e.x, y: 552 })).sort((a, b) => distance(a, BASE) - distance(b, BASE))[0];
    const threatened = exposed || Boolean(urgent);
    const minY = support ? (threatened ? 444 : 324) : !teammate ? (threatened ? 324 : 204) : 108;
    const rank = e => distance(e, BASE) * 0.55 + distance(tank, e) * 0.7 + (teammate?.attackTargetId === e.id && opponents.length > 1 ? 150 : 0) - (tank.attackTargetId === e.id ? 25 : 0);
    const enemy = urgent || [...opponents].sort((a, b) => rank(a) - rank(b))[0];
    const power = this.selectPower(tank, opponents);
    tank.attackTargetId = power ? undefined : enemy?.id;
    const target = power || (enemy ? this.attackPosition(tank, enemy, minY, teammate, support ? minY : minY - 72) : { x: support ? 324 : 300, y: 468 });
    tank.attackPoint = { x: target.x, y: target.y };
    return target;
  }
  brain(tank, dt) {
    if (tank.player && this.protectBase(tank, dt)) { tank.powerTarget = null; return; }
    const opponents = tank.player ? this.enemies : this.players.filter(p => p.alive);
    const aligned = opponents.filter(t => t.alive && (tank.player ? this.attackLane(tank, t) : this.aim(tank, t) >= 0 && this.lineClear(tank, t))).sort((a, b) => distance(tank, a) - distance(tank, b))[0];
    tank.brainTimer -= dt;
    if (tank.brainTimer <= 0 || tank.stuck > 0.45) {
      tank.brainTimer = tank.player ? 0.22 + this.random() * 0.08 : 0.35 + this.random() * 0.15;
      let target;
      if (tank.player) {
        target = this.planAttack(tank, opponents);
      } else {
        const nearest = [...opponents].sort((a, b) => distance(tank, a) - distance(tank, b))[0];
        target = nearest && distance(tank, nearest) < 200 ? nearest : { x: 300, y: 564 };
      }
      tank.path = findPath(this.map, tank, target, tank.player && tank.level >= 3);
      if (tank.player) {
        const end = tank.path.at(-1) ?? tank;
        if (Math.floor(end.x / TILE) === Math.floor(target.x / TILE) && Math.floor(end.y / TILE) === Math.floor(target.y / TILE) && distance(end, target) > 3) tank.path.push({ x: target.x, y: target.y });
      }
      if (tank.stuck > 0.45) {
        const choices = [0, 1, 2, 3].filter(d => this.canMove(tank, tank.x + DIRECTIONS[d].x * 15, tank.y + DIRECTIONS[d].y * 15));
        tank.escapeDir = choices.length ? choices[Math.floor(this.random() * choices.length)] : -1;
        tank.escapeTime = 0.25; tank.stuck = 0;
      }
    }
    while (tank.path.length && distance(tank, tank.path[0]) < 4) tank.path.shift();
    const point = tank.path[0];
    let dir = -1;
    if (point) {
      const dx = point.x - tank.x, dy = point.y - tank.y;
      // Center the perpendicular coordinate first when approaching a new cell.
      dir = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 1 : 3 : dy > 0 ? 2 : 0;
    }
    if (tank.escapeTime > 0) { tank.escapeTime -= dt; dir = tank.escapeDir; }
    if (tank.player && this.defend(tank, dir, dt)) return;
    if (aligned) { tank.dir = this.aim(tank, aligned); this.shoot(tank); }
    if (dir >= 0) {
      this.move(tank, dir, dt);
      const d = DIRECTIONS[dir], t = this.map[Math.floor((tank.y + d.y * 18) / TILE)]?.[Math.floor((tank.x + d.x * 18) / TILE)];
      if (t === 1 || t === 2 && tank.level >= 3) this.shoot(tank);
    }
    if (aligned) { const aim = this.aim(tank, aligned); if (aim >= 0) { tank.dir = aim; this.shoot(tank); } }
    if (!tank.player && this.aim(tank, BASE) >= 0) { tank.dir = this.aim(tank, BASE); this.shoot(tank); }
    else if (!tank.player && this.random() < dt * 0.4) this.shoot(tank);
  }
  killEnemy(enemy, credit = true, drop = true) {
    if (!enemy.alive) return;
    enemy.alive = false; this.kills++;
    if (credit) this.score += ENEMY_TYPES[enemy.type].score;
    this.explode(enemy.x, enemy.y); this.emit('kill', { score: ENEMY_TYPES[enemy.type].score });
    if (enemy.carrier && drop) this.dropPower(enemy);
  }
  explode(x, y, big = false) { this.effects.push({ kind: 'explosion', x, y, life: big ? 0.8 : 0.45, max: big ? 0.8 : 0.45, big }); this.emit('explosion'); }
  hitPlayer(player) {
    if (!player.alive || player.shield > 0) return;
    player.lives--; player.alive = false; player.level = 1; player.respawn = 1.5; player.powerTarget = null;
    this.explode(player.x, player.y); this.emit('playerHit', { index: player.index });
  }
  dropPower(near) {
    const reachable = new Set();
    const q = this.players.filter(p => p.alive).map(p => [Math.floor(p.x / TILE), Math.floor(p.y / TILE)]);
    for (const p of q) reachable.add(p.join(','));
    for (let h = 0; h < q.length; h++) for (const d of DIRECTIONS) {
      const nx = q[h][0] + d.x, ny = q[h][1] + d.y, key = `${nx},${ny}`;
      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID || ny >= 24 && nx >= 12 && nx <= 13 || reachable.has(key) || wall(this.map[ny][nx])) continue;
      reachable.add(key); q.push([nx, ny]);
    }
    const cells = q.filter(([x, y]) => y > 3 && y < 23 && !wall(this.map[y][x]));
    if (!cells.length) return;
    let cell;
    if (near) cell = cells.sort((a, b) => Math.abs(a[0] * TILE + 12 - near.x) + Math.abs(a[1] * TILE + 12 - near.y) - Math.abs(b[0] * TILE + 12 - near.x) - Math.abs(b[1] * TILE + 12 - near.y))[0];
    else cell = cells[Math.floor(this.random() * cells.length)];
    const power = POWERS[Math.floor(this.random() * POWERS.length)];
    if (this.powers.length >= 4) this.powers.shift();
    this.powers.push({ ...power, x: cell[0] * TILE + 12, y: cell[1] * TILE + 12, life: 20 });
    this.emit('supply', { name: power.name });
  }
  applyPower(player, power) {
    switch (power.key) {
      case 'star': player.level = Math.min(player.level + 1, 3); break;
      case 'shield': player.shield = 12; break;
      case 'bomb': for (const e of this.enemies) this.killEnemy(e, true, false); break;
      case 'life': player.lives = Math.min(player.lives + 1, 6); break;
      case 'clock': this.freeze = 8; break;
      case 'shovel': this.baseShield = 20; for (const [x, y] of BASE_WALLS) this.map[y][x] = 2; break;
      case 'speed': player.boost = 12; break;
    }
    this.score += 50; power.life = 0;
    if (player.ai) this.aiStats.pickups++;
    if (player.powerTarget === power) player.powerTarget = null;
    this.emit('power', { name: power.name, index: player.index });
  }
  stepBullets(dt) {
    for (const bullet of this.bullets) {
      if (bullet.dead) continue;
      const d = DIRECTIONS[bullet.dir], steps = Math.ceil(bullet.speed * dt / 3);
      for (let i = 0; i < steps && !bullet.dead; i++) {
        bullet.x += d.x * bullet.speed * dt / steps; bullet.y += d.y * bullet.speed * dt / steps;
        if (bullet.x < 0 || bullet.y < 0 || bullet.x >= SIZE || bullet.y >= SIZE) { bullet.dead = true; break; }
        const cx = Math.floor(bullet.x / TILE), cy = Math.floor(bullet.y / TILE), t = this.map[cy][cx];
        if (t === 1 || t === 2) {
          if (t === 1 || bullet.steel) this.map[cy][cx] = 0;
          this.effects.push({ kind: 'spark', x: bullet.x, y: bullet.y, life: 0.16, max: 0.16 }); bullet.dead = true; break;
        }
        if (this.baseAlive && !bullet.player && Math.abs(bullet.x - BASE.x) < BASE.half && Math.abs(bullet.y - BASE.y) < BASE.half) {
          this.baseAlive = false; bullet.dead = true; this.explode(BASE.x, BASE.y, true); this.finish(false, '指挥基地被摧毁'); break;
        }
        const targets = bullet.player ? this.enemies : this.players;
        const target = targets.find(tank => tank.alive && Math.abs(tank.x - bullet.x) < 11 && Math.abs(tank.y - bullet.y) < 11);
        if (target) {
          bullet.dead = true;
          const blockedBase = target.player && target.ai && target.baseBullet === bullet;
          if (blockedBase) this.aiStats.baseBlocks++;
          if (target.shield <= 0) { if (target.player) this.hitPlayer(target); else { target.hp -= bullet.damage; if (target.hp <= 0) this.killEnemy(target); else this.emit('armor'); } }
          if (blockedBase) this.emit('baseBlock', { index: target.index });
        }
        const other = this.bullets.find(b => b !== bullet && !b.dead && b.player !== bullet.player && Math.abs(b.x - bullet.x) < 6 && Math.abs(b.y - bullet.y) < 6);
        if (other) {
          other.dead = true; bullet.dead = true;
          if (bullet.ai || other.ai) this.aiStats.interceptions++;
          if ((bullet.ai || other.ai) && (bullet.baseThreat || other.baseThreat)) this.aiStats.baseInterceptions++;
          this.effects.push({ kind: 'spark', x: bullet.x, y: bullet.y, life: 0.16, max: 0.16 });
        }
      }
    }
    this.bullets = this.bullets.filter(b => !b.dead);
  }
  finish(won, reason) {
    if (this.status !== 'playing') return;
    this.status = won ? 'won' : 'lost'; this.reason = reason; this.resultTime = this.time; this.emit('result', { won, reason });
  }
  update(dt, inputs = []) {
    if (this.status !== 'playing') return;
    dt = clamp(dt, 0, 1 / 30); this.time += dt;
    this.freeze = Math.max(0, this.freeze - dt);
    if (this.baseShield > 0) { this.baseShield -= dt; if (this.baseShield <= 0) for (const [x, y] of BASE_WALLS) if (this.map[y][x] === 2) this.map[y][x] = 1; }
    this.spawnTimer -= dt;
    const maxEnemies = this.difficulty === 'easy' ? 3 : this.difficulty === 'hard' ? 5 : 4;
    if (this.spawned < this.total && this.spawnTimer <= 0 && this.enemies.filter(e => e.alive).length < maxEnemies) { if (this.spawnEnemy()) this.spawnTimer = Math.max(1.3, 3.4 - this.level * 0.14); }
    for (const player of this.players) {
      if (!player.alive) {
        if (player.lives > 0) {
          player.respawn -= dt;
          if (player.respawn <= 0) { const s = PLAYER_SPAWNS[player.index]; if (this.canMove(player, s.x, s.y)) { Object.assign(player, s, { alive: true, shield: 4, dir: 0, cooldown: 0, path: [], brainTimer: 0 }); } }
        }
        continue;
      }
      player.cooldown = Math.max(0, player.cooldown - dt); player.shield = Math.max(0, player.shield - dt); player.boost = Math.max(0, player.boost - dt);
      if (player.ai) this.brain(player, dt);
      else { const input = inputs[player.index]; if (input) { this.move(player, input.dir ?? -1, dt); if (input.fire) this.shoot(player); } }
      for (const p of this.powers) if (p.life > 0 && Math.abs(p.x - player.x) < 21 && Math.abs(p.y - player.y) < 21) this.applyPower(player, p);
    }
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.shield = Math.max(0, enemy.shield - dt);
      if (this.freeze <= 0) { enemy.cooldown = Math.max(0, enemy.cooldown - dt); this.brain(enemy, dt); }
    }
    this.stepBullets(dt);
    this.enemies = this.enemies.filter(e => e.alive);
    for (const p of this.powers) p.life -= dt;
    this.powers = this.powers.filter(p => p.life > 0);
    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter(e => e.life > 0);
    this.supplyTimer -= dt;
    if (this.supplyTimer <= 0) { this.dropPower(); this.supplyTimer = 16 + this.random() * 10; }
    if (this.status === 'playing') {
      if (this.players.every(p => p.lives <= 0)) this.finish(false, '我方小队已全部失去战斗能力');
      else if (this.kills >= this.total) this.finish(true, '本区域敌军已全部肃清');
    }
  }
  progression() { return this.players.map(p => ({ lives: p.lives, level: p.level })); }
}
