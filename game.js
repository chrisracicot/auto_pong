(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const scoreAEl = document.getElementById("scoreA");
  const scoreBEl = document.getElementById("scoreB");
  const resetBtn = document.getElementById("resetBtn");
  const dotA = document.getElementById("dotA");
  const dotB = document.getElementById("dotB");

  const COLORS = {
    A: "#550f27",
    B: "#ddcfd3",
    ballStroke: "rgba(0,0,0,0.25)",
    overlay: "rgba(0,0,0,0.35)",
    text: "rgba(255,255,255,0.92)",
  };

  const BALL = {
    A: COLORS.B,
    B: COLORS.A,
  };

  dotA.style.background = BALL.A;
  dotB.style.background = BALL.B;

  // Board
  const cellSize = 34;
  const cols = Math.floor(canvas.width / cellSize);
  const rows = Math.floor(canvas.height / cellSize);

  const boardW = cols * cellSize;
  const boardH = rows * cellSize;

  // Ownership: 1 = A, 2 = B
  const grid = new Uint8Array(cols * rows);

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const idx = (x, y) => y * cols + x;

  function setInitialSplit() {
    const mid = Math.floor(cols / 2);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        grid[idx(x, y)] = x < mid ? 1 : 2;
      }
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

  // Balls
  const ballRadius = 12;
  const baseSpeed = 800; // speed up here

  // Jitter applied ONLY on wall bounces
  //const WALL_JITTER = 0.05;
  const WALL_JITTER_A = 0.05;
  const WALL_JITTER_B = 0.08;

  const ballA = {
    owner: 1,
    color: BALL.A,
    x: boardW * 0.25,
    y: boardH * 0.25,
    vx: baseSpeed,
    vy: baseSpeed * 0.55,
    r: ballRadius,
  };

  const ballB = {
    owner: 2,
    color: BALL.B,
    x: boardW * 1,
    y: boardH * 2,
    vx: -baseSpeed * 0.75,
    vy: -baseSpeed * 0.75,
    r: ballRadius,
  };

  function reset() {
    setInitialSplit();

    // Start offsets
    ballA.x = boardW * 0.25 + 1.4;
    ballA.y = boardH * 0.25 - 2.5;
    ballA.vx = baseSpeed;
    ballA.vy = baseSpeed * 0.75;

    ballB.x = boardW * 0.75 - 2.3;
    ballB.y = boardH * 0.75 + 1.2;
    ballB.vx = -baseSpeed;
    ballB.vy = -baseSpeed * 0.55;

    paused = false;
    lastTs = performance.now();
  }

  function jitterAngle(ball, jitterRad) {
    const speed = Math.hypot(ball.vx, ball.vy);
    let angle = Math.atan2(ball.vy, ball.vx);
    angle += (Math.random() - 0.7) * jitterRad;
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
      const jitter = ball.owner === 1 ? WALL_JITTER_A : WALL_JITTER_B;
      jitterAngle(ball, jitter);
    }}

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

  function countScores() {
    let a = 0, b = 0;
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === 1) a++;
      else b++;
    }
    scoreAEl.textContent = String(a);
    scoreBEl.textContent = String(b);
  }

  function drawGrid() {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = grid[idx(x, y)] === 1 ? COLORS.A : COLORS.B;
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
      const nextAx = ballA.x + ballA.vx * dt;
      const nextAy = ballA.y + ballA.vy * dt;
      const nextBx = ballB.x + ballB.vx * dt;
      const nextBy = ballB.y + ballB.vy * dt;

      territoryBounceAndCaptureAccurate(ballA, nextAx, nextAy);
      territoryBounceAndCaptureAccurate(ballB, nextBx, nextBy);

      wallBounce(ballA);
      wallBounce(ballB);

      if (ownerAtPoint(ballA.x, ballA.y) !== ballA.owner) setOwnerAtPoint(ballA.x, ballA.y, ballA.owner);
      if (ownerAtPoint(ballB.x, ballB.y) !== ballB.owner) setOwnerAtPoint(ballB.x, ballB.y, ballB.owner);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawBall(ballA);
    drawBall(ballB);
    countScores();
    if (paused) drawPaused();

    requestAnimationFrame(step);
  }

  reset();
  requestAnimationFrame(step);
})();