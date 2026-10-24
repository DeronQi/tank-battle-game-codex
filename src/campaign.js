// Both manual advancement and demo autopilot use the same progression rules.
export function nextStageOptions(game, config, seed) {
  if (game.status !== 'won') throw new Error('只有胜利后才能进入下一关');
  return { ...config, level: game.level + 1, seed, score: game.score, carry: game.progression() };
}

export function retryStageOptions(game, config) {
  if (game.status !== 'lost') throw new Error('只有失败后才能重试当前关卡');
  return { ...config, level: game.level, seed: game.seed, attempt: game.attempt + 1, map: game.initialMap.map(row => [...row]), score: game.startingState.score, carry: game.startingState.players.map(player => ({ ...player })) };
}
