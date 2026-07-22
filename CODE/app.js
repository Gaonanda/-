const CFG = {
  INIT_BALLS: 50, MAX_BALLS: 400,
  MIN_R: 5, MAX_R: 14, SPEED: 2.2,
  TRAIL_ALPHA: 0.12, CONNECT_DIST: 130,
  MOUSE_ATTRACT: 0.018, MOUSE_RADIUS: 180,
  COLORS: [
    '#00ffff','#00ddff','#00bbff','#0099ff',
    '#ff00ff','#ff44dd','#ff66cc','#cc00ff',
    '#00ffaa','#44ffcc','#88ff00','#00ff88',
    '#ff3366','#ff6644','#ffaa00','#ffee00',
    '#66ff00','#00ff66'
  ]
};

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H;
let balls = [];
let paused = false;
let gravityOn = false;
let collisions = 0;
let mx = -9999, my = -9999;
let frameCount = 0, lastFpsTime = performance.now(), fps = 0;

const sCount = document.getElementById('s-count');
const sFps = document.getElementById('s-fps');
const sColl = document.getElementById('s-collisions');
const sMouse = document.getElementById('s-mouse');

function rand(a, b) { return Math.random() * (b - a) + a; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}

class Ball {
  constructor(x, y) {
    this.x = x !== undefined ? x : rand(40, W - 40);
    this.y = y !== undefined ? y : rand(40, H - 40);
    this.r = rand(CFG.MIN_R, CFG.MAX_R);
    this.vx = rand(-CFG.SPEED, CFG.SPEED);
    this.vy = rand(-CFG.SPEED, CFG.SPEED);
    if (Math.abs(this.vx) < 0.5) this.vx = (this.vx >= 0 ? 1 : -1) * rand(1, CFG.SPEED);
    if (Math.abs(this.vy) < 0.5) this.vy = (this.vy >= 0 ? 1 : -1) * rand(1, CFG.SPEED);
    this.color = pick(CFG.COLORS);
    this.mass = this.r * this.r;
  }
  draw() {
    const glow = this.r * 2.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = glow;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.fill();
  }
  update(dt) {
    const dx = mx - this.x, dy = my - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < CFG.MOUSE_RADIUS && dist > 1) {
      const force = CFG.MOUSE_ATTRACT * (1 - dist / CFG.MOUSE_RADIUS);
      this.vx += (dx / dist) * force;
      this.vy += (dy / dist) * force;
    }
    if (gravityOn) this.vy += 0.08 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x - this.r < 0) { this.x = this.r; this.vx = Math.abs(this.vx); }
    if (this.x + this.r > W) { this.x = W - this.r; this.vx = -Math.abs(this.vx); }
    if (this.y - this.r < 0) { this.y = this.r; this.vy = Math.abs(this.vy); }
    if (this.y + this.r > H) { this.y = H - this.r; this.vy = -Math.abs(this.vy); }
    const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const maxSpd = CFG.SPEED * 2.5;
    if (spd > maxSpd) { this.vx *= maxSpd / spd; this.vy *= maxSpd / spd; }
  }
}

function resolveCollisions() {
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], b = balls[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const minD = a.r + b.r;
      if (d2 < minD * minD && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d;
        const overlap = (minD - d) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
        const dvx = a.vx - b.vx, dvy = a.vy - b.vy;
        const dvn = dvx * nx + dvy * ny;
        if (dvn > 0) {
          const totalMass = a.mass + b.mass;
          const impulse = 2 * dvn / totalMass;
          a.vx -= impulse * b.mass * nx;
          a.vy -= impulse * b.mass * ny;
          b.vx += impulse * a.mass * nx;
          b.vy += impulse * a.mass * ny;
          collisions++;
        }
      }
    }
  }
}

function drawConnections() {
  const cd = CFG.CONNECT_DIST;
  const cd2 = cd * cd;
  ctx.lineWidth = 0.6;
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < cd2) {
        const alpha = (1 - Math.sqrt(d2) / cd) * 0.35;
        ctx.strokeStyle = 'rgba(0,200,255,' + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }
}

function init(count) {
  balls = [];
  collisions = 0;
  for (let i = 0; i < count; i++) balls.push(new Ball());
}

function loop(now) {
  requestAnimationFrame(loop);
  if (paused) return;
  const dt = 1;
  ctx.fillStyle = 'rgba(6,6,15,' + CFG.TRAIL_ALPHA + ')';
  ctx.fillRect(0, 0, W, H);
  drawConnections();
  for (let i = 0; i < balls.length; i++) balls[i].update(dt);
  resolveCollisions();
  for (let i = 0; i < balls.length; i++) balls[i].draw();
  frameCount++;
  if (now - lastFpsTime >= 1000) {
    fps = frameCount; frameCount = 0; lastFpsTime = now;
  }
  sCount.textContent = balls.length;
  sFps.textContent = fps;
  sColl.textContent = collisions;
  sMouse.textContent = mx.toFixed(0) + ', ' + my.toFixed(0);
}

window.addEventListener('resize', function() { resize(); });
document.addEventListener('mousemove', function(e) { mx = e.clientX; my = e.clientY; });
document.addEventListener('mouseleave', function() { mx = -9999; my = -9999; });
document.addEventListener('click', function(e) {
  if (e.target.tagName === 'BUTTON') return;
  const count = Math.min(CFG.MAX_BALLS - balls.length, 10);
  for (let i = 0; i < count; i++) {
    balls.push(new Ball(e.clientX + rand(-20, 20), e.clientY + rand(-20, 20)));
  }
});
document.getElementById('btn-pause').addEventListener('click', function() {
  paused = !paused;
  this.textContent = paused ? '\u25b6 \u7ee7\u7eed' : '\u23f8 \u6682\u505c';
});
document.getElementById('btn-reset').addEventListener('click', function() {
  init(CFG.INIT_BALLS);
});
document.getElementById('btn-gravity').addEventListener('click', function() {
  gravityOn = !gravityOn;
  this.textContent = gravityOn ? '\u2b07 \u91cd\u529b:\u5f00' : '\u2b07 \u91cd\u529b:\u5173';
});

resize();
init(CFG.INIT_BALLS);
requestAnimationFrame(loop);
