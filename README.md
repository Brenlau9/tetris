# Tetris

A personal Tetris project built for fun and experimentation, with a focus on game logic, input handling, and exploring how AI tools can assist in modern software development.

This project is not intended to be a perfect or fully polished Tetris clone. Instead, it serves as a hands-on learning project to design and iteratively improve a real-time game system from scratch.


## Motivation

The goal of this project is twofold:

1. **Explore game system design**  
   - Game loop and timing
   - Board state management
   - Piece movement, rotation, and locking
   - Line clearing and gravity

2. **Evaluate AI-assisted development**  
   AI tools were used as a coding assistant to speed up implementation and suggest approaches, while all architectural decisions, feature design, and debugging were done manually.  
   The project intentionally keeps logic explicit and readable to better understand how AI fits into real-world development workflows.


## Features

- Classic Tetris gameplay
- Configurable board with hidden spawn rows
- Real-time piece movement and gravity
- **DAS / ARR support** for continuous horizontal movement
- Soft drop and hard drop mechanics
- Piece rotation and collision handling
- Modular input management system
- Expandable settings system for control customization


## Tech Stack

- **Language:** TypeScript
- **Rendering:** HTML Canvas
- **Architecture:** Modular game engine + screen-based UI
- **Tooling:** Vite


## Controls (Default)

| Action        | Key |
|--------------|-----|
| Move Left    | ←   |
| Move Right   | →   |
| Rotate       | ↑   |
| Soft Drop    | ↓   |
| Hard Drop    | Space |

> DAS, ARR, and soft drop speed are configurable in the settings menu.


## Project Structure
```
├── src/ # All TypeScript source code for game logic
│ ├── ….ts # (various modules for engine, input, rendering, UI, etc.)
│ └── …
├── index.html # Entry point for the web app
├── package.json # Node project config & dependencies
├── package-lock.json # Lockfile for exact dependency versions
├── tsconfig.json # TypeScript compiler configuration
├── .gitignore # Files/folders ignored by git
├── README.md # Project documentation (this file)
└── (other build/dev config files)
```

---

## Running the Project

```bash
npm install
npm run dev
