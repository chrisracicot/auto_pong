# Dominance Prototype (Auto Pong)

A mesmerizing, automated territory conquest game where entities compete to "paint" the board in their color.

## Features
- **Three Unique Game Modes**:
  - **Classic**: Original 2-team / 2-ball experience.
  - **Checkerboard**: 4 quadrants for 2 teams, featuring 4 balls and ball-to-ball collisions.
  - **Four Teams**: A 4-way battle (Maroon, Grey, Teal, Gold) with quadrant-based starting zones.
- **Dynamic Physics**: 
  - Balls capture tiles upon impact.
  - Circle-circle collision logic for multi-ball interactions.
  - Subtle random jitter to prevent static bouncing loops.
- **Improved UI**:
  - Side Menu for mode selection.
  - Real-time **Speedometer** display.
  - Adaptive scoring HUD that supports 2 or 4 team configurations.
- **Performance Optimized**: Built with sub-stepping logic (internal) and a hard speed cap for stability.

## Controls
- **Canvas Click**: Toggle Pause/Resume.
- **Space**: Toggle Pause/Resume.
- **R**: Reset the current game mode.
- **"+" / "−" Buttons**: Adjust game speed (scaled per mode).

## Customization
You can adjust the starting speeds and the maximum speed cap at the top of `game.js`:
- `MODE_SPEEDS`: Set default starting velocities for each mode.
- `MAX_SPEED`: The hard ceiling for gameplay stability.

## Tech Stack
- Vanilla JavaScript (ES6+)
- HTML5 Canvas API
- CSS3 (Absolute positioning & Backdrop filters)
