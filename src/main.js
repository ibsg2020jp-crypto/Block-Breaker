import { STAGES } from "./stages.js";
import { Game } from "./game.js";
import { formatDecimal, formatTime } from "./physics.js";
import {
  ACHIEVEMENTS,
  loadSave,
  recordStageClear,
  recordStageFail,
  resetSave,
  updateSoundSetting
} from "./storage.js";
import { SoundSystem } from "./audio.js";

const $ = (id) => document.getElementById(id);

const screens = [...document.querySelectorAll(".screen")];
const canvas = $("gameCanvas");
let save = loadSave();
let currentStageIndex = 0;
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

  $("soundToggle").addEventListener("change", (event) => {
    save = updateSoundSetting(save, event.target.checked);
    audio.setEnabled(save.settings.sound);
    audio.play("click");
  });

  $("resetSaveButton").addEventListener("click", () => {
    const ok = confirm("進行状況・ベストタイム・実績をリセットしますか？");
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
  game.loadStage(stage);
  game.start();
}

function handleStageClear(result) {
  const stage = STAGES[currentStageIndex];
  const newlyUnlocked = recordStageClear(save, stage, result, STAGES.length);
  save = loadSave();
  renderStageList();
  renderAchievements();
  showResult(true, result, newlyUnlocked);
}

function handleStageFail(result) {
  save = recordStageFail(save, result);
  renderAchievements();
  showResult(false, result, []);
}

function showResult(cleared, result, newlyUnlocked) {
  game.stop();
  const stage = STAGES[currentStageIndex];
  $("resultTitle").textContent = cleared ? "ステージクリア！" : "失敗…";
  $("resultSubtitle").textContent = cleared ? stage.dialogueAfter?.[0] ?? "次のステージへ進めます。" : result.reason;

  const rows = [
    ["ステージ", `${stage.id}：${stage.name}`],
    ["スコア", result.score.toLocaleString()],
    ["タイム", formatDecimal(result.clearTime)],
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

  $("nextStageButton").hidden = !cleared || currentStageIndex >= STAGES.length - 1;
  showScreen("resultScreen");
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
  const time = record.bestTime == null ? "-" : formatDecimal(record.bestTime);
  return `評価 ${record.bestRank} / Best ${time}`;
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
  $("soundToggle").checked = Boolean(save.settings.sound);
}
