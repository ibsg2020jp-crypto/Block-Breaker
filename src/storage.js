const SAVE_KEY = "blockBreakerSaveData";

export const ACHIEVEMENTS = [
  { id: "first_clear", name: "はじめの一歩", description: "ステージ1をクリアする" },
  { id: "no_miss", name: "ノーミスクリア", description: "残機を失わずにステージをクリアする" },
  { id: "speed_star", name: "スピードスター", description: "目標タイム以内にステージをクリアする" },
  { id: "block_hunter", name: "ブロックハンター", description: "累計100個のブロックを壊す" },
  { id: "warp_user", name: "ワープ使い", description: "ワープを10回使う" },
  { id: "complete", name: "完全制覇", description: "全ステージをクリアする" }
];

export function createDefaultSave() {
  return {
    unlockedStage: 1,
    stages: {},
    stats: {
      clears: 0,
      blocksBroken: 0,
      warpUses: 0
    },
    achievements: {},
    settings: {
      sound: true
    }
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createDefaultSave();
    return normalizeSave(JSON.parse(raw));
  } catch (error) {
    console.warn("セーブデータの読み込みに失敗しました。初期化します。", error);
    return createDefaultSave();
  }
}

export function saveData(data) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(normalizeSave(data)));
}

export function resetSave() {
  const next = createDefaultSave();
  saveData(next);
  return next;
}

export function recordStageClear(save, stage, result, totalStages) {
  const next = normalizeSave(save);
  const current = next.stages[stage.id] ?? {};
  const bestScore = Math.max(current.bestScore ?? 0, result.score);
  const bestTime = current.bestTime == null ? result.clearTime : Math.min(current.bestTime, result.clearTime);
  const bestRank = betterRank(current.bestRank, result.rank);

  next.stages[stage.id] = {
    cleared: true,
    bestScore,
    bestTime,
    bestRank
  };

  next.unlockedStage = Math.max(next.unlockedStage, Math.min(totalStages, stage.id + 1));
  next.stats.clears += 1;
  next.stats.blocksBroken += result.blocksBroken;
  next.stats.warpUses += result.warpUses;

  return unlockAchievements(next, stage, result, totalStages);
}

export function recordStageFail(save, result) {
  const next = normalizeSave(save);
  next.stats.blocksBroken += result.blocksBroken;
  next.stats.warpUses += result.warpUses;
  unlockAchievements(next, null, result, 0);
  return next;
}

export function updateSoundSetting(save, enabled) {
  const next = normalizeSave(save);
  next.settings.sound = Boolean(enabled);
  saveData(next);
  return next;
}

function unlockAchievements(save, stage, result, totalStages) {
  const newlyUnlocked = [];

  const checks = [
    ["first_clear", stage?.id === 1],
    ["no_miss", result?.cleared && result.livesLost === 0],
    ["speed_star", result?.cleared && result.clearTime <= (stage?.targetTime ?? Infinity)],
    ["block_hunter", save.stats.blocksBroken >= 100],
    ["warp_user", save.stats.warpUses >= 10],
    ["complete", totalStages > 0 && Object.values(save.stages).filter((item) => item.cleared).length >= totalStages]
  ];

  for (const [id, achieved] of checks) {
    if (achieved && !save.achievements[id]) {
      save.achievements[id] = new Date().toISOString();
      newlyUnlocked.push(id);
    }
  }

  saveData(save);
  return newlyUnlocked;
}

function betterRank(a, b) {
  const order = { S: 4, A: 3, B: 2, C: 1 };
  if (!a) return b;
  return order[b] > order[a] ? b : a;
}

function normalizeSave(input) {
  const base = createDefaultSave();
  return {
    ...base,
    ...input,
    stages: { ...base.stages, ...(input?.stages ?? {}) },
    stats: { ...base.stats, ...(input?.stats ?? {}) },
    achievements: { ...base.achievements, ...(input?.achievements ?? {}) },
    settings: { ...base.settings, ...(input?.settings ?? {}) }
  };
}
