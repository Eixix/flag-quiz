import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { GAME_CONFIG } from "./gameConfig";
import type { ClientMessage, Difficulty, GameMode, RoomState, ServerMessage } from "./protocol";

const websocketUrl = () => `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
const flagImages = import.meta.glob("../node_modules/flag-icons/flags/4x3/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
const flagUrl = (code?: string) => code ? flagImages[`../node_modules/flag-icons/flags/4x3/${code.toLowerCase()}.svg`] : undefined;

export default function App() {
  const socket = useRef<WebSocket | null>(null);
  const [connection, setConnection] = useState<"connecting" | "online" | "offline">("connecting");
  const [playerId, setPlayerId] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState("");
  const [answerResult, setAnswerResult] = useState<boolean | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const ws = new WebSocket(websocketUrl());
    socket.current = ws;
    ws.onopen = () => setConnection("online");
    ws.onclose = () => setConnection("offline");
    ws.onerror = () => setConnection("offline");
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      if (message.type === "welcome") setPlayerId(message.playerId);
      if (message.type === "state") { setRoom(message); setError(""); }
      if (message.type === "error") setError(message.message);
      if (message.type === "answer") {
        setAnswerResult(message.correct);
        window.setTimeout(() => setAnswerResult(null), 600);
      }
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    if (!room?.deadline || room.phase !== "playing") return;
    const update = () => setSeconds(Math.max(0, Math.ceil((room.deadline! - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [room?.deadline, room?.phase]);

  useEffect(() => {
    if (!room?.countdownUntil || room.phase !== "playing") { setCountdown(0); return; }
    const clockOffset = Date.now() - (room.serverNow ?? Date.now());
    const update = () => {
      const estimatedServerNow = Date.now() - clockOffset;
      setCountdown(Math.max(0, Math.ceil((room.countdownUntil! - estimatedServerNow) / 1000)));
    };
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [room?.countdownUntil, room?.phase, room?.serverNow]);

  const send = useCallback((message: ClientMessage) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(message));
  }, []);

  if (!room) return <Home connection={connection} error={error} send={send} />;

  const me = room.players.find((player) => player.id === playerId);
  if (room.phase === "lobby") return (
    <Shell connection={connection}>
      <section className="card lobby">
        <p className="eyebrow">Your game code</p>
        <button className="room-code" onClick={() => navigator.clipboard.writeText(room.roomCode)}>{room.roomCode}</button>
        <p className="muted">Share this code or let a friend scan the QR code.</p>
        <RoomQrCode roomCode={room.roomCode} />
        <div className="players">{room.players.map((player) => <span key={player.id}>🌍 {player.name}</span>)}</div>
        {room.ownerId === playerId
          ? <GameSettings disabled={room.players.length < 2} onStart={(settings) => send({ type: "start_game", ...settings })} />
          : <p className="waiting">Waiting for the host to start…</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>
    </Shell>
  );

  if (room.phase === "finished") {
    const won = room.winnerIds?.includes(playerId);
    return <Shell connection={connection}><section className="card result">
      <div className="result-emoji">{won ? "🏆" : "🗺️"}</div>
      <p className="eyebrow">Round complete</p>
      <h1>{won ? "You won!" : "Good game!"}</h1>
      <Scoreboard room={room} playerId={playerId} />
      {room.ownerId === playerId ? <button className="primary" onClick={() => send({ type: "play_again" })}>Play again</button> : <p className="waiting">Waiting for the host…</p>}
    </section></Shell>;
  }

  return <Shell connection={connection}><section className="game">
    <header className="game-header"><div><span className="eyebrow">Room {room.roomCode} / {room.difficulty ?? "world"}</span><strong>{me?.score ?? 0} points {room.mode === "first_to" ? `/ ${room.targetScore}` : ""}</strong></div>{room.mode === "timed" && <div className={seconds <= 5 && room.deadline ? "timer urgent" : "timer"}>{room.deadline ? `${seconds}s` : "—"}</div>}</header>
    <Scoreboard room={room} playerId={playerId} />
    <div className="flag-card"><img src={flagUrl(room.question)} alt="Flag to identify" />{countdown > 0 && <div className="countdown" aria-live="assertive"><span>{countdown}</span><small>Get ready</small></div>}</div>
    <AnswerForm disabled={countdown > 0} question={room.question ?? ""} result={answerResult} onAnswer={(answer, final) => send({ type: "answer", answer, question: room.question ?? "", final })} />
    <button className="secondary" disabled={countdown > 0 || room.hasVotedToSkip} onClick={() => send({ type: "skip" })}>
      {room.hasVotedToSkip ? "Waiting for everyone" : "Vote to skip"} · {room.skipVotes ?? 0}/{room.skipVotesRequired ?? room.players.length}
    </button>
    {error && <p className="error" role="alert">{error}</p>}
  </section></Shell>;
}

function RoomQrCode({ roomCode }: { roomCode: string }) {
  const joinUrl = `${location.origin}${location.pathname}?room=${encodeURIComponent(roomCode)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&qzone=4&data=${encodeURIComponent(joinUrl)}`;
  return <div className="room-qr">
    <img src={qrUrl} width="180" height="180" alt={`QR code to join room ${roomCode}`} />
    <button className="secondary" onClick={() => navigator.clipboard.writeText(joinUrl)}>Copy join link</button>
  </div>;
}

function GameSettings({ disabled, onStart }: { disabled: boolean; onStart: (settings: { mode: GameMode; difficulty: Difficulty; targetScore?: number; durationSeconds?: number }) => void }) {
  const [mode, setMode] = useState<GameMode>("first_to");
  const [difficulty, setDifficulty] = useState<Difficulty>("world");
  const [targetScore, setTargetScore] = useState<number>(GAME_CONFIG.defaultTargetScore);
  const [durationSeconds, setDurationSeconds] = useState<number>(GAME_CONFIG.defaultDurationSeconds);
  const difficultyCopy: Record<Difficulty, string> = {
    explorer: "54 familiar flags",
    world: "196 countries",
    expert: "250 countries & territories",
  };
  return <div className="game-settings">
    <div className="difficulty-picker" aria-label="Difficulty">
      {(["explorer", "world", "expert"] as Difficulty[]).map((level) => <button key={level} className={difficulty === level ? "selected" : ""} onClick={() => setDifficulty(level)}>{level}</button>)}
    </div>
    <p className="setting-hint">{difficultyCopy[difficulty]}</p>
    <div className="mode-picker"><button className={mode === "first_to" ? "selected" : ""} onClick={() => setMode("first_to")}>First to</button><button className={mode === "timed" ? "selected" : ""} onClick={() => setMode("timed")}>Time mode</button></div>
    <label>{mode === "first_to" ? "Points to win" : "Seconds"}<input type="number" min={mode === "first_to" ? GAME_CONFIG.minTargetScore : GAME_CONFIG.minDurationSeconds} max={mode === "first_to" ? GAME_CONFIG.maxTargetScore : GAME_CONFIG.maxDurationSeconds} value={mode === "first_to" ? targetScore : durationSeconds} onChange={(e) => mode === "first_to" ? setTargetScore(Number(e.target.value)) : setDurationSeconds(Number(e.target.value))} /></label>
    <button className="primary" disabled={disabled} onClick={() => onStart({ mode, difficulty, targetScore, durationSeconds })}>Start game</button>
  </div>;
}

function Home({ connection, error, send }: { connection: string; error: string; send: (m: ClientMessage) => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(new URLSearchParams(location.search).get("room")?.toUpperCase() ?? "");
  const submit = (event: FormEvent, type: "create" | "join") => { event.preventDefault(); send(type === "create" ? { type: "create_room", name } : { type: "join_room", name, roomCode: code }); };
  return <Shell connection={connection}><section className="hero"><div className="globe">🌎</div><p className="eyebrow">Multiplayer / live session</p><h1>How well do you<br /><em>know the world?</em></h1><p className="lede">Race your friends through the world’s flags. One shared question, one synchronized countdown.</p></section><section className="card home-card">
    <label>Your name<input value={name} maxLength={24} autoComplete="nickname" onChange={(e) => setName(e.target.value)} placeholder="e.g. Tobias" /></label>
    <form onSubmit={(e) => submit(e, "create")}><button className="primary" disabled={!name.trim() || connection !== "online"}>Create a game</button></form>
    <div className="divider"><span>or join one</span></div>
    <form className="join" onSubmit={(e) => submit(e, "join")}><input aria-label="Room code" value={code} maxLength={5} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="ROOM CODE" /><button className="secondary" disabled={!name.trim() || code.length !== 5 || connection !== "online"}>Join</button></form>
    {connection === "offline" && <p className="error">Connection lost. Refresh to try again.</p>}{error && <p className="error" role="alert">{error}</p>}
  </section></Shell>;
}

function AnswerForm({ question, result, disabled, onAnswer }: { question: string; result: boolean | null; disabled: boolean; onAnswer: (answer: string, final: boolean) => void }) {
  const [answer, setAnswer] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setAnswer("");
    input.current?.focus({ preventScroll: true });
  }, [question]);
  return <form className={`answer ${result === true ? "correct" : result === false ? "wrong" : ""}`} onSubmit={(event) => { event.preventDefault(); if (!disabled && answer.trim()) onAnswer(answer, true); }}>
    <input ref={input} autoFocus aria-disabled={disabled} value={answer} onChange={(e) => { const value = e.target.value; setAnswer(value); if (!disabled && value.trim()) onAnswer(value, false); }} placeholder={disabled ? "Get ready…" : "Type the country…"} autoComplete="off" />
    <button disabled={disabled} className="primary">Submit</button>
  </form>;
}

function Scoreboard({ room, playerId }: { room: RoomState; playerId: string }) {
  return <div className="scoreboard">{room.players.map((player) => <div className={player.id === playerId ? "score me" : "score"} key={player.id}><span>{player.name}{!player.connected ? " · offline" : ""}</span><strong>{player.score}</strong></div>)}</div>;
}

type TraceNode = { key: string; x: number; y: number; links: TraceNode[] };
type TraceWalker = { from: TraceNode; to: TraceNode; progress: number; speed: number; length: number; alpha: number };

function HoneycombBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(hover: none), (pointer: coarse)").matches;
    if (!canvas || !context || reducedMotion || coarsePointer) return;

    let nodes: TraceNode[] = [];
    let walkers: TraceWalker[] = [];
    let animationFrame = 0;
    let pointerFrame = 0;
    let previousTime = performance.now();

    const createWalker = (): TraceWalker => {
      const from = nodes[Math.floor(Math.random() * nodes.length)];
      const to = from.links[Math.floor(Math.random() * from.links.length)];
      return { from, to, progress: Math.random(), speed: 24 + Math.random() * 34, length: .12 + Math.random() * .2, alpha: .35 + Math.random() * .65 };
    };

    const buildGraph = () => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * pixelRatio);
      canvas.height = Math.round(window.innerHeight * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const graphNodes = new Map<string, TraceNode>();
      const edges = new Set<string>();
      const addNode = (x: number, y: number) => {
        const key = `${Math.round(x)},${Math.round(y)}`;
        if (!graphNodes.has(key)) graphNodes.set(key, { key, x, y, links: [] });
        return graphNodes.get(key)!;
      };
      const connect = (first: TraceNode, second: TraceNode) => {
        const edgeKey = [first.key, second.key].sort().join("|");
        if (edges.has(edgeKey)) return;
        edges.add(edgeKey);
        first.links.push(second);
        second.links.push(first);
      };

      for (let row = -2; row <= Math.ceil(window.innerHeight / 78) + 2; row += 1) {
        const centerY = 52 + row * 78;
        const offsetX = row % 2 === 0 ? 45 : 0;
        for (let centerX = offsetX - 180; centerX <= window.innerWidth + 180; centerX += 90) {
          const points = [
            [centerX, centerY - 52], [centerX + 45, centerY - 26],
            [centerX + 45, centerY + 26], [centerX, centerY + 52],
            [centerX - 45, centerY + 26], [centerX - 45, centerY - 26],
          ].map(([x, y]) => addNode(x, y));
          points.forEach((point, index) => connect(point, points[(index + 1) % points.length]));
        }
      }

      nodes = [...graphNodes.values()].filter((node) => node.links.length > 1);
      const walkerCount = Math.max(32, Math.round(window.innerWidth * window.innerHeight / 26000));
      walkers = Array.from({ length: walkerCount }, createWalker);
    };

    const chooseNextNode = (walker: TraceWalker) => {
      const arrived = walker.to;
      let choices = arrived.links.filter((node) => node !== walker.from);
      if (!choices.length || Math.random() < .08) choices = arrived.links;
      walker.from = arrived;
      walker.to = choices[Math.floor(Math.random() * choices.length)];
      walker.progress = 0;
      walker.speed = Math.max(20, Math.min(62, walker.speed + (Math.random() - .5) * 8));
    };

    const animate = (time: number) => {
      const elapsed = Math.min((time - previousTime) / 1000, .05);
      previousTime = time;
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      context.lineCap = "round";

      walkers.forEach((walker) => {
        const edgeLength = Math.hypot(walker.to.x - walker.from.x, walker.to.y - walker.from.y);
        walker.progress += (walker.speed * elapsed) / edgeLength;
        if (walker.progress >= 1) chooseNextNode(walker);
        const head = Math.min(walker.progress, 1);
        const tail = Math.max(0, head - walker.length);
        context.beginPath();
        context.moveTo(walker.from.x + (walker.to.x - walker.from.x) * tail, walker.from.y + (walker.to.y - walker.from.y) * tail);
        context.lineTo(walker.from.x + (walker.to.x - walker.from.x) * head, walker.from.y + (walker.to.y - walker.from.y) * head);
        context.strokeStyle = `rgba(207, 255, 70, ${walker.alpha})`;
        context.lineWidth = 1.4 + walker.alpha;
        context.shadowColor = "rgba(207, 255, 70, .9)";
        context.shadowBlur = 7;
        context.stroke();
      });
      animationFrame = requestAnimationFrame(animate);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      cancelAnimationFrame(pointerFrame);
      pointerFrame = requestAnimationFrame(() => {
        const overContent = document.elementFromPoint(event.clientX, event.clientY)?.closest(".hero, .card, .game, nav, footer");
        document.documentElement.style.setProperty("--mouse-x", `${event.clientX}px`);
        document.documentElement.style.setProperty("--mouse-y", `${event.clientY}px`);
        document.documentElement.style.setProperty("--honeycomb-opacity", "1");
        document.documentElement.style.setProperty("--honeycomb-strength", overContent ? ".18" : ".52");
        document.documentElement.style.setProperty("--trace-strength", overContent ? ".25" : ".78");
      });
    };
    const hideHoneycomb = () => document.documentElement.style.setProperty("--honeycomb-opacity", "0");

    buildGraph();
    animationFrame = requestAnimationFrame(animate);
    window.addEventListener("resize", buildGraph);
    document.addEventListener("pointermove", handlePointerMove);
    document.documentElement.addEventListener("mouseleave", hideHoneycomb);
    return () => {
      cancelAnimationFrame(animationFrame);
      cancelAnimationFrame(pointerFrame);
      window.removeEventListener("resize", buildGraph);
      document.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("mouseleave", hideHoneycomb);
    };
  }, []);

  return <canvas ref={canvasRef} className="honeycomb-traces" aria-hidden="true" />;
}

function Shell({ connection, children }: { connection: string; children: React.ReactNode }) {
  return <main><HoneycombBackground /><nav><a href="/" className="brand"><span>FQ</span> Flag Quiz</a><span className={`status ${connection}`}>{connection}</span></nav><div className="layout">{children}</div><footer>Built for curious minds · Hexagons are bestagons.</footer></main>;
}
