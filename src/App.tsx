import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, RoomState, ServerMessage } from "./protocol";

const websocketUrl = () => `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

export default function App() {
  const socket = useRef<WebSocket | null>(null);
  const [connection, setConnection] = useState<"connecting" | "online" | "offline">("connecting");
  const [playerId, setPlayerId] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState("");
  const [answerResult, setAnswerResult] = useState<boolean | null>(null);
  const [seconds, setSeconds] = useState(0);

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
          ? <button className="primary" disabled={room.players.length < 2} onClick={() => send({ type: "start_game" })}>Start the round</button>
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
    <header className="game-header"><div><span className="eyebrow">Room {room.roomCode}</span><strong>{me?.score ?? 0} points</strong></div><div className={seconds <= 5 ? "timer urgent" : "timer"}>{seconds}s</div></header>
    <Scoreboard room={room} playerId={playerId} />
    <div className="flag-card"><span className={`fi fi-${room.question?.toLowerCase()}`} aria-label="Flag to identify" /></div>
    <AnswerForm result={answerResult} onAnswer={(answer) => send({ type: "answer", answer })} />
    <button className="secondary" disabled={!room.skipsLeft} onClick={() => send({ type: "skip" })}>Skip flag · {room.skipsLeft ?? 0} left</button>
    {error && <p className="error" role="alert">{error}</p>}
  </section></Shell>;
}

function Home({ connection, error, send }: { connection: string; error: string; send: (m: ClientMessage) => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(new URLSearchParams(location.search).get("room")?.toUpperCase() ?? "");
  const submit = (event: FormEvent, type: "create" | "join") => { event.preventDefault(); send(type === "create" ? { type: "create_room", name } : { type: "join_room", name, roomCode: code }); };
  return <Shell connection={connection}><section className="hero"><div className="globe">🌎</div><p className="eyebrow">Two players · thirty seconds</p><h1>How well do you<br /><em>know the world?</em></h1><p className="lede">Race a friend to name as many flags as you can.</p></section><section className="card home-card">
    <label>Your name<input value={name} maxLength={24} autoComplete="nickname" onChange={(e) => setName(e.target.value)} placeholder="e.g. Tobias" /></label>
    <form onSubmit={(e) => submit(e, "create")}><button className="primary" disabled={!name.trim() || connection !== "online"}>Create a game</button></form>
    <div className="divider"><span>or join one</span></div>
    <form className="join" onSubmit={(e) => submit(e, "join")}><input aria-label="Room code" value={code} maxLength={5} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="ROOM CODE" /><button className="secondary" disabled={!name.trim() || code.length !== 5 || connection !== "online"}>Join</button></form>
    {connection === "offline" && <p className="error">Connection lost. Refresh to try again.</p>}{error && <p className="error" role="alert">{error}</p>}
  </section></Shell>;
}

function AnswerForm({ result, onAnswer }: { result: boolean | null; onAnswer: (answer: string) => void }) {
  const [answer, setAnswer] = useState("");
  return <form className={`answer ${result === true ? "correct" : result === false ? "wrong" : ""}`} onSubmit={(event) => { event.preventDefault(); if (answer.trim()) { onAnswer(answer); setAnswer(""); } }}><input autoFocus value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type the country…" autoComplete="off" /><button className="primary">Submit</button></form>;
}

function Scoreboard({ room, playerId }: { room: RoomState; playerId: string }) {
  return <div className="scoreboard">{room.players.map((player) => <div className={player.id === playerId ? "score me" : "score"} key={player.id}><span>{player.name}{!player.connected ? " · offline" : ""}</span><strong>{player.score}</strong></div>)}</div>;
}

function Shell({ connection, children }: { connection: string; children: React.ReactNode }) {
  return <main><nav><a href="/" className="brand"><span>🏳️</span> Flag Quiz</a><span className={`status ${connection}`}>{connection}</span></nav><div className="layout">{children}</div><footer>Built for curious minds and competitive friends.</footer></main>;
}
