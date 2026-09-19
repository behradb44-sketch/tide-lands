# TIDELANDS V1

A database-free browser multiplayer strategy prototype designed for Render deployment.

## Run locally
1. `npm install`
2. `npm start`
3. Open `http://localhost:10000`

## Render
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- No database or persistent storage is required.

## Multiplayer architecture
The server is authoritative and keeps rooms/matches in RAM. Clients send intents (move, build, attack, diplomacy, chat); the server validates and broadcasts state changes. WebSocket heartbeat and a short reconnect window prevent ordinary mobile/network drops from creating duplicate players.

## Included
- 10 permanent public rooms
- Create public/private rooms with capacity 2–8
- Shareable room URL / Room ID
- Owner-controlled match start after 2+ players
- Responsive desktop/mobile UI
- Detailed canvas island/sea/mountain/forest/volcano map
- Cities, farms, mines, factories, power plants, ports, airports, radar, air defense, missile silos
- Missile, ground, naval and air attacks
- Alliances and betrayal
- Chat
- WebRTC voice signaling hook (`voice_signal`) ready for client voice implementation
- English / Persian UI toggle
- In-memory reconnect tokens

## V1 visual pass
The supplied TIDELANDS reference image is used as the visual source for the in-game map texture, minimap texture, logo treatment, and building/unit icon crops. The UI is recreated as live HTML/CSS panels over the interactive canvas, so room state, players, movement, building placement, combat, diplomacy, chat, and voice signaling remain functional.

Permanent rooms use a 5-minute waiting window followed by a 3-minute extension; when at least two connected players are present after the extension, the match starts automatically. Private rooms remain hidden from the public list.
