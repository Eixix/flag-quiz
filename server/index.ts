import { join } from "node:path";
import { GameServer } from "./game";
import type { ClientMessage } from "../src/protocol";

type SocketData = { playerId: string };
const game = new GameServer();
const dist = join(import.meta.dir, "../dist");
const port = Number(Bun.env.PORT ?? 3000);

/**
 * One Bun process serves the production frontend and the authoritative
 * WebSocket endpoint. Keeping both same-origin avoids separate CORS and
 * WebSocket routing configuration.
 */
const server = Bun.serve<SocketData>({
  port,
  async fetch(request, server) {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") return Response.json({ status: "ok", rooms: game.rooms.size });
    if (url.pathname === "/ws") {
      const playerId = crypto.randomUUID();
      return server.upgrade(request, { data: { playerId } }) ? undefined : new Response("WebSocket upgrade failed", { status: 400 });
    }
    // Unknown paths fall back to index.html for client-side navigation.
    const relativePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    let file = Bun.file(join(dist, relativePath));
    if (!(await file.exists())) file = Bun.file(join(dist, "index.html"));
    if (!(await file.exists())) return new Response("Run `bun run build` before starting the production server.", { status: 503 });
    return new Response(file);
  },
  websocket: {
    open(ws) { ws.send(JSON.stringify({ type: "welcome", playerId: ws.data.playerId })); },
    message(ws, raw) {
      try { game.handle(ws.data.playerId, ws, JSON.parse(String(raw)) as ClientMessage); }
      catch { ws.send(JSON.stringify({ type: "error", message: "Invalid message." })); }
    },
    close(ws) { game.disconnect(ws.data.playerId); },
  },
});

console.log(`Flag Quiz listening on http://0.0.0.0:${server.port}`);
