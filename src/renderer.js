import { GRID, TILE, SIZE, ENEMY_TYPES, BASE, ENEMY_SPAWNS, PLAYER_SPAWNS, protectedCell } from './engine.js';

const playerColors = ['#efb969', '#8dbfc9'];
export function drawTank(ctx, tank, time = 0, scale = 1) {
  if (tank.alive === false) return;
  ctx.save(); ctx.translate(tank.x, tank.y); ctx.scale(scale, scale); ctx.rotate(tank.dir * Math.PI / 2);
  const color = tank.player ? playerColors[tank.index] : tank.carrier && Math.sin(time * 9) > 0 ? '#ec8d77' : ENEMY_TYPES[tank.type ?? 0].color;
  ctx.fillStyle = '#080d0c'; ctx.fillRect(-11, -10, 22, 23);
  ctx.fillStyle = '#586058'; ctx.fillRect(-11, -10, 5, 21); ctx.fillRect(6, -10, 5, 21);
  ctx.fillStyle = '#a0a38a';
  for (let i = -8; i < 11; i += 5) { const shift = Math.floor((tank.track ?? 0) / 4) % 2; ctx.fillRect(-11, i + shift, 4, 2); ctx.fillRect(7, i + shift, 4, 2); }
  ctx.fillStyle = color; ctx.fillRect(-6, -9, 12, 19); ctx.fillRect(-8, -6, 16, 12);
  ctx.fillStyle = '#ffffff32'; ctx.fillRect(-6, -9, 12, 2); ctx.fillRect(-8, -6, 2, 10);
  ctx.fillStyle = '#00000042'; ctx.fillRect(-6, 7, 12, 3); ctx.fillRect(6, -6, 2, 12);
  ctx.fillStyle = '#1d2824'; ctx.fillRect(-5, -4, 10, 10);
  ctx.fillStyle = color; ctx.fillRect(-4, -5, 8, 8);
  ctx.fillStyle = '#ffffff40'; ctx.fillRect(-3, -5, 6, 2);
  ctx.fillStyle = '#17221e'; ctx.fillRect(-3, -17, 6, 13);
  ctx.fillStyle = color; ctx.fillRect(-2, -17, 4, 14);
  ctx.fillStyle = '#ffffff44'; ctx.fillRect(-2, -17, 1, 11);
  ctx.fillStyle = '#223029'; ctx.fillRect(-2, -1, 4, 3);
  if (!tank.player && tank.hp > 1) { ctx.fillStyle = '#f4eee0'; for (let i = 0; i < tank.hp; i++) ctx.fillRect(-5 + i * 3, 6, 2, 2); }
  ctx.restore();
  if (tank.shield > 0 && Math.floor(time * 12) % 3 !== 0) {
    ctx.save(); ctx.strokeStyle = tank.player ? '#a7d6c4aa' : '#dcd9a277'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.strokeRect(tank.x - 16 * scale, tank.y - 16 * scale, 32 * scale, 32 * scale); ctx.restore();
  }
}

export function drawTerrain(ctx, t, x, y, time = 0) {
  const px = x * TILE, py = y * TILE;
  if (t === 1) {
    ctx.fillStyle = '#2d2520'; ctx.fillRect(px, py, TILE, TILE);
    for (let row = 0; row < 4; row++) {
      const offset = row % 2 ? -6 : 0;
      for (let col = 0; col < 3; col++) {
        const bx = Math.max(px, px + offset + col * 12), end = Math.min(px + 24, px + offset + col * 12 + 11), by = py + row * 6;
        if (end <= bx) continue;
        ctx.fillStyle = (x + y + row + col) % 3 ? '#795740' : '#886148'; ctx.fillRect(bx, by, end - bx, 5);
        ctx.fillStyle = '#c28c572d'; ctx.fillRect(bx, by, end - bx, 1);
        ctx.fillStyle = '#352b2266'; ctx.fillRect(bx, by + 4, end - bx, 1);
      }
    }
  } else if (t === 2) {
    ctx.fillStyle = '#404c48'; ctx.fillRect(px, py, 24, 24);
    for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
      ctx.fillStyle = '#79827a'; ctx.fillRect(px + sx * 12 + 1, py + sy * 12 + 1, 10, 10);
      ctx.fillStyle = '#a5ab974d'; ctx.fillRect(px + sx * 12 + 1, py + sy * 12 + 1, 10, 2);
      ctx.fillStyle = '#4b5950'; ctx.fillRect(px + sx * 12 + 9, py + sy * 12 + 3, 2, 8);
      ctx.fillStyle = '#d1d4b4'; ctx.fillRect(px + sx * 12 + 3, py + sy * 12 + 3, 1, 1);
    }
  } else if (t === 3) {
    ctx.fillStyle = '#1f454c'; ctx.fillRect(px, py, 24, 24);
    ctx.fillStyle = '#376972';
    const shift = Math.floor(time * 2) % 4;
    for (let i = 0; i < 3; i++) { ctx.fillRect(px + (i * 7 + shift + x * 2) % 13, py + 4 + i * 7, 9, 2); ctx.fillRect(px + (i * 7 + shift + x * 2) % 13 + 3, py + 6 + i * 7, 8, 1); }
  } else if (t === 4) {
    ctx.fillStyle = '#253e2be8'; ctx.fillRect(px, py, 24, 24);
    for (let i = 0; i < 9; i++) { const lx = px + (i * 13 + x * 3) % 21, ly = py + (i * 7 + y * 2) % 21; ctx.fillStyle = ['#486047', '#344d32', '#6a795055'][i % 3]; ctx.fillRect(lx, ly, 4, 5); ctx.fillRect(lx + 2, ly - 2, 4, 4); }
  } else if (t === 5) {
    ctx.fillStyle = '#8eafa76b'; ctx.fillRect(px, py, 24, 24); ctx.strokeStyle = '#c4ddd03d'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, py + 17); ctx.lineTo(px + 17, py); ctx.moveTo(px + 10, py + 24); ctx.lineTo(px + 24, py + 10); ctx.stroke();
  }
}

function drawBase(ctx, alive, shield, time) {
  ctx.save(); ctx.translate(BASE.x, BASE.y);
  ctx.fillStyle = '#151b17'; ctx.fillRect(-22, -22, 44, 44);
  ctx.strokeStyle = alive ? '#9d8e5c' : '#654b3c'; ctx.strokeRect(-20.5, -20.5, 41, 41);
  ctx.fillStyle = alive ? '#c1b27a' : '#59483b';
  const eagle = ['100000001', '110010011', '111111111', '011111110', '001111100', '000111000', '001111100', '011010110'];
  eagle.forEach((row, y) => [...row].forEach((v, x) => { if (v === '1') ctx.fillRect(x * 3 - 13, y * 3 - 12, 3, 3); }));
  if (!alive) { ctx.strokeStyle = '#e7805c'; ctx.beginPath(); ctx.moveTo(-13, -13); ctx.lineTo(13, 13); ctx.moveTo(-13, 13); ctx.lineTo(13, -13); ctx.stroke(); }
  if (shield > 0) { ctx.strokeStyle = '#a7d6c4'; ctx.globalAlpha = 0.5 + Math.sin(time * 5) * 0.3; ctx.strokeRect(-25, -25, 50, 50); }
  ctx.restore();
}

export function render(ctx, game, { preview = false, time = game.time } = {}) {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#131b17'; ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = '#28352b44'; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i <= GRID; i++) { ctx.moveTo(i * TILE + 0.5, 0); ctx.lineTo(i * TILE + 0.5, SIZE); ctx.moveTo(0, i * TILE + 0.5); ctx.lineTo(SIZE, i * TILE + 0.5); } ctx.stroke();
  ctx.fillStyle = '#9b9f6e13'; for (let i = 0; i < 350; i++) ctx.fillRect((i * 137 + 11) % SIZE, (i * 281 + 7) % SIZE, 1, 1);
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (game.map[y][x] !== 4) drawTerrain(ctx, game.map[y][x], x, y, time);
  // Small stencils mark entry points without obstructing the battlefield.
  ctx.fillStyle = '#a09b6d55';
  for (const s of ENEMY_SPAWNS) { ctx.fillRect(s.x - 5, 8, 10, 2); ctx.fillRect(s.x - 3, 11, 6, 2); }
  drawBase(ctx, game.baseAlive, game.baseShield, time);
  for (const p of game.players) drawTank(ctx, p, time);
  for (const e of game.enemies) drawTank(ctx, e, time);
  if (preview) for (const [i, s] of ENEMY_SPAWNS.entries()) drawTank(ctx, { ...s, type: i, dir: 2, hp: i === 2 ? 2 : 1, track: 0 }, time);
  for (const b of game.bullets) {
    ctx.fillStyle = b.player ? '#f6df9c' : '#e69775'; ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
    ctx.fillStyle = b.player ? '#e6b86a55' : '#e6977544'; const d = [{ x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }][b.dir]; ctx.fillRect(b.x - 1 + d.x * 5, b.y - 1 + d.y * 5, 3, 3);
  }
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (game.map[y][x] === 4) drawTerrain(ctx, 4, x, y, time);
  for (const p of game.powers) {
    if (p.life < 4 && Math.floor(time * 8) % 2) continue;
    ctx.fillStyle = '#101a16'; ctx.fillRect(p.x - 13, p.y - 13, 26, 26); ctx.strokeStyle = p.color; ctx.strokeRect(p.x - 12.5, p.y - 12.5, 25, 25);
    ctx.fillStyle = p.color; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.symbol, p.x, p.y + 1);
  }
  for (const e of game.effects) {
    const progress = 1 - e.life / e.max;
    ctx.save(); ctx.globalAlpha = Math.min(1, e.life / e.max * 2);
    if (e.kind === 'explosion') {
      const radius = (e.big ? 42 : 24) * progress + 3;
      for (let i = 0; i < 9; i++) { const angle = i * Math.PI * 2 / 9, x = e.x + Math.cos(angle) * radius, y = e.y + Math.sin(angle) * radius; ctx.fillStyle = i % 2 ? '#f2a057' : '#c76e44'; const size = Math.max(2, 7 * (1 - progress)); ctx.fillRect(Math.floor(x), Math.floor(y), size, size); }
      ctx.fillStyle = progress < 0.3 ? '#f8e0a4' : '#b66d46'; ctx.fillRect(e.x - 7 * (1 - progress), e.y - 7 * (1 - progress), 14 * (1 - progress), 14 * (1 - progress));
    } else if (e.kind === 'spawn') { ctx.strokeStyle = '#e7d69a'; const size = 30 * (1 - progress); ctx.strokeRect(e.x - size / 2, e.y - size / 2, size, size); }
    else { ctx.fillStyle = '#f4d29b'; ctx.fillRect(e.x - 3, e.y - 3, 6, 6); }
    ctx.restore();
  }
  if (game.freeze > 0) { ctx.fillStyle = '#6eabdc0c'; ctx.fillRect(0, 0, SIZE, SIZE); }
}

export function renderEditor(ctx, map, hover, brush) {
  const fake = { map, players: [], enemies: [], bullets: [], powers: [], effects: [], baseAlive: true, baseShield: 0, time: 0 };
  render(ctx, fake);
  ctx.save(); ctx.strokeStyle = '#b9c6aa19'; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i <= GRID; i++) { ctx.moveTo(i * TILE + 0.5, 0); ctx.lineTo(i * TILE + 0.5, SIZE); ctx.moveTo(0, i * TILE + 0.5); ctx.lineTo(SIZE, i * TILE + 0.5); } ctx.stroke();
  ctx.fillStyle = '#a4ba8f14'; for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (protectedCell(x, y)) ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
  for (const [i, s] of PLAYER_SPAWNS.entries()) drawTank(ctx, { ...s, player: true, index: i, dir: 0 }, 0);
  for (const [i, s] of ENEMY_SPAWNS.entries()) { ctx.fillStyle = '#d5b779'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText(`E${i + 1}`, s.x, s.y + 4); }
  if (hover) { const { x, y } = hover; ctx.fillStyle = protectedCell(x, y) ? '#e98d6b44' : '#e5ca9233'; ctx.fillRect(x * TILE, y * TILE, TILE, TILE); ctx.strokeStyle = protectedCell(x, y) ? '#e98d6b' : '#e5ca92'; ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, 23, 23); if (!protectedCell(x, y) && brush > 0) { ctx.globalAlpha = 0.65; drawTerrain(ctx, brush, x, y); } }
  ctx.restore();
}
