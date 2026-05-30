import { BLOCK_DEFS } from "./stages.js";
import { circleRectCollision, clamp, reflectFromPaddle } from "./physics.js";

const WORLD_WIDTH = 360;
const WORLD_HEIGHT = 640;
const BLOCK_MARGIN = 18;
const BLOCK_TOP = 96;
const BLOCK_GAP = 6;
const BLOCK_HEIGHT = 22;
const BASE_PADDLE_WIDTH = 100;
const BASE_BALL_SPEED = 270;

export class Game {
  constructor(canvas, hooks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hooks = hooks;
    this.stage = null;
    this.blocks = [];
    this.state = "idle";
    this.keys = new Set();
    this.lastTime = 0;
    this.animationId = 0;
    this.running = false;
    this.pointerActive = false;
    this.result = null;
    this.playSettings = createPlaySettings();

    this.paddle = { x: 130, y: 568, w: BASE_PADDLE_WIDTH, h: 14, speed: 360 };
    this.ball = {
      x: 180,
      y: 548,
      r: 7,
      vx: 0,
      vy: 0,
      speed: BASE_BALL_SPEED,
      stuck: true,
      warpCooldown: 0,
      warpLocked: false
    };

    this.bindInput();
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
    window.addEventListener("keydown", (event) => this.handleKeyDown(event));
    window.addEventListener("keyup", (event) => this.keys.delete(event.key));
  }

  loadStage(stage, settings = {}) {
    this.stage = stage;
    this.playSettings = createPlaySettings(settings);
    this.blocks = createBlocks(stage.layout);
    this.state = "ready";
    this.elapsed = 0;
    this.stageTimeLimit = Math.max(15, Math.round(stage.timeLimit * this.playSettings.timeMultiplier));
    this.stageTargetTime = Math.max(10, stage.targetTime * this.playSettings.timeMultiplier);
    this.remainingTime = this.stageTimeLimit;
    this.score = 0;
    this.lives = stage.lives;
    this.startLives = stage.lives;
    this.blocksBroken = 0;
    this.warpUses = 0;
    this.switchUsed = false;
    this.result = null;
    this.paddle.w = clamp(BASE_PADDLE_WIDTH * this.playSettings.paddleMultiplier, 24, 150);
    this.paddle.x = (WORLD_WIDTH - this.paddle.w) / 2;
    this.paddle.y = 568;
    this.ball.speed = BASE_BALL_SPEED * this.playSettings.ballSpeedMultiplier;
    this.resetBall();
    this.notifyStats();
    this.render();
  }

  start() {
    cancelAnimationFrame(this.animationId);
    this.running = true;
    this.lastTime = performance.now();
    const tick = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.033, (now - this.lastTime) / 1000 || 0);
      this.lastTime = now;
      this.update(dt);
      this.render();
      if (this.running) this.animationId = requestAnimationFrame(tick);
    };
    this.animationId = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.animationId);
  }

  launchBall() {
    if (this.state !== "ready") return;
    this.state = "playing";
    this.ball.stuck = false;
    this.ball.vx = 95 * this.playSettings.ballSpeedMultiplier;
    this.ball.vy = -this.ball.speed;
    this.limitBallSpeed();
    this.hooks.onSound?.("launch");
  }

  togglePause() {
    if (this.state === "playing") {
      this.state = "paused";
    } else if (this.state === "paused") {
      this.state = "playing";
    }
    return this.state;
  }

  update(dt) {
    if (!this.stage) return;
    this.updateKeyboard(dt);

    if (this.ball.stuck) {
      this.ball.x = this.paddle.x + this.paddle.w / 2;
      this.ball.y = this.paddle.y - this.ball.r - 2;
    }

    if (this.state !== "playing") {
      this.notifyStats();
      return;
    }

    this.elapsed += dt;
    this.remainingTime = Math.max(0, this.stageTimeLimit - this.elapsed);
    this.ball.warpCooldown = Math.max(0, this.ball.warpCooldown - dt);

    if (this.remainingTime <= 0) {
      this.fail("時間切れ");
      return;
    }

    this.moveBall(dt);
    this.checkPaddleCollision();
    this.checkBlockCollision();
    this.checkWarpCollision();

    if (this.countBreakableBlocks() === 0) {
      this.clearStage();
      return;
    }

    this.notifyStats();
  }

  updateKeyboard(dt) {
    let direction = 0;
    if (this.keys.has("ArrowLeft")) direction -= 1;
    if (this.keys.has("ArrowRight")) direction += 1;
    if (direction !== 0) {
      this.paddle.x = clamp(this.paddle.x + direction * this.paddle.speed * dt, 0, WORLD_WIDTH - this.paddle.w);
    }
  }

  moveBall(dt) {
    const steps = Math.max(1, Math.ceil(Math.hypot(this.ball.vx, this.ball.vy) * dt / 8));
    const stepDt = dt / steps;

    for (let i = 0; i < steps; i += 1) {
      this.prevBall = { x: this.ball.x, y: this.ball.y };
      this.ball.x += this.ball.vx * stepDt;
      this.ball.y += this.ball.vy * stepDt;
      this.checkWallCollision();
      if (this.ball.y - this.ball.r > WORLD_HEIGHT) {
        this.loseLife();
        break;
      }
    }
  }

  checkWallCollision() {
    if (this.ball.x - this.ball.r <= 0) {
      this.ball.x = this.ball.r;
      this.ball.vx = Math.abs(this.ball.vx);
      this.hooks.onSound?.("wall");
    }
    if (this.ball.x + this.ball.r >= WORLD_WIDTH) {
      this.ball.x = WORLD_WIDTH - this.ball.r;
      this.ball.vx = -Math.abs(this.ball.vx);
      this.hooks.onSound?.("wall");
    }
    if (this.ball.y - this.ball.r <= 0) {
      this.ball.y = this.ball.r;
      this.ball.vy = Math.abs(this.ball.vy);
      this.hooks.onSound?.("wall");
    }
  }

  checkPaddleCollision() {
    if (this.ball.vy <= 0) return;
    if (!circleRectCollision(this.ball, this.paddle)) return;

    this.ball.y = this.paddle.y - this.ball.r - 0.5;
    reflectFromPaddle(this.ball, this.paddle);
    this.limitBallSpeed();
    this.ball.warpLocked = false;
    this.ball.warpCooldown = 0;
    this.hooks.onSound?.("paddle");
  }

  checkBlockCollision() {
    for (const block of this.blocks) {
      if (!block.active || !circleRectCollision(this.ball, block)) continue;

      this.reflectFromBlock(block);

      if (block.breakable) {
        block.hp -= 1;
        if (block.hp <= 0) {
          block.active = false;
          this.addScore(block.score);
          this.blocksBroken += 1;
          this.hooks.onSound?.(block.type === "switch" ? "switch" : "block");
          if (block.type === "switch") this.activateSwitch();
        } else {
          this.addScore(50);
          this.hooks.onSound?.("block");
        }
      } else {
        this.hooks.onSound?.("wall");
      }

      break;
    }
  }

  reflectFromBlock(block) {
    const previous = this.prevBall ?? { x: this.ball.x - this.ball.vx * 0.016, y: this.ball.y - this.ball.vy * 0.016 };
    const wasAbove = previous.y + this.ball.r <= block.y;
    const wasBelow = previous.y - this.ball.r >= block.y + block.h;
    const wasLeft = previous.x + this.ball.r <= block.x;
    const wasRight = previous.x - this.ball.r >= block.x + block.w;

    if (wasAbove) {
      this.ball.y = block.y - this.ball.r - 0.5;
      this.ball.vy = -Math.abs(this.ball.vy);
    } else if (wasBelow) {
      this.ball.y = block.y + block.h + this.ball.r + 0.5;
      this.ball.vy = Math.abs(this.ball.vy);
    } else if (wasLeft) {
      this.ball.x = block.x - this.ball.r - 0.5;
      this.ball.vx = -Math.abs(this.ball.vx);
    } else if (wasRight) {
      this.ball.x = block.x + block.w + this.ball.r + 0.5;
      this.ball.vx = Math.abs(this.ball.vx);
    } else {
      this.ball.vy *= -1;
    }
  }

  activateSwitch() {
    if (this.switchUsed || !this.stage.switchEffect) return;
    this.switchUsed = true;
    const nextType = this.stage.switchEffect.convertLockedTo ?? "normal";
    const def = BLOCK_DEFS[nextType];

    for (const block of this.blocks) {
      if (block.active && block.type === "locked") {
        Object.assign(block, {
          type: nextType,
          hp: def.hp,
          score: def.score,
          color: def.color,
          breakable: def.breakable
        });
      }
    }

    if (this.stage.switchEffect.timeBonus) {
      this.elapsed = Math.max(0, this.elapsed - this.stage.switchEffect.timeBonus);
    }
  }

  checkWarpCollision() {
    if (!this.stage.warps?.length || this.ball.warpCooldown > 0 || this.ball.warpLocked) return;

    for (const warp of this.stage.warps) {
      const dx = this.ball.x - warp.in.x;
      const dy = this.ball.y - warp.in.y;
      if (Math.hypot(dx, dy) <= this.ball.r + 16) {
        this.ball.x = warp.out.x;
        this.ball.y = warp.out.y;
        this.ball.warpCooldown = 0.7;
        this.ball.warpLocked = true;
        this.warpUses += 1;
        this.hooks.onSound?.("warp");
        break;
      }
    }
  }

  loseLife() {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.fail("残機がなくなった");
      return;
    }
    this.state = "ready";
    this.resetBall();
    this.hooks.onSound?.("fail");
  }

  clearStage() {
    if (this.state === "clear") return;
    this.state = "clear";
    const clearTime = this.elapsed;
    const timeBonus = Math.ceil(this.remainingTime) * 10;
    const lifeBonus = this.lives * 300;
    this.addScore(1000 + timeBonus + lifeBonus);
    this.result = this.createResult(true, null, this.calculateRank(clearTime));
    this.hooks.onSound?.("clear");
    this.hooks.onStageClear?.(this.result);
  }

  fail(reason) {
    if (this.state === "fail") return;
    this.state = "fail";
    this.result = this.createResult(false, reason, "-");
    this.hooks.onSound?.("fail");
    this.hooks.onStageFail?.(this.result);
  }

  createResult(cleared, reason, rank) {
    return {
      cleared,
      reason,
      stageId: this.stage.id,
      score: this.score,
      clearTime: this.elapsed,
      targetTime: this.stageTargetTime,
      remainingTime: this.remainingTime,
      lives: this.lives,
      startLives: this.startLives,
      livesLost: this.startLives - this.lives,
      blocksBroken: this.blocksBroken,
      warpUses: this.warpUses,
      rank,
      settings: {
        difficulty: this.playSettings.difficulty,
        ballSpeedMultiplier: this.playSettings.ballSpeedMultiplier
      },
      modifiers: {
        timeMultiplier: this.playSettings.timeMultiplier,
        paddleMultiplier: this.playSettings.paddleMultiplier,
        scoreMultiplier: this.playSettings.scoreMultiplier
      }
    };
  }

  calculateRank(clearTime) {
    if (clearTime <= this.stageTargetTime && this.lives === this.startLives && this.score >= 2500) return "S";
    if (clearTime <= this.stageTargetTime) return "A";
    if (this.lives >= 2) return "B";
    return "C";
  }

  addScore(baseScore) {
    this.score += Math.max(0, Math.round(baseScore * this.playSettings.scoreMultiplier));
  }

  resetBall() {
    this.ball.stuck = true;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.x = this.paddle.x + this.paddle.w / 2;
    this.ball.y = this.paddle.y - this.ball.r - 2;
    this.ball.warpCooldown = 0;
    this.ball.warpLocked = false;
  }

  limitBallSpeed() {
    const base = BASE_BALL_SPEED * this.playSettings.ballSpeedMultiplier;
    const minSpeed = Math.max(120, base * 0.85);
    const maxSpeed = Math.min(900, base * 1.35);
    const speed = Math.min(maxSpeed, Math.max(minSpeed, Math.hypot(this.ball.vx, this.ball.vy)));
    const angle = Math.atan2(this.ball.vy, this.ball.vx);
    this.ball.vx = Math.cos(angle) * speed;
    this.ball.vy = Math.sin(angle) * speed;
  }

  countBreakableBlocks() {
    return this.blocks.filter((block) => block.active && block.breakable).length;
  }

  notifyStats() {
    this.hooks.onStats?.({
      stageName: this.stage?.name ?? "-",
      score: this.score ?? 0,
      lives: this.lives ?? 0,
      remainingTime: this.remainingTime ?? 0,
      state: this.state,
      breakableBlocks: this.countBreakableBlocks(),
      difficulty: this.playSettings.difficulty,
      ballSpeedMultiplier: this.playSettings.ballSpeedMultiplier
    });
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    drawBackground(ctx);
    this.drawWarps(ctx);
    this.drawBlocks(ctx);
    this.drawPaddle(ctx);
    this.drawBall(ctx);
    this.drawMessage(ctx);
  }

  drawBlocks(ctx) {
    for (const block of this.blocks) {
      if (!block.active) continue;
      ctx.save();
      ctx.fillStyle = block.color;
      ctx.globalAlpha = block.type === "locked" ? 0.72 : 1;
      roundRect(ctx, block.x, block.y, block.w, block.h, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.stroke();

      if (block.type === "hard" && block.hp > 1) {
        ctx.fillStyle = "rgba(15,23,42,0.55)";
        ctx.font = "bold 12px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(block.hp), block.x + block.w / 2, block.y + block.h / 2);
      }

      if (block.type === "switch") {
        ctx.fillStyle = "rgba(15,23,42,0.65)";
        ctx.font = "bold 13px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("S", block.x + block.w / 2, block.y + block.h / 2);
      }
      ctx.restore();
    }
  }

  drawPaddle(ctx) {
    ctx.save();
    const gradient = ctx.createLinearGradient(this.paddle.x, this.paddle.y, this.paddle.x, this.paddle.y + this.paddle.h);
    gradient.addColorStop(0, "#f8fafc");
    gradient.addColorStop(1, "#9bdcff");
    ctx.fillStyle = gradient;
    roundRect(ctx, this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h, 8);
    ctx.fill();
    ctx.restore();
  }

  drawBall(ctx) {
    ctx.save();
    ctx.shadowColor = "rgba(255,255,255,0.7)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawWarps(ctx) {
    for (const warp of this.stage?.warps ?? []) {
      const disabled = this.ball.warpLocked;
      drawWarp(ctx, warp.in.x, warp.in.y, warp.label, "入口", disabled);
      drawWarp(ctx, warp.out.x, warp.out.y, warp.label, "出口", disabled);
    }
  }

  drawMessage(ctx) {
    if (this.state !== "ready" && this.state !== "paused") return;
    const text = this.state === "paused" ? "一時停止中" : "タップ / クリック / Space で発射";
    ctx.save();
    ctx.fillStyle = "rgba(15,23,42,0.7)";
    roundRect(ctx, 36, 314, 288, 44, 12);
    ctx.fill();
    ctx.fillStyle = "#e5f6ff";
    ctx.font = "bold 14px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, WORLD_WIDTH / 2, 336);
    ctx.restore();
  }

  bindInput() {
    const pointerToWorld = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * WORLD_WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * WORLD_HEIGHT
      };
    };

    const movePaddle = (event) => {
      const point = pointerToWorld(event);
      this.paddle.x = clamp(point.x - this.paddle.w / 2, 0, WORLD_WIDTH - this.paddle.w);
    };

    this.canvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.pointerActive = true;
      this.canvas.setPointerCapture?.(event.pointerId);
      movePaddle(event);
      if (this.state === "ready") this.launchBall();
    });

    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.pointerActive && event.pointerType !== "mouse") return;
      event.preventDefault();
      movePaddle(event);
    });

    this.canvas.addEventListener("pointerup", (event) => {
      this.pointerActive = false;
      this.canvas.releasePointerCapture?.(event.pointerId);
    });

    this.canvas.addEventListener("pointercancel", () => {
      this.pointerActive = false;
    });
  }

  handleKeyDown(event) {
    if (["ArrowLeft", "ArrowRight", " ", "Space", "p", "P"].includes(event.key)) {
      event.preventDefault();
    }
    this.keys.add(event.key);
    if ((event.key === " " || event.key === "Space") && this.state === "ready") {
      this.launchBall();
    }
    if (event.key === "p" || event.key === "P") {
      this.togglePause();
    }
  }

  resizeCanvas() {
    this.canvas.width = WORLD_WIDTH;
    this.canvas.height = WORLD_HEIGHT;
  }
}

function createPlaySettings(settings = {}) {
  const difficulty = settings.difficulty ?? "normal";
  const timeMultiplier = Number.isFinite(settings.timeMultiplier) ? settings.timeMultiplier : 1;
  const paddleMultiplier = Number.isFinite(settings.paddleMultiplier) ? settings.paddleMultiplier : 1;
  const scoreMultiplier = Number.isFinite(settings.scoreMultiplier) ? settings.scoreMultiplier : 1;
  const ballSpeedMultiplier = Number.isFinite(settings.ballSpeedMultiplier) ? clamp(settings.ballSpeedMultiplier, 0.5, 3) : 1;

  return {
    difficulty,
    timeMultiplier,
    paddleMultiplier,
    scoreMultiplier,
    ballSpeedMultiplier: Math.round(ballSpeedMultiplier * 10) / 10
  };
}

function createBlocks(layout) {
  const rows = layout.length;
  const cols = Math.max(...layout.map((row) => row.length));
  const blockWidth = (WORLD_WIDTH - BLOCK_MARGIN * 2 - BLOCK_GAP * (cols - 1)) / cols;
  const blocks = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < layout[row].length; col += 1) {
      const type = layout[row][col];
      if (!type) continue;
      const def = BLOCK_DEFS[type] ?? BLOCK_DEFS.normal;
      blocks.push({
        x: BLOCK_MARGIN + col * (blockWidth + BLOCK_GAP),
        y: BLOCK_TOP + row * (BLOCK_HEIGHT + BLOCK_GAP),
        w: blockWidth,
        h: BLOCK_HEIGHT,
        type,
        hp: def.hp,
        score: def.score,
        color: def.color,
        breakable: def.breakable,
        active: true
      });
    }
  }
  return blocks;
}

function drawBackground(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(1, "#1e293b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  for (let y = 40; y < WORLD_HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_WIDTH, y);
    ctx.stroke();
  }
}

function drawWarp(ctx, x, y, label, caption, disabled = false) {
  ctx.save();
  ctx.globalAlpha = disabled ? 0.35 : 1;
  ctx.strokeStyle = caption === "入口" ? "#f0abfc" : "#7dd3fc";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.font = "bold 11px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}
