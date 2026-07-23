# Flag Quiz

A server-authoritative, real-time multiplayer flag quiz built with Bun, React,
TypeScript, and WebSockets.

Players create a room, share its five-character code or QR link, and compete on
the same sequence of flags. The host chooses a win condition and difficulty
before starting.

## Features

- Shared questions, countdowns, scores, and skip votes
- First-to-score and timed game modes
- Three flag pools:
  - **Explorer:** 54 familiar country flags
  - **World:** 196 country flags
  - **Expert:** 250 countries and territories
- Tolerant answer matching with aliases, prefixes, accents, and one typo
- English and German quiz interface with localized country answers
- Reconnection by room and player name
- QR join links
- Responsive UI that preserves answer-field focus on mobile
- Pointer-reactive honeycomb background with reduced-motion support
- Container image with a non-root runtime user and health endpoint

Flag artwork is downloaded from [FlagCDN](https://flagcdn.com/), a service by
[Flagpedia](https://flagpedia.net/), and served locally with the application.
Lobby QR codes are generated locally in the browser with `qrcode`; the join URL
and room code are not sent to an external QR service.

## Architecture

```text
Browser / React
   │
   │ same-origin WebSocket at /ws
   ▼
Bun HTTP + WebSocket server
   │
   ├── GameServer: rooms, timers, validation, scores
   ├── shared protocol and configuration
   └── static Vite production bundle
```

The Bun server owns all game state. Clients send commands, never scores or room
state. After a state transition, the server broadcasts a viewer-specific room
snapshot to every player.

Important implementation choices:

- A question code is included with every answer. The server ignores stale
  answers that arrive after another player advanced the question.
- Countdown deadlines are server timestamps. Each state snapshot also includes
  `serverNow`, allowing clients with different local clocks to render the same
  countdown.
- A skip advances only after every connected player has voted.
- Timed mode begins its round timer after the initial countdown.
- Disconnected players remain eligible for reconnection after a game starts.
  Lobby disconnects remove the player immediately.

## Project structure

| Path | Responsibility |
| --- | --- |
| `server/index.ts` | HTTP server, WebSocket upgrade, static files, health check |
| `server/game.ts` | Authoritative room state machine and answer matching |
| `server/game.test.ts` | Game, matching, skip, and difficulty tests |
| `src/App.tsx` | React screens, WebSocket client, timers, and visual effects |
| `src/protocol.ts` | Shared client/server message contracts |
| `src/gameConfig.ts` | Default values and allowed setting ranges |
| `src/flagPools.ts` | Difficulty-to-flag-pool mapping |
| `src/i18n/ui` | Per-language interface dictionaries |
| `src/i18n/countries` | Per-language country and territory answer names |
| `src/i18n/errors` | Localized server error messages |
| `src/res/countryFlags.json` | Canonical English code and alias dataset |
| `public/flags` | Locally served SVGs downloaded from FlagCDN |
| `scripts/fetch-flags.mjs` | Validated, repeatable FlagCDN download script |
| `src/styles.css` | Responsive visual system and component styling |

## Local development

Requires Bun 1.3.14 or newer.

```bash
bun install --frozen-lockfile
bun run dev
```

Open <http://localhost:3000>.

For frontend hot reload, keep the Bun server running and start Vite separately:

```bash
bun run dev:web
```

Open <http://localhost:5173>. Vite proxies are not configured, so normal
multiplayer testing should use the Bun-served application unless a WebSocket
proxy is added locally.

## Quality checks

```bash
bun run check
```

This runs the Bun tests, TypeScript type checking, and the Vite production
build.

## Docker

Build and run a local image:

```bash
docker build --tag flag-quiz:local .
docker run --rm --publish 127.0.0.1:3000:3000 flag-quiz:local
```

Check readiness:

```bash
curl http://127.0.0.1:3000/healthz
```

The endpoint returns the service status and number of in-memory rooms. Room
state is intentionally ephemeral and is lost when the process restarts.

`compose.yaml` expects:

- an existing Docker network named `external_network`
- `FLAG_DOMAIN` for the Traefik host rule
- Traefik middleware and certificate resolver names referenced by its labels

## Game configuration

Edit `src/gameConfig.ts` to change countdown duration, default win conditions,
or host input limits.

Difficulty pools are defined in `src/flagPools.ts`:

- `EXPLORER_CODES` is the curated beginner pool.
- `TERRITORY_CODES` is excluded from World mode.
- Expert mode uses every entry in `countryFlags.json`.

When adding a flag:

1. Add the uppercase code and accepted names to `countryFlags.json`.
2. Classify it in `TERRITORY_CODES` if World mode should exclude it.
3. Refresh and validate the local SVG collection with `npm run flags:update`.
4. Add aliases carefully: answers are accepted only when they identify one
   unique flag.
5. Run `bun run check`.

Refresh all local flags from FlagCDN with:

```bash
npm run flags:update
```

The script requires `curl`, derives its list from `countryFlags.json`, retries
transient downloads, validates HTTP responses and SVG markup, and uses
temporary files to avoid retaining partial downloads.

## Answer matching

Answers are normalized by removing accents, punctuation, whitespace, and case.
English aliases and German country and territory names live in explicit modules
under `src/i18n/countries`. The server searches every configured language, so
players may answer in either language regardless of the selected interface.
Matching is attempted in this order:

1. exact alias
2. alias with at most one character substitution
3. unambiguous alias prefix of at least three characters

If an answer could refer to multiple entries, it is rejected. This prevents
short or shared names from silently selecting the wrong country.

## WebSocket protocol

Messages are JSON and are typed in `src/protocol.ts`.

Client commands:

- `create_room`
- `join_room`
- `start_game`
- `answer`
- `skip`
- `play_again`

Server messages:

- `welcome` assigns the connection's player ID
- `state` contains the current room snapshot
- `answer` reports correct/incorrect feedback to the submitting player
- `error` reports validation or workflow errors

Adding a command requires updating the protocol union, dispatch logic in
`GameServer.handle`, and tests for the resulting state transition.
