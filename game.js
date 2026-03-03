(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const scoreContainer = document.getElementById("scoreContainer");
  const modeMenu = document.getElementById("modeMenu");
  const resetBtn = document.getElementById("resetBtn");
  const speedUpBtn = document.getElementById("speedUp");
  const speedDownBtn = document.getElementById("speedDown");
  const speedometer = document.getElementById("speedometer");

  const COLORS = {
    1: "#550f27", // A - Maroon
    2: "#ddcfd3", // B - Grey
    3: "#1a5e63", // C - Teal
    4: "#c9a227", // D - Gold
    ballStroke: "rgba(0,0,0,0.25)",
    overlay: "rgba(0,0,0,0.35)",
    text: "rgba(255,255,255,0.92)",
  };

  const ballColors = {
    1: COLORS[2],
    2: COLORS[1],
    3: COLORS[4],
    4: COLORS[3]
  };

  // Board
  const cellSize = 34;
  const cols = Math.floor(canvas.width / cellSize);
  const rows = Math.floor(canvas.height / cellSize);

  const boardW = cols * cellSize;
  const boardH = rows * cellSize;

  // Ownership
  const grid = new Uint8Array(cols * rows);
  let activeMode = 1;
  let balls = [];

  // Starting speeds for each mode
  const MODE_SPEEDS = {
    1: 800,
    2: 700,
    3: 600
  };

  const MAX_SPEED = 1800; // Hard cap to prevent high-speed tunneling and purple bugs

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const idx = (x, y) => y * cols + x;

  function setInitialSplit() {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let owner = 1;
        if (activeMode === 1) {
          owner = x < Math.floor(cols / 2) ? 1 : 2;
        } else if (activeMode === 2) {
          // Checkerboard 4 quadrants for 2 teams
          const midX = Math.floor(cols / 2);
          const midY = Math.floor(rows / 2);
          if (x < midX) {
            owner = y < midY ? 1 : 2;
          } else {
            owner = y < midY ? 2 : 1;
          }
        } else if (activeMode === 3) {
          // 4 quadrants for 4 teams - right side switched
          const midX = Math.floor(cols / 2);
          const midY = Math.floor(rows / 2);
          if (x < midX) {
            owner = y < midY ? 1 : 3;
          } else {
            owner = y < midY ? 4 : 2; // Switched 2 and 4
          }
        }
        grid[idx(x, y)] = owner;
      }
    }
  }

  function createBall(owner, x, y, vx, vy) {
    return {
      owner,
      color: ballColors[owner] || COLORS[1],
      x,
      y,
      vx,
      vy,
      r: 12
    };
  }

  function spawnBalls() {
    balls = [];
    const speed = MODE_SPEEDS[activeMode];

    if (activeMode === 1) {
      balls.push(createBall(1, boardW * 0.25 + 1, boardH * 0.25 - 2, speed, speed * 0.75));
      balls.push(createBall(2, boardW * 0.75 - 2, boardH * 0.75 + 1, -speed, -speed * 0.55));
    } else if (activeMode === 2) {
      // 2 teams, 4 balls (1 in each quadrant)
      balls.push(createBall(1, boardW * 0.25, boardH * 0.25, speed, speed * 0.5));
      balls.push(createBall(2, boardW * 0.75, boardH * 0.25, -speed, speed * 0.5));
      balls.push(createBall(2, boardW * 0.25, boardH * 0.75, speed, -speed * 0.5));
      balls.push(createBall(1, boardW * 0.75, boardH * 0.75, -speed, -speed * 0.5));
    } else if (activeMode === 3) {
      // 4 teams, 4 balls - switched position/owner on right side
      balls.push(createBall(1, boardW * 0.25, boardH * 0.25, speed, speed * 0.6));
      balls.push(createBall(4, boardW * 0.75, boardH * 0.25, -speed, speed * 0.6));
      balls.push(createBall(3, boardW * 0.25, boardH * 0.75, speed, -speed * 0.6));
      balls.push(createBall(2, boardW * 0.75, boardH * 0.75, -speed, -speed * 0.6));
    }
  }

  function reset() {
    setInitialSplit();
    spawnBalls();
    updateHUD();
    updateSpeedometer();
    paused = false;
    lastTs = performance.now();
  }

  function updateSpeedometer() {
    if (speedometer) {
      speedometer.textContent = `Speed: ${Math.round(MODE_SPEEDS[activeMode])}`;
    }
  }

  function ownerAtCell(cx, cy) {
    return grid[idx(cx, cy)];
  }

  function ownerAtPoint(px, py) {
    const cx = clamp(Math.floor(px / cellSize), 0, cols - 1);
    const cy = clamp(Math.floor(py / cellSize), 0, rows - 1);
    return ownerAtCell(cx, cy);
  }

  function setOwnerAtPoint(px, py, owner) {
    const cx = clamp(Math.floor(px / cellSize), 0, cols - 1);
    const cy = clamp(Math.floor(py / cellSize), 0, rows - 1);
    grid[idx(cx, cy)] = owner;
  }

  function updateHUD() {
    scoreContainer.innerHTML = "";
    const teams = activeMode === 3 ? [1, 2, 3, 4] : [1, 2];
    teams.forEach(id => {
      const item = document.createElement("div");
      item.className = "score-item";
      item.innerHTML = `<span><span class="dot" style="background:${ballColors[id]}"></span> Team ${String.fromCharCode(64 + id)}: <span id="score${id}">0</span></span>`;
      scoreContainer.appendChild(item);
    });
  }

  // Handle Mode Selection
  modeMenu.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.mode) return;

    // Update UI
    modeMenu.querySelectorAll(".btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    // Set Mode
    activeMode = parseInt(btn.dataset.mode);
    reset();
  });

  // Handle Speed Controls
  speedUpBtn.addEventListener("click", () => {
    if (MODE_SPEEDS[activeMode] >= MAX_SPEED) return;

    MODE_SPEEDS[activeMode] = Math.min(MODE_SPEEDS[activeMode] * 1.25, MAX_SPEED);

    balls.forEach(b => {
      const angle = Math.atan2(b.vy, b.vx);
      b.vx = Math.cos(angle) * MODE_SPEEDS[activeMode];
      b.vy = Math.sin(angle) * MODE_SPEEDS[activeMode];
    });
    updateSpeedometer();
  });

  speedDownBtn.addEventListener("click", () => {
    MODE_SPEEDS[activeMode] *= 0.8;
    balls.forEach(b => {
      b.vx *= 0.8;
      b.vy *= 0.8;
    });
    updateSpeedometer();
  });

  function jitterAngle(ball, jitterRad) {
    const speed = Math.hypot(ball.vx, ball.vy);
    let angle = Math.atan2(ball.vy, ball.vx);
    angle += (Math.random() - 0.5) * jitterRad; // centered jitter
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
  }

  // Canvas edge bounce + jitter on bounce
  function wallBounce(ball) {
    let bounced = false;
    if (ball.x - ball.r < 0) {
      ball.x = ball.r;
      ball.vx *= -1;
      bounced = true;
    }
    if (ball.x + ball.r > boardW) {
      ball.x = boardW - ball.r;
      ball.vx *= -1;
      bounced = true;
    }
    if (ball.y - ball.r < 0) {
      ball.y = ball.r;
      ball.vy *= -1;
      bounced = true;
    }
    if (ball.y + ball.r > boardH) {
      ball.y = boardH - ball.r;
      ball.vy *= -1;
      bounced = true;
    }

    if (bounced) {
      jitterAngle(ball, 0.08);
    }
  }

  // Circle-rect overlap test
  function circleIntersectsRect(cx, cy, r, rx, ry, rw, rh) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) < (r * r);
  }

  /**
   * Accurate tile collision:
   * - Check tiles overlapping the circle's bounding box at next position.
   * - If circle overlaps an opponent tile: capture ONE tile (single-cell capture),
   *   bounce on the axis with the smaller penetration, and do not move into it this frame.
   */
  function territoryBounceAndCaptureAccurate(ball, nextX, nextY) {
    const r = ball.r;

    // Compute tile range overlapped by circle bounding box
    const minCx = clamp(Math.floor((nextX - r) / cellSize), 0, cols - 1);
    const maxCx = clamp(Math.floor((nextX + r) / cellSize), 0, cols - 1);
    const minCy = clamp(Math.floor((nextY - r) / cellSize), 0, rows - 1);
    const maxCy = clamp(Math.floor((nextY + r) / cellSize), 0, rows - 1);

    let hit = null;

    // Find ONE opponent tile that truly intersects the circle.
    // Choose the one with the deepest overlap (most "responsible" hit).
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const tileOwner = ownerAtCell(cx, cy);
        if (tileOwner === ball.owner) continue;

        const rx = cx * cellSize;
        const ry = cy * cellSize;

        if (!circleIntersectsRect(nextX, nextY, r, rx, ry, cellSize, cellSize)) continue;

        // Compute penetration estimate using rect center method
        const rectCx = rx + cellSize / 2;
        const rectCy = ry + cellSize / 2;
        const dx = nextX - rectCx;
        const dy = nextY - rectCy;

        const px = (cellSize / 2 + r) - Math.abs(dx);
        const py = (cellSize / 2 + r) - Math.abs(dy);

        const depth = Math.min(px, py);

        if (!hit || depth > hit.depth) {
          hit = { cx, cy, px, py, depth };
        }
      }
    }

    if (!hit) {
      // No collision: commit move
      ball.x = nextX;
      ball.y = nextY;
      return;
    }

    // Collision: capture that one tile
    grid[idx(hit.cx, hit.cy)] = ball.owner;

    // Bounce on axis with smaller penetration
    if (hit.px < hit.py) {
      ball.vx *= -1;
    } else {
      ball.vy *= -1;
    }

    // Do not move into the tile this frame (prevents clipping / tunneling)
  }

  function checkBallCollisions() {
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const b1 = balls[i];
        const b2 = balls[j];
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const distSq = dx * dx + dy * dy;
        const minGap = b1.r + b2.r;

        if (distSq < minGap * minGap) {
          // Collision detected
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const ny = dy / dist;

          // Resolve overlap
          const overlap = minGap - dist;
          b1.x -= nx * overlap / 2;
          b1.y -= ny * overlap / 2;
          b2.x += nx * overlap / 2;
          b2.y += ny * overlap / 2;

          // Simple elastic bounce (equal mass)
          const v1n = b1.vx * nx + b1.vy * ny;
          const v2n = b2.vx * nx + b2.vy * ny;

          if (v1n - v2n > 0) {
            const impulse = v1n - v2n;
            b1.vx -= impulse * nx;
            b1.vy -= impulse * ny;
            b2.vx += impulse * nx;
            b2.vy += impulse * ny;
          }
        }
      }
    }
  }

  function countScores() {
    const scores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (let i = 0; i < grid.length; i++) {
      scores[grid[i]]++;
    }

    const teams = activeMode === 3 ? [1, 2, 3, 4] : [1, 2];
    teams.forEach(id => {
      const el = document.getElementById(`score${id}`);
      if (el) el.textContent = String(scores[id]);
    });
  }

  function drawGrid() {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = COLORS[grid[idx(x, y)]];
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }

  function drawBall(ball) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = ball.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.ballStroke;
    ctx.stroke();
  }

  function drawPaused() {
    ctx.fillStyle = COLORS.overlay;
    ctx.fillRect(0, 0, boardW, boardH);
    ctx.fillStyle = COLORS.text;
    ctx.font = "700 20px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.fillText("Paused", boardW / 2, boardH / 2);
  }

  // Controls
  let paused = false;

  canvas.addEventListener("click", () => {
    paused = !paused;
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      paused = !paused;
    }
    if (e.key.toLowerCase() === "r") reset();
  });
  resetBtn.addEventListener("click", reset);

  // Loop
  let lastTs = performance.now();

  function step(ts) {
    const dt = Math.min(0.03, (ts - lastTs) / 1000);
    lastTs = ts;

    if (!paused) {
      balls.forEach(ball => {
        const nextX = ball.x + ball.vx * dt;
        const nextY = ball.y + ball.vy * dt;

        territoryBounceAndCaptureAccurate(ball, nextX, nextY);
        wallBounce(ball);

        if (ownerAtPoint(ball.x, ball.y) !== ball.owner) {
          setOwnerAtPoint(ball.x, ball.y, ball.owner);
        }
      });

      checkBallCollisions();
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    balls.forEach(drawBall);
    countScores();
    if (paused) drawPaused();

    requestAnimationFrame(step);
  }

  reset();
  requestAnimationFrame(step);
})();