const SAVE_KEY = "blockBreakerSaveData";

export const DIFFICULTIES = {
  easy: {
    id: "easy",
    label: "イージー",
    timeMultiplier: 2,
    paddleMultiplier: 1.5,
    scoreMultiplier: 0.8
  },
  normal: {
    id: "normal",
    label: "ノーマル",
    timeMultiplier: 1,
    paddleMultiplier: 1,
    scoreMultiplier: 1
  },
  hard: {
    id: "hard",
    label: "ハード",
    timeMultiplier: 0.75,
    paddleMultiplier: 0.5,
    scoreMultiplier: 1.3
  },
  nightmare: {
    id: "nightmare",
    label: "ナイトメア",
    timeMultiplier: 0.5,
    paddleMultiplier: 0.25,
    scoreMultiplier: 1.5
  }
};

export const ACHIEVEMENTS = [
  { id: "first_clear", name: "はじめの一歩", description: "ステージ1をクリアする" },
  { id: "no_miss", name: "ノーミスクリア", description: "残機を失わずにステージをクリアする" },
  { id: "speed_star", name: "スピードスター", description: "目標タイム以内にステージをクリアする" },
  { id: "block_hunter", name: "ブロックハンター", description: "累計100個のブロックを壊す" },
  { id: "warp_user", name: "ワープ使い", description: "ワープを10回使う" },
  { id: "complete", name: "完全制覇", description: "全ステージをクリアする" }
];

export function createDefaultSave() {
  const playerId = createPlayerId();
  return {
    player: {
      id: playerId,
      name: createDefaultPlayerName(playerId)
    },
    unlockedStage: 1,
    stages: {},
    stats: {
      clears: 0,
      blocksBroken: 0,
      warpUses: 0
    },
    achievements: {},
    settings: {
      sound: true,
      difficulty: "normal",
      ballSpeedMultiplier: 1
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

export function getDifficultyConfig(settingsOrDifficulty) {
  const key = typeof settingsOrDifficulty === "string" ? settingsOrDifficulty : settingsOrDifficulty?.difficulty;
  return DIFFICULTIES[key] ?? DIFFICULTIES.normal;
}

export function normalizeSpeedMultiplier(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.round(Math.max(0.5, Math.min(3, number)) * 10) / 10;
}

export function makeRecordKey(settings) {
  const difficulty = getDifficultyConfig(settings).id;
  const speed = normalizeSpeedMultiplier(settings?.ballSpeedMultiplier).toFixed(1);
  return `${difficulty}@${speed}x`;
}

export function recordStageClear(save, stage, result, totalStages) {
  const next = normalizeSave(save);
  const recordKey = makeRecordKey(result.settings ?? next.settings);
  const current = next.stages[stage.id] ?? {};
  const currentModeRecord = current.records?.[recordKey] ?? {};
  const bestScore = Math.max(currentModeRecord.bestScore ?? 0, result.score);
  const bestTime = currentModeRecord.bestTime == null ? result.clearTime : Math.min(currentModeRecord.bestTime, result.clearTime);
  const bestRank = betterRank(currentModeRecord.bestRank, result.rank);
  const modeRecord = {
    cleared: true,
    bestScore,
    bestTime,
    bestRank,
    difficulty: result.settings?.difficulty ?? next.settings.difficulty,
    ballSpeedMultiplier: normalizeSpeedMultiplier(result.settings?.ballSpeedMultiplier ?? next.settings.ballSpeedMultiplier)
  };

  const records = {
    ...(current.records ?? {}),
    [recordKey]: modeRecord
  };

  const allRecords = Object.values(records);
  const allBestScore = Math.max(current.bestScore ?? 0, result.score, ...allRecords.map((item) => item.bestScore ?? 0));
  const allBestTimeValues = [current.bestTime, result.clearTime, ...allRecords.map((item) => item.bestTime)].filter((value) => Number.isFinite(value));
  const allBestTime = allBestTimeValues.length ? Math.min(...allBestTimeValues) : result.clearTime;
  const allBestRank = allRecords.reduce((rank, item) => betterRank(rank, item.bestRank), betterRank(current.bestRank, result.rank));

  next.stages[stage.id] = {
    cleared: true,
    bestScore: allBestScore,
    bestTime: allBestTime,
    bestRank: allBestRank,
    records
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
  return updateSettings(save, { sound: Boolean(enabled) });
}

export function updateSettings(save, partialSettings) {
  const next = normalizeSave(save);
  const nextSettings = {
    ...next.settings,
    ...partialSettings
  };

  next.settings = normalizeSettings(nextSettings);
  saveData(next);
  return next;
}

export function updatePlayerProfile(save, partialPlayer) {
  const next = normalizeSave(save);
  next.player = normalizePlayer({
    ...next.player,
    ...partialPlayer,
    id: next.player.id
  });
  saveData(next);
  return next;
}

function unlockAchievements(save, stage, result, totalStages) {
  const newlyUnlocked = [];
  const clearedStageCount = Object.values(save.stages).filter((item) => item.cleared).length;

  const checks = [
    ["first_clear", stage?.id === 1],
    ["no_miss", result?.cleared && result.livesLost === 0],
    ["speed_star", result?.cleared && result.clearTime <= (stage?.targetTime ?? Infinity)],
    ["block_hunter", save.stats.blocksBroken >= 100],
    ["warp_user", save.stats.warpUses >= 10],
    ["complete", totalStages > 0 && clearedStageCount >= totalStages]
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
  const order = { S: 4, A: 3, B: 2, C: 1, "-": 0, undefined: 0, null: 0 };
  if (!a) return b;
  if (!b) return a;
  return (order[b] ?? 0) > (order[a] ?? 0) ? b : a;
}

function normalizeSave(input) {
  const base = createDefaultSave();
  const normalized = {
    ...base,
    ...input,
    player: normalizePlayer(input?.player ?? base.player),
    stages: normalizeStages(input?.stages ?? {}),
    stats: { ...base.stats, ...(input?.stats ?? {}) },
    achievements: { ...base.achievements, ...(input?.achievements ?? {}) },
    settings: normalizeSettings({ ...base.settings, ...(input?.settings ?? {}) })
  };

  if (!input?.player?.name && input?.settings?.playerName) {
    normalized.player.name = normalizePlayerName(input.settings.playerName) || normalized.player.name;
  }

  return normalized;
}

function normalizePlayer(player) {
  const id = normalizePlayerId(player?.id) || createPlayerId();
  const name = normalizePlayerName(player?.name) || createDefaultPlayerName(id);
  return { id, name };
}

function normalizePlayerId(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 40);
}

function normalizePlayerName(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10);
}

function createPlayerId() {
  if (globalThis.crypto?.randomUUID) {
    return `p_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function createDefaultPlayerName(playerId) {
  return `P${playerId.replace(/[^a-zA-Z0-9]/g, "").slice(-9).toUpperCase()}`.slice(0, 10);
}

function normalizeSettings(settings) {
  const difficulty = DIFFICULTIES[settings.difficulty] ? settings.difficulty : "normal";
  return {
    sound: Boolean(settings.sound),
    difficulty,
    ballSpeedMultiplier: normalizeSpeedMultiplier(settings.ballSpeedMultiplier)
  };
}

function normalizeStages(stages) {
  const normalized = {};
  for (const [stageId, record] of Object.entries(stages)) {
    const records = { ...(record?.records ?? {}) };

    if (record?.cleared && Object.keys(records).length === 0) {
      records["legacy"] = {
        cleared: true,
        bestScore: record.bestScore ?? 0,
        bestTime: record.bestTime ?? null,
        bestRank: record.bestRank ?? "-",
        difficulty: "normal",
        ballSpeedMultiplier: 1
      };
    }

    normalized[stageId] = {
      ...record,
      cleared: Boolean(record?.cleared),
      bestScore: record?.bestScore ?? Math.max(0, ...Object.values(records).map((item) => item.bestScore ?? 0)),
      bestTime: record?.bestTime ?? minNullable(Object.values(records).map((item) => item.bestTime)),
      bestRank: record?.bestRank ?? Object.values(records).reduce((rank, item) => betterRank(rank, item.bestRank), "-"),
      records
    };
  }
  return normalized;
}

function minNullable(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? Math.min(...valid) : null;
}
