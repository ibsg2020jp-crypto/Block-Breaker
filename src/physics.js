export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function circleRectCollision(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

export function reflectFromPaddle(ball, paddle) {
  const relative = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
  const clamped = clamp(relative, -1, 1);
  const speed = Math.hypot(ball.vx, ball.vy);
  const angle = clamped * (Math.PI / 3);

  ball.vx = Math.sin(angle) * speed;
  ball.vy = -Math.cos(angle) * speed;
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const min = Math.floor(total / 60);
  const sec = String(total % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

export function formatDecimal(seconds) {
  return `${seconds.toFixed(2)}秒`;
}
