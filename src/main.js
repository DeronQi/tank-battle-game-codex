import { Game, GRID, generateMap, blankMap, validateMap, protectedCell } from './engine.js';
import { render, drawTank, drawTerrain, renderEditor } from './renderer.js';
import { nextStageOptions, retryStageOptions } from './campaign.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const icons = {
  crosshair: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/><circle cx="12" cy="12" r="2"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  book: '<path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1v15"/>',
  volume: '<path d="M11 4 6 8H3v8h3l5 4V4Zm5 5c2 2 2 4 0 6m3-9c4 4 4 8 0 12"/>',
  mute: '<path d="M11 4 6 8H3v8h3l5 4V4Zm5 5 6 6m0-6-6 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v.5"/>',
  sliders: '<path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 3v6m8 0v6m-6 0v6"/>',
  user: '<circle cx="12" cy="7" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>',
  users: '<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3m0-17a3 3 0 0 1 0 6m3 4a6 6 0 0 1 3 5v2"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/>',
  play: '<path d="m8 4 12 8-12 8V4Z"/>',
  shuffle: '<path d="M3 6h3c4 0 8 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6m2-3c2-2 3-3 5-3h2m-4-4 4 4-4 4"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M5 9h1m3 0h1m3 0h1m3 0h2M5 12h1m3 0h1m3 0h1m3 0h2M6 15h12"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14l-1 7ZM14 21h7"/>',
  activity: '<path d="M2 12h4l3-8 6 16 3-8h4"/>',
  shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Z"/><path d="m8 11 3 3 5-6"/>',
  gift: '<path d="M3 8h18v5H3zm2 5v8h14v-8M12 8v13"/><path d="M12 8c-8 0-8-8-3-5 2 1 3 5 3 5s1-4 3-5c5-3 5 5-3 5Z"/>',
  bulb: '<path d="M8 17c0-3-4-4-4-8a8 8 0 0 1 16 0c0 4-4 5-4 8H8Zm1 4h6m-3-4v-5m-3-3 3 3 3-3"/>',
  x: '<path d="m6 6 12 12M6 18 18 6"/>',
  save: '<path d="M4 3h13l4 4v14H3V3Zm3 0v7h10V3M7 21v-7h10v7"/>',
};
function svg(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.crosshair}</svg>`; }
function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = svg(el.dataset.icon); }); }
hydrateIcons();

function readStorage(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
function writeStorage(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
let high = Number(readStorage('sf-high', 0)) || 0;
let saved = readStorage('sf-level', null);
if (saved && !validateMap(saved).valid) saved = null;
let mode = 'solo', aiCount = 1, activeConfig = {}, paused = false, resultElapsed = 0, lastPips = '', lastResult = '', keys = new Set();
const canvas = $('#game'), ctx = canvas.getContext('2d');
let game = new Game({ seed: seed() }); game.status = 'ready';
let setupState = null;
function inBattle() { return !$('#battle-screen').classList.contains('hidden'); }
function showSetup() {
  if (!inBattle()) return;
  if (document.fullscreenElement === $('#battle-screen')) document.exitFullscreen().catch(() => {});
  setupState = { game, resume: game.status === 'playing' && !paused };
  if (setupState.resume) togglePause(true);
  keys.clear();
  $('#battle-screen').classList.add('hidden');
  $('#setup-screen').classList.remove('hidden');
  $('#return-battle').classList.remove('hidden');
  $('#nav-battle').classList.add('active');
  window.scrollTo(0, 0);
  $('#start').focus({ preventScroll: true });
}
function showBattle(restore = false) {
  $('#setup-screen').classList.add('hidden');
  $('#battle-screen').classList.remove('hidden');
  $('#nav-battle').classList.remove('active');
  if (restore && setupState?.game === game && setupState.resume && paused) togglePause(false);
  setupState = null;
  window.scrollTo(0, 0);
  canvas.focus({ preventScroll: true });
}
let toastTimeout;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 3000); }

let audioOn = readStorage('sf-audio', false) === true, audioContext, lastShot = 0;
function syncAudio() { $('#sound').innerHTML = svg(audioOn ? 'volume' : 'mute'); $('#sound').title = audioOn ? '关闭音效 (M)' : '开启音效 (M)'; $('#sound').setAttribute('aria-label', $('#sound').title); }
function unlockAudio() { if (!audioOn) return; try { audioContext ??= new (window.AudioContext || window.webkitAudioContext)(); if (audioContext.state === 'suspended') audioContext.resume().catch(() => {}); } catch { audioOn = false; syncAudio(); } }
function sound(type) {
  if (!audioOn || !audioContext || audioContext.state !== 'running') return;
  const now = audioContext.currentTime;
  if (type === 'shoot' && now - lastShot < 0.09) return;
  if (type === 'shoot') lastShot = now;
  const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
  const config = type === 'shoot' ? [320, 100, 0.08, 0.025] : type === 'explosion' ? [110, 24, 0.25, 0.05] : type === 'power' ? [510, 1100, 0.24, 0.04] : [180, 90, 0.07, 0.02];
  oscillator.type = type === 'explosion' ? 'sawtooth' : 'square'; oscillator.frequency.setValueAtTime(config[0], now); oscillator.frequency.exponentialRampToValueAtTime(config[1], now + config[2]); gain.gain.setValueAtTime(config[3], now); gain.gain.exponentialRampToValueAtTime(0.001, now + config[2]); oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(now); oscillator.stop(now + config[2]);
}
$('#sound').addEventListener('click', () => { audioOn = !audioOn; writeStorage('sf-audio', audioOn); unlockAudio(); syncAudio(); }); syncAudio();

function onEvent(event) {
  if (event.type === 'shoot' && event.player) sound('shoot');
  if (event.type === 'explosion') sound('explosion');
  if (event.type === 'armor') sound('armor');
  if (event.type === 'power') { sound('power'); setMessage(`P${event.index + 1} 获得「${event.name}」！`); }
  if (event.type === 'supply') setMessage(`战场出现补给：${event.name}，移动到道具上拾取。`);
  if (event.type === 'playerHit') setMessage(`P${event.index + 1} 中弹，正在准备重新部署。`);
  if (event.type === 'baseBlock') setMessage(`P${event.index + 1} 以车体拦下了射向基地的炮弹！`);
  if (event.type === 'result') { resultElapsed = 0; keys.clear(); }
}
function setMessage(text) { $('#battle-message').textContent = text; }
function seed() { return crypto.getRandomValues(new Uint32Array(1))[0]; }
function setMode(next) {
  mode = next;
  $$('.mode-option').forEach(el => { el.classList.toggle('selected', el.dataset.mode === mode); el.setAttribute('aria-pressed', String(el.dataset.mode === mode)); });
  $('#ai-options').classList.toggle('hidden', mode !== 'demo');
  if (game.status === 'ready') { game = new Game({ seed: game.seed, map: game.initialMap, mode, aiCount }); game.status = 'ready'; syncUI(); }
}
$$('.mode-option').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
$$('[data-ai]').forEach(button => button.addEventListener('click', () => { aiCount = Number(button.dataset.ai); $$('[data-ai]').forEach(el => { el.classList.toggle('selected', el === button); el.setAttribute('aria-pressed', String(el === button)); }); if (game.status === 'ready') setMode('demo'); }));

function startBattle() {
  let map;
  if ($('#map-source').value === 'custom') {
    if (!saved) { toast('先在关卡工坊保存一张地图，再部署自定义关卡。'); openEditor(); return; }
    map = saved.tiles;
  }
  activeConfig = { mode, aiCount, difficulty: $('#difficulty').value };
  beginStage({ seed: map ? seed() : game.status === 'ready' ? game.seed : seed(), map, ...activeConfig });
}
function beginStage(options) {
  keys.clear(); paused = false; resultElapsed = 0; lastResult = ''; game = new Game({ ...options, onEvent });
  showBattle();
  $('#game-overlay').classList.add('hidden'); $('#pause').disabled = false; $('#pause').innerHTML = svg('pause');
  $('#start').innerHTML = `<span data-icon="play"></span><span>开始新战役</span><span class="button-arrow">↗</span>`; hydrateIcons($('#start'));
  $('#canvas-mode').textContent = game.mode === 'demo' ? `${game.players.length} AI / AUTOPILOT` : game.players.length === 2 ? '2 PLAYERS / CO-OP' : '1 PLAYER / SOLO';
  setMessage(game.mode === 'demo' ? 'AI 已接管。胜利自动进入下一关，失败自动重试当前关卡。' : `第 ${game.level} 关，保护基地，消灭 ${game.total} 辆敌军。`);
  unlockAudio(); canvas.focus({ preventScroll: true }); syncUI();
}
function nextStage() {
  if (game.status !== 'won') return;
  beginStage(nextStageOptions(game, activeConfig, seed()));
}
function retryStage() { if (game.status === 'lost') beginStage(retryStageOptions(game, activeConfig)); }
function continueAfterResult() { if (game.status === 'won') nextStage(); else if (game.status === 'lost') retryStage(); }
$('#start').addEventListener('click', startBattle);
$('#return-battle').addEventListener('click', () => showBattle(true));
$('#overlay-start').addEventListener('click', startBattle);
function togglePause(force) {
  if (game.status !== 'playing') return;
  paused = force ?? !paused; keys.clear();
  $('#pause').innerHTML = svg(paused ? 'play' : 'pause');
  if (paused) showOverlay({ title: '战斗已暂停', eyebrow: 'TAKE A BREATH, COMMANDER.', description: '你的阵地正在等待。<br>按 P 或点击下方按钮继续。', button: '继续作战', hint: '调整呼吸，再次出击', action: () => togglePause(false) });
  else $('#game-overlay').classList.add('hidden');
  syncUI();
}
$('#pause').addEventListener('click', () => togglePause());
$('#reroll').addEventListener('click', showSetup);
$('#fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('#battle-screen').requestFullscreen(); } catch { toast('当前浏览器无法进入全屏模式'); }
});
document.addEventListener('fullscreenchange', () => {
  const active = document.fullscreenElement === $('#battle-screen');
  $('#fullscreen').title = active ? '退出全屏' : '全屏作战界面';
  $('#fullscreen').setAttribute('aria-label', $('#fullscreen').title);
  $('#fullscreen').setAttribute('aria-pressed', String(active));
});
function showOverlay({ title, eyebrow, description, button, hint, action }) {
  const el = $('#game-overlay');
  el.innerHTML = `<div class="overlay-decoration">✦</div><span class="overlay-eyebrow"></span><h2></h2><p></p><button class="primary-button"><span data-icon="play"></span><span class="overlay-button-label"></span></button><span class="overlay-hint"></span>`;
  el.querySelector('h2').textContent = title; el.querySelector('.overlay-eyebrow').textContent = eyebrow;
  el.querySelector('p').innerHTML = description; el.querySelector('.overlay-button-label').textContent = button; el.querySelector('.overlay-hint').textContent = hint;
  el.querySelector('button').addEventListener('click', action); hydrateIcons(el); el.classList.remove('hidden');
}
function showResult() {
  const won = game.status === 'won', demo = game.mode === 'demo';
  if (lastResult !== game.status) {
    lastResult = game.status; $('#pause').disabled = true;
    showOverlay({ title: won ? '区域已肃清' : '防线已失守', eyebrow: won ? 'MISSION COMPLETE / WELL FOUGHT.' : 'MISSION FAILED / FIGHT AGAIN.', description: `${game.reason}<br>本关击破 ${game.kills} / ${game.total} 辆 · 总得分 ${game.score.toLocaleString()}`, button: won ? '进入下一关' : '重试当前关卡', hint: won ? '下一关为全新随机战场，生命与火力将保留' : '保留当前地图，恢复本关开始时的状态', action: continueAfterResult });
    setMessage(won ? '任务完成。下一片战场，等待你的到来。' : '每一次失守，都让下一道防线更坚固。');
  }
  if (demo) $('#game-overlay .overlay-hint').textContent = `${Math.max(1, Math.ceil(3.5 - resultElapsed))} 秒后自动${won ? `进入第 ${game.level + 1} 关 · 随机战场` : `重试第 ${game.level} 关 · 保留当前地图`}`;
}

const tankPip = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h3v13H3zm11 0h3v13h-3zM7 7h6v10H7zM9 1h2v9H9z"/></svg>';
function syncUI() {
  const state = game.status === 'ready' ? '战场待命' : paused ? '战斗暂停' : game.status === 'won' ? '任务完成' : game.status === 'lost' ? '防线失守' : game.mode === 'demo' ? 'AI 自动作战' : '战斗进行中';
  $('#battle-status').textContent = state; $('#status-dot').style.background = game.status === 'lost' ? '#de8b6c' : paused ? '#aa9e6d' : '#a5b78d';
  $('#seed-label').textContent = `SECTOR ${String(game.level).padStart(2, '0')}`; $('#seed-label').title = `地图种子：${game.seed}`;
  $('#level-stat').textContent = String(game.level).padStart(2, '0');
  $$('.level-bars>i').forEach((el, i) => { el.style.background = i < (game.level - 1) % 10 + 1 ? 'var(--orange)' : ''; });
  $('#score-stat').textContent = String(game.score).padStart(6, '0');
  if (game.score > high) { high = game.score; writeStorage('sf-high', high); }
  $('#high-stat').textContent = String(high).padStart(6, '0'); $('#remaining-stat').textContent = game.remaining;
  const pipKey = `${game.total}/${game.kills}`;
  if (pipKey !== lastPips) { lastPips = pipKey; $('#enemy-pips').innerHTML = Array.from({ length: game.total }, (_, i) => `<span class="enemy-pip ${i < game.kills ? 'dead' : ''}">${tankPip}</span>`).join(''); }
  $('#base-status').classList.toggle('danger', !game.baseAlive); $('#base-status b').textContent = game.baseAlive ? game.baseShield > 0 ? `加固 ${Math.ceil(game.baseShield)}s` : '安全' : '已摧毁';
  for (let i = 0; i < 2; i++) {
    const p = game.players[i], n = i + 1;
    $(`#p${n}-type`).textContent = !p ? 'OFFLINE' : p.ai ? 'AUTOPILOT' : 'PLAYER';
    $(`#p${n}-upgrade`).textContent = !p ? '等待加入战场' : !p.alive ? p.lives > 0 ? '准备重新部署…' : '已退出战斗' : `${p.level === 3 ? '穿甲火力' : p.level === 2 ? '强化火力' : '标准火力'} · Lv.${p.level}`;
    $(`#p${n}-lives`).textContent = p ? p.lives > 0 ? Array(p.lives).fill('♥').join(' ') : '—' : '—';
  }
  $('#p2-row').classList.toggle('inactive', !game.players[1]);
}
for (let i = 0; i < 2; i++) { const c = $(`#p${i + 1}-tank`), cctx = c.getContext('2d'); drawTank(cctx, { player: true, index: i, x: 20, y: 22, dir: 0 }, 0, 1.2); }

function inputs() {
  const input = (list, fire) => ({ dir: list.map((key, dir) => keys.has(key) ? dir : -1).filter(d => d >= 0).at(-1) ?? -1, fire: keys.has(fire) });
  return [input(['KeyW', 'KeyD', 'KeyS', 'KeyA'], 'Space'), input(['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'], 'Enter')];
}
const gameKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Enter']);
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]') || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (event.code === 'KeyP' && !event.repeat && inBattle()) { event.preventDefault(); togglePause(); return; }
  if (event.code === 'KeyM' && !event.repeat) { $('#sound').click(); return; }
  if (inBattle() && game.status === 'playing' && !paused && gameKeys.has(event.code)) { event.preventDefault(); keys.add(event.code); }
});
document.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { keys.clear(); if (game.mode !== 'demo' && game.status === 'playing' && !paused) togglePause(true); });
document.addEventListener('visibilitychange', () => { keys.clear(); if (document.hidden && game.status === 'playing' && !paused && game.mode !== 'demo') togglePause(true); });
$$('[data-key]').forEach(button => {
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); if (!paused && game.status === 'playing') keys.add(button.dataset.key); });
  const release = () => keys.delete(button.dataset.key);
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
});

// Dialogs pause the simulation and restore its exact prior pause state on close.
const dialogStates = new WeakMap();
function openDialog(dialog) { dialogStates.set(dialog, { resume: game.status === 'playing' && !paused, game }); if (game.status === 'playing' && !paused) togglePause(true); keys.clear(); dialog.showModal(); }
$$('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$$('dialog').forEach(dialog => {
  dialog.addEventListener('close', () => { const prior = dialogStates.get(dialog); if (prior?.resume && prior.game === game && paused) togglePause(false); });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
});
['#nav-guide', '#help'].forEach(selector => $(selector).addEventListener('click', () => openDialog($('#guide-dialog'))));
$('#nav-battle').addEventListener('click', showSetup);

let editMap, brush = 1, history = [], drawing = false, hover = null, lastPaint = null;
const editor = $('#editor-canvas'), editCtx = editor.getContext('2d'), editorDialog = $('#editor-dialog');
const brushNames = ['空地', '砖墙', '钢墙', '水域', '树林', '冰面'];
for (let i = 0; i <= 5; i++) {
  const button = document.createElement('button'); button.className = `brush ${i === brush ? 'selected' : ''}`; button.dataset.brush = i; button.setAttribute('aria-pressed', String(i === brush));
  const swatch = document.createElement('canvas'); swatch.width = 24; swatch.height = 24; swatch.className = 'brush-swatch'; const swctx = swatch.getContext('2d'); swctx.fillStyle = '#141c16'; swctx.fillRect(0, 0, 24, 24); drawTerrain(swctx, i, 0, 0);
  button.append(swatch, document.createTextNode(brushNames[i])); button.addEventListener('click', () => { brush = i; $$('.brush').forEach(el => { el.classList.toggle('selected', Number(el.dataset.brush) === brush); el.setAttribute('aria-pressed', String(Number(el.dataset.brush) === brush)); }); drawEditor(); }); $('#brushes').append(button);
}
function openEditor() {
  if (!editMap) { editMap = game.initialMap.map(row => [...row]); $('#level-name').value = '我的钢铁防线'; }
  openDialog(editorDialog); checkEditor(); drawEditor();
}
$('#nav-editor').addEventListener('click', openEditor);
$('#edit-current').addEventListener('click', () => { editMap = game.initialMap.map(row => [...row]); history = []; $('#level-name').value = '战场改造计划'; openEditor(); });
function drawEditor() { if (editMap) renderEditor(editCtx, editMap, hover, brush); }
function remember() { history.push(editMap.map(row => [...row])); if (history.length > 40) history.shift(); }
function checkEditor() { const result = validateMap(editMap); $('#editor-validation').textContent = result.valid ? '✓ 路线连通，关卡可以部署。' : result.error; $('#editor-validation').classList.toggle('error', !result.valid); $('#editor-save').disabled = !result.valid; $('#editor-play').disabled = !result.valid; $('#editor-undo').disabled = history.length === 0; return result.valid; }
function pointerCell(event) { const r = editor.getBoundingClientRect(); return { x: Math.min(25, Math.max(0, Math.floor((event.clientX - r.left) * GRID / r.width))), y: Math.min(25, Math.max(0, Math.floor((event.clientY - r.top) * GRID / r.height))) }; }
function paint(cell, erase) {
  const from = lastPaint ?? cell, count = Math.max(Math.abs(cell.x - from.x), Math.abs(cell.y - from.y), 1);
  for (let i = 0; i <= count; i++) { const x = Math.round(from.x + (cell.x - from.x) * i / count), y = Math.round(from.y + (cell.y - from.y) * i / count); if (!protectedCell(x, y)) editMap[y][x] = erase ? 0 : brush; }
  lastPaint = cell; drawEditor();
}
editor.addEventListener('contextmenu', event => event.preventDefault());
editor.addEventListener('pointerdown', event => { if (![0, 2].includes(event.button)) return; event.preventDefault(); editor.setPointerCapture(event.pointerId); remember(); drawing = true; lastPaint = null; hover = pointerCell(event); paint(hover, event.button === 2); });
editor.addEventListener('pointermove', event => { hover = pointerCell(event); if (drawing) paint(hover, (event.buttons & 2) !== 0); else drawEditor(); });
function stopDrawing() { if (!drawing) return; drawing = false; lastPaint = null; checkEditor(); }
editor.addEventListener('pointerup', stopDrawing); editor.addEventListener('pointercancel', stopDrawing); editor.addEventListener('lostpointercapture', stopDrawing); editor.addEventListener('pointerleave', () => { hover = null; drawEditor(); });
$('#editor-undo').addEventListener('click', () => { if (history.length) editMap = history.pop(); checkEditor(); drawEditor(); });
$('#editor-clear').addEventListener('click', () => { remember(); editMap = blankMap(); checkEditor(); drawEditor(); });
$('#editor-random').addEventListener('click', () => { remember(); editMap = generateMap(seed()); checkEditor(); drawEditor(); });
$('#editor-load').addEventListener('click', () => { if (!saved) { toast('还没有保存的关卡'); return; } remember(); editMap = saved.tiles.map(row => [...row]); $('#level-name').value = saved.name; checkEditor(); drawEditor(); toast('已载入保存的关卡'); });
function mapData() { return { format: 'steel-front', version: 1, name: $('#level-name').value.trim() || '未命名战场', tiles: editMap.map(row => [...row]) }; }
function saveLevel() {
  if (!checkEditor()) return false;
  const data = mapData();
  if (!writeStorage('sf-level', data)) { toast('浏览器存储不可用，请导出 JSON 备份关卡。'); return false; }
  saved = data; $('#map-source').value = 'custom'; toast(`已保存关卡「${saved.name}」`); return true;
}
$('#editor-save').addEventListener('click', saveLevel);
$('#editor-play').addEventListener('click', () => { if (saveLevel()) { editorDialog.close(); startBattle(); } });
$('#editor-export').addEventListener('click', () => {
  if (!checkEditor()) { toast('修复地图路线后再导出。'); return; }
  const data = mapData(), url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), link = document.createElement('a');
  link.href = url; link.download = `${data.name.replace(/[<>:"/\\|?*]/g, '_')}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('关卡已导出为 JSON 文件');
});
$('#editor-import').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 65536) throw new Error('关卡文件过大，请使用小于 64 KB 的 JSON。');
    const data = JSON.parse(await file.text());
    if (data.format !== 'steel-front' || data.version !== 1) throw new Error('不支持的关卡格式，请导入工坊导出的 v1 JSON。');
    const validation = validateMap(data); if (!validation.valid) throw new Error(validation.error);
    remember(); editMap = data.tiles.map(row => [...row]); $('#level-name').value = typeof data.name === 'string' ? data.name.slice(0, 32) : '导入的战场'; checkEditor(); drawEditor(); toast('导入成功，保存后即可部署');
  } catch (error) { toast(`导入失败：${error.message}`); }
  event.target.value = '';
});

let previous = performance.now(), accumulator = 0, uiTimer = 0;
function frame(now) {
  const elapsed = Math.min((now - previous) / 1000, 0.1); previous = now;
  if (!document.hidden) {
    if (inBattle() && game.status === 'playing' && !paused) {
      accumulator += elapsed;
      while (accumulator >= 1 / 60) { game.update(1 / 60, inputs()); accumulator -= 1 / 60; }
    } else accumulator = 0;
    if (inBattle() && (game.status === 'won' || game.status === 'lost')) { if (!editorDialog.open && !$('#guide-dialog').open) resultElapsed += elapsed; showResult(); if (game.mode === 'demo' && resultElapsed >= 3.5) continueAfterResult(); }
    render(ctx, game, { preview: game.status === 'ready', time: game.status === 'ready' ? now / 1000 : game.time });
    uiTimer += elapsed; if (uiTimer >= 0.12) { syncUI(); uiTimer = 0; }
  }
  requestAnimationFrame(frame);
}
setMode('solo'); syncUI(); requestAnimationFrame(frame);

// Read-only access for browser smoke checks and local debugging.
export function inspectGame() { return { status: game.status, paused, level: game.level, seed: game.seed, attempt: game.attempt, mode: game.mode, score: game.score, remaining: game.remaining, time: game.time, aiStats: { ...game.aiStats }, players: game.players.map(p => ({ x: p.x, y: p.y, lives: p.lives, level: p.level, ai: p.ai, alive: p.alive })), enemies: game.enemies.length, bullets: game.bullets.length }; }
