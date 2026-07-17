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

## Deployment

Pushes to `main` run CI. After CI succeeds, the deploy workflow synchronizes this repository to `/home/github/flag-quiz` and rebuilds its standalone Compose service. Like expense-tracking, it joins the host's existing `external_network`, where Traefik discovers the service labels. The homelab repository is not modified or invoked.

Add these GitHub Actions secrets before merging to `main`:

- `WIREGUARD_CONF`
- `SSH_HOST`
- `SSH_KNOWN_HOSTS`
- `DEPLOY_SECRET_KEY`
- `FLAG_DOMAIN` (for example `flags.example.com`)

No application secret is required: rooms are anonymous, ephemeral, and held in one server process. A restart clears active games.
