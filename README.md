# TIDELANDS
A session-based 2D multiplayer strategy game prototype with a server-authoritative WebSocket core.

## Run
```bash
npm install
npm start
```
Open `http://localhost:3000` in two browser tabs and create/join a room.

## Render
Create one Web Service from this repository. Build command: `npm install`. Start command: `npm start`. No database or persistent match storage is required.

## Architecture
- Browser client + lightweight interactive top-down renderer
- Phaser dependency included for scene/game-system expansion
- Node/Express + WebSocket server
- Authoritative in-memory rooms and matches
- Heartbeat, reconnect, room capacity validation, action validation, chat rate limiting
- Seeded procedural map
- Economy, buildings, territory claiming, objective progress, diplomacy-ready data model
- English/Persian UI toggle

## Test
`npm test` runs dependency-free core simulation tests.
