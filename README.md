# Flag Quiz

A real-time multiplayer flag race. One player creates a five-character room code, friends join, and everyone has 30 seconds to identify as many shared flags as possible.

The Bun server owns rooms, timers, answer validation, scores, and winners. The React client communicates over a same-origin WebSocket at `/ws`; there is no third-party PeerJS server or client-trusted game state.

## Develop

Requires Bun 1.3.14 or newer.

```bash
bun install
bun run build
bun run dev
```

Open <http://localhost:3000>. For frontend hot reload, run `bun run dev:web` in a second terminal and open <http://localhost:5173>.

Run all checks with:

```bash
bun run check
docker build -t flag-quiz .
```
