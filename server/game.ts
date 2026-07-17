import flags from "../src/res/countryFlags.json";
import type { ClientMessage, Player, RoomState } from "../src/protocol";

export const ROUND_SECONDS = 30;
export const MAX_PLAYERS = 2;
const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type SocketLike = { send(data: string): void };
type InternalPlayer = Player & { socket: SocketLike; question?: string; remaining: string[]; skipsLeft: number };
export type Room = { code: string; ownerId: string; phase: RoomState["phase"]; players: Map<string, InternalPlayer>; deadline?: number; timer?: Timer; winnerIds?: string[] };

export class GameServer {
  readonly rooms = new Map<string, Room>();
  private playerRooms = new Map<string, string>();

  constructor(private random = Math.random) {}

  handle(playerId: string, socket: SocketLike, message: ClientMessage) {
    if (message.type === "create_room") return this.createRoom(playerId, socket, message.name);
    if (message.type === "join_room") return this.joinRoom(playerId, socket, message.name, message.roomCode);
    const room = this.roomFor(playerId);
    if (!room) return this.error(socket, "Create or join a room first.");
    if (message.type === "start_game") return this.start(room, playerId);
    if (message.type === "answer") return this.answer(room, playerId, message.answer);
    if (message.type === "skip") return this.skip(room, playerId);
    if (message.type === "play_again") return this.reset(room, playerId);
  }

  disconnect(playerId: string) {
    const room = this.roomFor(playerId);
    if (!room) return;
    const player = room.players.get(playerId);
    if (player) player.connected = false;
    if (room.phase === "lobby") {
      room.players.delete(playerId);
      this.playerRooms.delete(playerId);
      if (room.ownerId === playerId) room.ownerId = room.players.keys().next().value ?? "";
    }
    if (room.players.size === 0) this.deleteRoom(room);
    else this.broadcast(room);
  }

  private createRoom(playerId: string, socket: SocketLike, rawName: string) {
    const name = this.validName(rawName, socket);
    if (!name) return;
    let code = "";
    do code = Array.from({ length: 5 }, () => ROOM_ALPHABET[Math.floor(this.random() * ROOM_ALPHABET.length)]).join(""); while (this.rooms.has(code));
    const room: Room = { code, ownerId: playerId, phase: "lobby", players: new Map() };
    room.players.set(playerId, this.newPlayer(playerId, name, socket));
    this.rooms.set(code, room);
    this.playerRooms.set(playerId, code);
    this.broadcast(room);
  }

  private joinRoom(playerId: string, socket: SocketLike, rawName: string, rawCode: string) {
    const name = this.validName(rawName, socket);
    if (!name) return;
    const room = this.rooms.get(rawCode.trim().toUpperCase());
    if (!room) return this.error(socket, "That room does not exist.");
    const disconnected = [...room.players.values()].find((player) => !player.connected && player.name.toLowerCase() === name.toLowerCase());
    if (disconnected) {
      const oldId = disconnected.id;
      room.players.delete(oldId);
      this.playerRooms.delete(oldId);
      disconnected.id = playerId;
      disconnected.socket = socket;
      disconnected.connected = true;
      room.players.set(playerId, disconnected);
      this.playerRooms.set(playerId, room.code);
      if (room.ownerId === oldId) room.ownerId = playerId;
      return this.broadcast(room);
    }
    if (room.phase !== "lobby") return this.error(socket, "That game has already started.");
    if (room.players.size >= MAX_PLAYERS) return this.error(socket, "That room is full.");
    if ([...room.players.values()].some((player) => player.name.toLowerCase() === name.toLowerCase())) return this.error(socket, "Choose a different name.");
    room.players.set(playerId, this.newPlayer(playerId, name, socket));
    this.playerRooms.set(playerId, room.code);
    this.broadcast(room);
  }

  private start(room: Room, playerId: string) {
    const player = room.players.get(playerId)!;
    if (room.ownerId !== playerId) return this.error(player.socket, "Only the host can start the game.");
    if (room.players.size !== MAX_PLAYERS) return this.error(player.socket, "Two players are required.");
    room.phase = "playing";
    room.deadline = Date.now() + ROUND_SECONDS * 1000;
    room.winnerIds = undefined;
    for (const participant of room.players.values()) {
      participant.score = 0;
      participant.skipsLeft = 3;
      participant.remaining = Object.keys(flags);
      this.nextQuestion(participant);
    }
    room.timer = setTimeout(() => this.finish(room), ROUND_SECONDS * 1000);
    this.broadcast(room);
  }

  private answer(room: Room, playerId: string, rawAnswer: string) {
    const player = room.players.get(playerId)!;
    if (room.phase !== "playing" || !player.question) return;
    const accepted = flags[player.question as keyof typeof flags].some((solution) => isAnswerCorrect(rawAnswer, solution));
    player.socket.send(JSON.stringify({ type: "answer", correct: accepted }));
    if (accepted) {
      player.score += 1;
      this.nextQuestion(player);
      this.broadcast(room);
    }
  }

  private skip(room: Room, playerId: string) {
    const player = room.players.get(playerId)!;
    if (room.phase !== "playing" || player.skipsLeft <= 0) return;
    player.skipsLeft -= 1;
    this.nextQuestion(player);
    this.broadcast(room);
  }

  private finish(room: Room) {
    if (room.phase !== "playing") return;
    room.phase = "finished";
    const topScore = Math.max(...[...room.players.values()].map((player) => player.score));
    room.winnerIds = [...room.players.values()].filter((player) => player.score === topScore).map((player) => player.id);
    this.broadcast(room);
  }

  private reset(room: Room, playerId: string) {
    if (room.ownerId !== playerId) return;
    if (room.timer) clearTimeout(room.timer);
    room.phase = "lobby";
    room.deadline = undefined;
    room.winnerIds = undefined;
    this.broadcast(room);
  }

  private nextQuestion(player: InternalPlayer) {
    if (!player.remaining.length) player.remaining = Object.keys(flags);
    const index = Math.floor(this.random() * player.remaining.length);
    player.question = player.remaining.splice(index, 1)[0];
  }

  private broadcast(room: Room) {
    for (const viewer of room.players.values()) {
      const state: RoomState = {
        type: "state", roomCode: room.code, phase: room.phase, ownerId: room.ownerId,
        players: [...room.players.values()].map(({ id, name, score, connected }) => ({ id, name, score, connected })),
        deadline: room.deadline, winnerIds: room.winnerIds,
        question: room.phase === "playing" ? viewer.question : undefined,
        skipsLeft: room.phase === "playing" ? viewer.skipsLeft : undefined,
      };
      viewer.socket.send(JSON.stringify(state));
    }
  }

  private roomFor(playerId: string) { const code = this.playerRooms.get(playerId); return code ? this.rooms.get(code) : undefined; }
  private newPlayer(id: string, name: string, socket: SocketLike): InternalPlayer { return { id, name, socket, score: 0, connected: true, remaining: [], skipsLeft: 3 }; }
  private validName(raw: string, socket: SocketLike) { const name = raw.trim().replace(/\s+/g, " "); if (name.length < 2 || name.length > 24) { this.error(socket, "Name must be between 2 and 24 characters."); return; } return name; }
  private error(socket: SocketLike, message: string) { socket.send(JSON.stringify({ type: "error", message })); }
  private deleteRoom(room: Room) { if (room.timer) clearTimeout(room.timer); this.rooms.delete(room.code); }
}

export function normalizeAnswer(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isAnswerCorrect(answer: string, solution: string) {
  const left = normalizeAnswer(answer), right = normalizeAnswer(solution);
  if (!left || left.length !== right.length) return false;
  let differences = 0;
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index] && ++differences > 1) return false;
  return true;
}
