import { STAGES } from "./stages.js";
import { Game } from "./game.js";
import { formatDecimal, formatTime } from "./physics.js";
import { fetchRanking, sanitizePlayerName, submitScore } from "./ranking.js";
import {
  ACHIEVEMENTS,
  getDifficultyConfig,
  loadSave,
  makeRecordKey,
  normalizeSpeedMultiplier,
  recordStageClear,
  recordStageFail,
  resetSave,
  updateSettings,
  updateSoundSetting
} from "./storage.js";
import { SoundSystem } from "./audio.js";

const RANKING_API_URL = "https://script.google.com/macros/s/AKfycbzT4qClBfy4bDu1F3ve9i60XE7vCcEjEaXH6myDFL3aTAWmhcKNA-zj3Qa7DY6_e6lM/exec";
const $ = (id) => document.getElementById(id);

const screens = [...document.querySelectorAll(".screen")];
const canvas = $("gameCanvas");
let save = loadSave();
let currentStageIndex = 0;
let latestClearResult = null;
const audio = new SoundSystem(save.settings.sound);

const game = new Game(canvas, {
  onStats: updateHud,
  onSound: (type) => audio.play(type),
  onStageClear: handleStageClear,
  onStageFail: handleStageFail
});

init();

function init() {
  bindButtons();
  renderStageList();
  renderAchievements();
  renderSettings();
  renderRankingStageSelect();
  showScreen("titleScreen");
}

function bindButtons() {
  $("startButton").addEventListener("click", () => {
    audio.play("click");
    startStage(Math.max(0, save.unlockedStage - 1));
  });

  $("stageButton").addEventListener("click", () => {
    audio.play("click");
    renderStageList();
    showScreen("stageScreen");
  });

  $("rankingButton").addEventListener("click", () => {
    audio.play("click");
    renderRankingStageSelect();
    showScreen("rankingScreen");
    loadRanking();
  });

  $("achievementButton").addEventListener("click", () => {
    audio.play("click");
    renderAchievements();
    showScreen("achievementScreen");
  });

  $("settingsButton").addEventListener("click", () => {
    audio.play("click");
    renderSettings();
    showScreen("settingsScreen");
  });

  document.querySelectorAll("[data-screen]").forEach((button) => {
    button.addEventListener("click", () => {
      audio.play("click");
      if (button.dataset.screen === "stageScreen") renderStageList();
      if (button.dataset.screen === "rankingScreen") {
        renderRankingStageSelect();
        loadRanking();
      }
      showScreen(button.dataset.screen);
    });
  });

  $("pauseButton").addEventListener("click", () => {
    const state = game.togglePause();
    $("pauseButton").textContent = state === "paused" ? "再開" : "一時停止";
  });

  $("retryButton").addEventListener("click", () => {
    audio.play("click");
    startStage(currentStageIndex, true);
  });

  $("nextStageButton").addEventListener("click", () => {
    audio.play("click");
    const next = Math.min(STAGES.length - 1, currentStageIndex + 1);
    startStage(next);
  });

  $("resultStageButton").addEventListener("click", () => {
    audio.play("click");
    renderStageList();
    showScreen("stageScreen");
  });

  $("submitScoreButton").addEventListener("click", async () => {
    await submitLatestScore();
  });

  $("playerNameInput").addEventListener("input", (event) => {
    event.target.value = sanitizePlayerName(event.target.value);
  });

  $("rankingStageSelect").addEventListener("change", () => {
    loadRanking();
  });

  $("refreshRankingButton").addEventListener("click", () => {
    audio.play("click");
    loadRanking();
  });

  $("soundToggle").addEventListener("change", (event) => {
    save = updateSoundSetting(save, event.target.checked);
    audio.setEnabled(save.settings.sound);
    audio.play("click");
  });

  $("difficultySelect").addEventListener("change", (event) => {
    save = updateSettings(save, { difficulty: event.target.value });
    audio.play("click");
    renderSettings();
    renderStageList();
  });

  $("ballSpeedRange").addEventListener("input", (event) => {
    const speed = normalizeSpeedMultiplier(event.target.value);
    $("ballSpeedValue").textContent = `${speed.toFixed(1)}x`;
  });

  $("ballSpeedRange").addEventListener("change", (event) => {
    const speed = normalizeSpeedMultiplier(event.target.value);
    save = updateSettings(save, { ballSpeedMultiplier: speed });
    audio.play("click");
    renderSettings();
    renderStageList();
  });

  $("resetSaveButton").addEventListener("click", () => {
    const ok = confirm("進行状況・ベストタイム・実績・設定をリセットしますか？");
    if (!ok) return;
    save = resetSave();
    audio.setEnabled(save.settings.sound);
    renderStageList();
    renderAchievements();
    renderSettings();
    showScreen("titleScreen");
  });
}

function showScreen(screenId) {
  screens.forEach((screen) => {
    screen.classList.toggle("is-active", screen.id === screenId);
  });

  if (screenId !== "gameScreen") {
    game.stop();
  }
}

function startStage(index, skipDialogue = false) {
  const safeIndex = Math.max(0, Math.min(STAGES.length - 1, index));
  const stage = STAGES[safeIndex];
  if (stage.id > save.unlockedStage) return;
  currentStageIndex = safeIndex;
  latestClearResult = null;

  if (!skipDialogue && stage.dialogueBefore?.length) {
    showDialogue(stage, stage.dialogueBefore, () => loadGame(stage));
    return;
  }

  loadGame(stage);
}

function showDialogue(stage, lines, onDone) {
  let index = 0;
  $("dialogueTitle").textContent = `ステージ${stage.id}：${stage.name}`;

  const render = () => {
    $("dialogueText").textContent = lines[index];
    $("dialogueNextButton").textContent = index >= lines.length - 1 ? "開始" : "次へ";
  };

  const handler = () => {
    audio.play("click");
    if (index >= lines.length - 1) {
      $("dialogueNextButton").removeEventListener("click", handler);
      onDone();
      return;
    }
    index += 1;
    render();
  };

  $("dialogueNextButton").replaceWith($("dialogueNextButton").cloneNode(true));
  $("dialogueNextButton").addEventListener("click", handler);
  render();
  showScreen("dialogueScreen");
}

function loadGame(stage) {
  $("pauseButton").textContent = "一時停止";
  showScreen("gameScreen");
  game.loadStage(stage, buildPlaySettings());
  game.start();
}

function buildPlaySettings() {
  const difficulty = getDifficultyConfig(save.settings);
  return {
    difficulty: difficulty.id,
    timeMultiplier: difficulty.timeMultiplier,
    paddleMultiplier: difficulty.paddleMultiplier,
    scoreMultiplier: difficulty.scoreMultiplier,
    ballSpeedMultiplier: normalizeSpeedMultiplier(save.settings.ballSpeedMultiplier)
  };
}

function handleStageClear(result) {
  const stage = STAGES[currentStageIndex];
  latestClearResult = result;
  const newlyUnlocked = recordStageClear(save, stage, result, STAGES.length);
  save = loadSave();
  renderStageList();
  renderAchievements();
  showResult(true, result, newlyUnlocked);
}

function handleStageFail(result) {
  latestClearResult = null;
  save = recordStageFail(save, result);
  renderAchievements();
  showResult(false, result, []);
}

function showResult(cleared, result, newlyUnlocked) {
  game.stop();
  const stage = STAGES[currentStageIndex];
  const difficulty = getDifficultyConfig(result.settings?.difficulty);
  $("resultTitle").textContent = cleared ? "ステージクリア！" : "失敗…";
  $("resultSubtitle").textContent = cleared ? stage.dialogueAfter?.[0] ?? "次のステージへ進めます。" : result.reason;

  const rows = [
    ["ステージ", `${stage.id}：${stage.name}`],
    ["難易度", difficulty.label],
    ["ボール速度", `${normalizeSpeedMultiplier(result.settings?.ballSpeedMultiplier).toFixed(1)}x`],
    ["スコア", result.score.toLocaleString()],
    ["タイム", formatDecimal(result.clearTime)],
    ["残り時間ボーナス", `${(result.timeBonus ?? 0).toLocaleString()}点`],
    ["残機", `${Math.max(0, result.lives)} / ${stage.lives}`],
    ["評価", result.rank]
  ];

  $("resultStats").innerHTML = rows
    .map(([label, value]) => `<div class="stat-row"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");

  const achievementNames = newlyUnlocked
    .map((id) => ACHIEVEMENTS.find((item) => item.id === id)?.name)
    .filter(Boolean);

  $("resultAchievements").textContent = achievementNames.length
    ? `実績解除：${achievementNames.join("、")}`
    : "新しい実績解除はありません。";

  renderScoreSubmit(cleared, result, stage, difficulty);
  $("nextStageButton").hidden = !cleared || currentStageIndex >= STAGES.length - 1;
  showScreen("resultScreen");
}

function renderScoreSubmit(cleared, result, stage, difficulty) {
  const box = $("scoreSubmitBox");
  if (!cleared) {
    box.hidden = true;
    return;
  }

  box.hidden = false;
  $("scoreSubmitSummary").textContent = `${stage.name} / ${difficulty.label} / ${normalizeSpeedMultiplier(result.settings?.ballSpeedMultiplier).toFixed(1)}x / ${result.score.toLocaleString()}点`;
  $("scoreSubmitStatus").textContent = "";
  $("submitScoreButton").disabled = false;
}

async function submitLatestScore() {
  if (!latestClearResult) return;
  const name = sanitizePlayerName($("playerNameInput").value);
  if (!name) {
    $("scoreSubmitStatus").textContent = "名前は英数字1〜10文字で入力してください。";
    return;
  }

  const stage = STAGES[currentStageIndex];
  const difficulty = getDifficultyConfig(latestClearResult.settings?.difficulty);
  $("submitScoreButton").disabled = true;
  $("scoreSubmitStatus").textContent = "送信中...";

  try {
    await submitScore(RANKING_API_URL, {
      name,
      score: latestClearResult.score,
      stageId: stage.id,
      stageName: stage.name,
      difficulty: difficulty.label,
      ballSpeed: `${normalizeSpeedMultiplier(latestClearResult.settings?.ballSpeedMultiplier).toFixed(1)}x`,
      clearTime: formatDecimal(latestClearResult.clearTime)
    });
    $("scoreSubmitStatus").textContent = "ランキングに送信しました。";
    $("submitScoreButton").disabled = false;
    renderRankingStageSelect(stage.id);
    await loadRanking(stage.id);
  } catch (error) {
    console.error(error);
    $("scoreSubmitStatus").textContent = "送信に失敗しました。時間をおいて再試行してください。";
    $("submitScoreButton").disabled = false;
  }
}

function updateHud(stats) {
  $("hudStage").textContent = stats.stageName;
  $("hudScore").textContent = stats.score.toLocaleString();
  $("hudLives").textContent = stats.lives;
  $("hudTime").textContent = formatTime(stats.remainingTime);
}

function renderStageList() {
  const list = $("stageList");
  list.innerHTML = "";

  STAGES.forEach((stage, index) => {
    const unlocked = stage.id <= save.unlockedStage;
    const record = save.stages[stage.id] ?? {};
    const button = document.createElement("button");
    button.className = `stage-card ${unlocked ? "" : "is-locked"}`;
    button.disabled = !unlocked;
    button.innerHTML = `
      <span class="stage-card__number">${unlocked ? `Stage ${stage.id}` : "Locked"}</span>
      <strong>${stage.name}</strong>
      <span>${unlocked ? getStageSummary(record) : "前のステージをクリアすると開放"}</span>
    `;
    button.addEventListener("click", () => {
      audio.play("click");
      startStage(index);
    });
    list.appendChild(button);
  });
}

function getStageSummary(record) {
  if (!record.cleared) return "未クリア";
  const currentKey = makeRecordKey(save.settings);
  const currentRecord = record.records?.[currentKey];
  const overallScore = record.bestScore == null ? "-" : record.bestScore.toLocaleString();
  const overallTime = record.bestTime == null ? "-" : formatDecimal(record.bestTime);

  if (currentRecord) {
    return `現在設定: ${currentRecord.bestScore.toLocaleString()}点 / ${formatDecimal(currentRecord.bestTime)}｜総合: ${overallScore}点 / ${overallTime}`;
  }

  return `現在設定: 未記録｜総合: ${overallScore}点 / ${overallTime}`;
}

function renderAchievements() {
  const list = $("achievementList");
  list.innerHTML = "";

  ACHIEVEMENTS.forEach((achievement) => {
    const unlockedAt = save.achievements[achievement.id];
    const item = document.createElement("li");
    item.className = `achievement ${unlockedAt ? "is-unlocked" : ""}`;
    item.innerHTML = `
      <strong>${unlockedAt ? "🏆" : "🔒"} ${achievement.name}</strong>
      <span>${achievement.description}</span>
    `;
    list.appendChild(item);
  });
}

function renderSettings() {
  const difficulty = getDifficultyConfig(save.settings);
  const speed = normalizeSpeedMultiplier(save.settings.ballSpeedMultiplier);

  $("soundToggle").checked = Boolean(save.settings.sound);
  $("difficultySelect").value = difficulty.id;
  $("difficultyDescription").textContent = `制限時間 ${difficulty.timeMultiplier}x / パドル ${difficulty.paddleMultiplier}x / スコア ${difficulty.scoreMultiplier}x`;
  $("ballSpeedRange").value = speed.toFixed(1);
  $("ballSpeedValue").textContent = `${speed.toFixed(1)}x`;
}

function renderRankingStageSelect(selectedStageId = Number($("rankingStageSelect")?.value) || 0) {
  const select = $("rankingStageSelect");
  select.innerHTML = `<option value="0">全ステージ</option>`;
  STAGES.forEach((stage) => {
    const option = document.createElement("option");
    option.value = String(stage.id);
    option.textContent = `Stage ${stage.id}: ${stage.name}`;
    select.appendChild(option);
  });
  select.value = String(selectedStageId || 0);
}

async function loadRanking(stageId = Number($("rankingStageSelect").value) || 0) {
  $("rankingStatus").textContent = "読み込み中...";
  $("rankingList").innerHTML = "";

  try {
    const data = await fetchRanking(RANKING_API_URL, { stageId, limit: 10 });
    const ranking = data.ranking ?? [];
    if (!ranking.length) {
      $("rankingStatus").textContent = "まだ記録がありません。";
      return;
    }

    $("rankingStatus").textContent = "";
    $("rankingList").innerHTML = ranking
      .map((row) => `
        <li class="ranking-row">
          <span class="ranking-rank">${row.rank}</span>
          <strong>${escapeHtml(row.name)}</strong>
          <span>${Number(row.score).toLocaleString()}点</span>
          <small>${escapeHtml(row.stageName)} / ${escapeHtml(row.difficulty)} / ${escapeHtml(row.ballSpeed)} / ${escapeHtml(row.clearTime)}</small>
        </li>
      `)
      .join("");
  } catch (error) {
    console.error(error);
    $("rankingStatus").textContent = "ランキングを読み込めませんでした。Apps Scriptの公開設定を確認してください。";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
