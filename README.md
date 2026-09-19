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


## V0.2 visual/gameplay pass
- Reworked in-match HUD to closely follow the supplied TIDELANDS reference: top resource bar, left player/actions panel, right objective/events panel, bottom city/building bar, and bottom-left chat.
- Reworked the map renderer with richer terrain, coast/water detail, forests, mountains, volcanic area, city landmarks, territory borders, player markers, and building silhouettes.
- Building mode is now explicit: click a building card, then tap/click your own territory to place it.
- Clicking land selects it; unclaimed adjacent land can be claimed for 300 Credits.
- Added visible selected-tile information.
- Added manual private-room join by Room ID.
- Added reconnect token flow so a disconnected player can reattach to the same in-memory match during the reconnect window.
- Added real WebSocket ping/termination heartbeat.
- Server now returns per-player reconnect identity and sends per-player match-start snapshots.
- City Center construction can establish an additional city on owned land.

Note: the project is still an evolving multiplayer prototype; the full diplomacy, logistics, fog-of-war, unit simulation, and victory systems are not yet complete.
