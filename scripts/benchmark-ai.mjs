import { Game } from '../src/engine.js';
import { mkdir, writeFile } from 'node:fs/promises';

const report = { difficulty: 'normal', stage: 1, seeds: '0–99', timestep: '1/30 second', simulationLimitSeconds: 360, results: [] };
for (const aiCount of [1, 2]) {
  const result = { players: aiCount, games: 100, wins: 0, losses: 0, unfinishedSeeds: [], kills: 0, deaths: 0, evasions: 0, counterShots: 0, interceptions: 0, baseBlocks: 0, baseInterceptions: 0, pickups: 0 };
  const winTimes = [];
  for (let seed = 0; seed < 100; seed++) {
    const game = new Game({ seed, mode: 'demo', aiCount, onEvent: e => { if (e.type === 'playerHit') result.deaths++; } });
    for (let i = 0; i < 360 * 30 && game.status === 'playing'; i++) game.update(1 / 30);
    if (game.status === 'won') { result.wins++; winTimes.push(game.time); } else if (game.status === 'lost') result.losses++; else result.unfinishedSeeds.push(seed);
    result.kills += game.kills;
    for (const key of Object.keys(game.aiStats)) result[key] += game.aiStats[key];
  }
  result.averageWinSeconds = winTimes.length ? winTimes.reduce((sum, value) => sum + value, 0) / winTimes.length : null;
  result.medianWinSeconds = winTimes.length ? [...winTimes].sort((a, b) => a - b)[Math.floor(winTimes.length / 2)] : null;
  report.results.push(result);
}
await mkdir(new URL('../output/', import.meta.url), { recursive: true });
await writeFile(new URL('../output/ai-benchmark.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
