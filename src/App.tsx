import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { GAME_CONFIG } from "./gameConfig";
import type { ClientMessage, GameMode, RoomState, ServerMessage } from "./protocol";

const websocketUrl = () => `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
const flagImages = import.meta.glob("../node_modules/svg-country-flags/svg/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
const flagUrl = (code?: string) => code ? flagImages[`../node_modules/svg-country-flags/svg/${code.toLowerCase()}.svg`] : undefined;

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
    const update = () => setCountdown(Math.max(0, Math.ceil((room.countdownUntil! - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [room?.countdownUntil, room?.phase]);

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
        <p className="muted">Share this code with a friend. Tap it to copy.</p>
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
    <header className="game-header"><div><span className="eyebrow">Room {room.roomCode}</span><strong>{me?.score ?? 0} points {room.mode === "first_to" ? `/ ${room.targetScore}` : ""}</strong></div>{room.mode === "timed" && <div className={seconds <= 5 && room.deadline ? "timer urgent" : "timer"}>{room.deadline ? `${seconds}s` : "—"}</div>}</header>
    <Scoreboard room={room} playerId={playerId} />
    <div className="flag-card"><img src={flagUrl(room.question)} alt="Flag to identify" />{countdown > 0 && <div className="countdown" aria-live="assertive"><span>{countdown}</span><small>Get ready</small></div>}</div>
    <AnswerForm disabled={countdown > 0} question={room.question ?? ""} result={answerResult} onAnswer={(answer, final) => send({ type: "answer", answer, question: room.question ?? "", final })} />
    <button className="secondary" disabled={countdown > 0 || room.hasVotedToSkip} onClick={() => send({ type: "skip" })}>
      {room.hasVotedToSkip ? "Waiting for everyone" : "Vote to skip"} · {room.skipVotes ?? 0}/{room.skipVotesRequired ?? room.players.length}
    </button>
    {error && <p className="error" role="alert">{error}</p>}
  </section></Shell>;
}

function GameSettings({ disabled, onStart }: { disabled: boolean; onStart: (settings: { mode: GameMode; targetScore?: number; durationSeconds?: number }) => void }) {
  const [mode, setMode] = useState<GameMode>("first_to");
  const [targetScore, setTargetScore] = useState<number>(GAME_CONFIG.defaultTargetScore);
  const [durationSeconds, setDurationSeconds] = useState<number>(GAME_CONFIG.defaultDurationSeconds);
  return <div className="game-settings"><div className="mode-picker"><button className={mode === "first_to" ? "selected" : ""} onClick={() => setMode("first_to")}>First to</button><button className={mode === "timed" ? "selected" : ""} onClick={() => setMode("timed")}>Time mode</button></div>
    <label>{mode === "first_to" ? "Points to win" : "Seconds"}<input type="number" min={mode === "first_to" ? GAME_CONFIG.minTargetScore : GAME_CONFIG.minDurationSeconds} max={mode === "first_to" ? GAME_CONFIG.maxTargetScore : GAME_CONFIG.maxDurationSeconds} value={mode === "first_to" ? targetScore : durationSeconds} onChange={(e) => mode === "first_to" ? setTargetScore(Number(e.target.value)) : setDurationSeconds(Number(e.target.value))} /></label>
    <button className="primary" disabled={disabled} onClick={() => onStart({ mode, targetScore, durationSeconds })}>Start game</button>
  </div>;
}

function Home({ connection, error, send }: { connection: string; error: string; send: (m: ClientMessage) => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(new URLSearchParams(location.search).get("room")?.toUpperCase() ?? "");
  const submit = (event: FormEvent, type: "create" | "join") => { event.preventDefault(); send(type === "create" ? { type: "create_room", name } : { type: "join_room", name, roomCode: code }); };
  return <Shell connection={connection}><section className="hero"><div className="globe">🌎</div><p className="eyebrow">Multiplayer · thirty seconds</p><h1>How well do you<br /><em>know the world?</em></h1><p className="lede">Race your friends to name as many flags as you can.</p></section><section className="card home-card">
    <label>Your name<input value={name} maxLength={24} autoComplete="nickname" onChange={(e) => setName(e.target.value)} placeholder="e.g. Tobias" /></label>
    <form onSubmit={(e) => submit(e, "create")}><button className="primary" disabled={!name.trim() || connection !== "online"}>Create a game</button></form>
    <div className="divider"><span>or join one</span></div>
    <form className="join" onSubmit={(e) => submit(e, "join")}><input aria-label="Room code" value={code} maxLength={5} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="ROOM CODE" /><button className="secondary" disabled={!name.trim() || code.length !== 5 || connection !== "online"}>Join</button></form>
    {connection === "offline" && <p className="error">Connection lost. Refresh to try again.</p>}{error && <p className="error" role="alert">{error}</p>}
  </section></Shell>;
}

function AnswerForm({ question, result, disabled, onAnswer }: { question: string; result: boolean | null; disabled: boolean; onAnswer: (answer: string, final: boolean) => void }) {
  const [answer, setAnswer] = useState("");
  useEffect(() => setAnswer(""), [question]);
  return <form className={`answer ${result === true ? "correct" : result === false ? "wrong" : ""}`} onSubmit={(event) => { event.preventDefault(); if (!disabled && answer.trim()) onAnswer(answer, true); }}><input autoFocus disabled={disabled} value={answer} onChange={(e) => { const value = e.target.value; setAnswer(value); if (!disabled && value.trim()) onAnswer(value, false); }} placeholder={disabled ? "Get ready…" : "Type the country…"} autoComplete="off" /><button disabled={disabled} className="primary">Submit</button></form>;
}

function Scoreboard({ room, playerId }: { room: RoomState; playerId: string }) {
  return <div className="scoreboard">{room.players.map((player) => <div className={player.id === playerId ? "score me" : "score"} key={player.id}><span>{player.name}{!player.connected ? " · offline" : ""}</span><strong>{player.score}</strong></div>)}</div>;
}

function Shell({ connection, children }: { connection: string; children: React.ReactNode }) {
  return <main><nav><a href="/" className="brand"><span>🏳️</span> Flag Quiz</a><span className={`status ${connection}`}>{connection}</span></nav><div className="layout">{children}</div><footer>Built for curious minds and competitive friends.</footer></main>;
}
