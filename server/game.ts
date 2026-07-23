import flags from "../src/res/countryFlags.json";
import { GAME_CONFIG } from "../src/gameConfig";
import type { ClientMessage, GameMode, Player, RoomState } from "../src/protocol";

export const DEFAULT_ROUND_SECONDS = GAME_CONFIG.defaultDurationSeconds;
export const DEFAULT_TARGET_SCORE = GAME_CONFIG.defaultTargetScore;
export const COUNTDOWN_SECONDS = GAME_CONFIG.countdownSeconds;
export const MAX_PLAYERS = 12;
const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type SocketLike = { send(data: string): void };
type InternalPlayer = Player & { socket: SocketLike };
export type Room = { code: string; ownerId: string; phase: RoomState["phase"]; players: Map<string, InternalPlayer>; question?: string; remaining: string[]; skipVotes: Set<string>; deadline?: number; timer?: Timer; countdownTimer?: Timer; winnerIds?: string[]; mode?: GameMode; targetScore?: number; durationSeconds?: number; countdownUntil?: number };

export class GameServer {
  readonly rooms = new Map<string, Room>();
  private playerRooms = new Map<string, string>();

  constructor(private random = Math.random, private countdownSeconds: number = COUNTDOWN_SECONDS) {}

  handle(playerId: string, socket: SocketLike, message: ClientMessage) {
    if (message.type === "create_room") return this.createRoom(playerId, socket, message.name);
    if (message.type === "join_room") return this.joinRoom(playerId, socket, message.name, message.roomCode);
    const room = this.roomFor(playerId);
    if (!room) return this.error(socket, "Create or join a room first.");
    if (message.type === "start_game") return this.start(room, playerId, message.mode, message.targetScore, message.durationSeconds);
    if (message.type === "answer") return this.answer(room, playerId, message.answer, message.question, message.final ?? false);
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
    else {
      this.advanceIfSkipUnanimous(room);
      this.broadcast(room);
    }
  }

  private createRoom(playerId: string, socket: SocketLike, rawName: string) {
    const name = this.validName(rawName, socket);
    if (!name) return;
    let code = "";
    do code = Array.from({ length: 5 }, () => ROOM_ALPHABET[Math.floor(this.random() * ROOM_ALPHABET.length)]).join(""); while (this.rooms.has(code));
    const room: Room = { code, ownerId: playerId, phase: "lobby", players: new Map(), remaining: [], skipVotes: new Set() };
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

  private start(room: Room, playerId: string, mode: GameMode | undefined, rawTarget?: number, rawDuration?: number) {
    const player = room.players.get(playerId)!;
    if (room.ownerId !== playerId) return this.error(player.socket, "Only the host can start the game.");
    if (room.players.size < 2) return this.error(player.socket, "At least two players are required.");
    room.phase = "playing";
    room.mode = mode === "timed" ? "timed" : "first_to";
    room.targetScore = clampInteger(rawTarget, DEFAULT_TARGET_SCORE, GAME_CONFIG.minTargetScore, GAME_CONFIG.maxTargetScore);
    room.durationSeconds = clampInteger(rawDuration, DEFAULT_ROUND_SECONDS, GAME_CONFIG.minDurationSeconds, GAME_CONFIG.maxDurationSeconds);
    room.deadline = undefined;
    room.winnerIds = undefined;
    room.remaining = Object.keys(flags);
    room.skipVotes.clear();
    for (const participant of room.players.values()) {
      participant.score = 0;
    }
    this.nextQuestion(room);
    this.beginCountdown(room, true);
    this.broadcast(room);
  }

  private answer(room: Room, playerId: string, rawAnswer: string, question: string, final: boolean) {
    const player = room.players.get(playerId)!;
    if (room.phase !== "playing" || room.countdownUntil || !room.question || question !== room.question) return;
    const accepted = isAcceptedAnswer(rawAnswer, room.question);
    if (accepted || final) player.socket.send(JSON.stringify({ type: "answer", correct: accepted }));
    if (accepted) {
      player.score += 1;
      if (room.mode === "first_to" && player.score >= (room.targetScore ?? DEFAULT_TARGET_SCORE)) return this.finish(room);
      this.nextQuestion(room);
      this.beginCountdown(room, false);
      this.broadcast(room);
    }
  }

  private skip(room: Room, playerId: string) {
    const player = room.players.get(playerId)!;
    if (room.phase !== "playing" || room.countdownUntil || room.skipVotes.has(playerId)) return;
    room.skipVotes.add(playerId);
    this.advanceIfSkipUnanimous(room);
    this.broadcast(room);
  }

  private finish(room: Room) {
    if (room.phase !== "playing") return;
    room.phase = "finished";
    room.countdownUntil = undefined;
    if (room.timer) clearTimeout(room.timer);
    if (room.countdownTimer) clearTimeout(room.countdownTimer);
    const topScore = Math.max(...[...room.players.values()].map((player) => player.score));
    room.winnerIds = [...room.players.values()].filter((player) => player.score === topScore).map((player) => player.id);
    this.broadcast(room);
  }

  private reset(room: Room, playerId: string) {
    if (room.ownerId !== playerId) return;
    if (room.timer) clearTimeout(room.timer);
    if (room.countdownTimer) clearTimeout(room.countdownTimer);
    room.phase = "lobby";
    room.deadline = undefined;
    room.countdownUntil = undefined;
    room.winnerIds = undefined;
    this.broadcast(room);
  }

  private nextQuestion(room: Room) {
    if (!room.remaining.length) room.remaining = Object.keys(flags);
    const index = Math.floor(this.random() * room.remaining.length);
    room.question = room.remaining.splice(index, 1)[0];
    room.skipVotes.clear();
  }

  private advanceIfSkipUnanimous(room: Room) {
    if (room.phase !== "playing" || room.countdownUntil) return;
    const connectedIds = [...room.players.values()].filter((player) => player.connected).map((player) => player.id);
    if (connectedIds.length > 0 && connectedIds.every((id) => room.skipVotes.has(id))) {
      this.nextQuestion(room);
      this.beginCountdown(room, false);
    }
  }

  private beginCountdown(room: Room, startsTimedGame: boolean) {
    if (room.countdownTimer) clearTimeout(room.countdownTimer);
    if (this.countdownSeconds <= 0) return this.endCountdown(room, startsTimedGame);
    room.countdownUntil = Date.now() + this.countdownSeconds * 1000;
    room.countdownTimer = setTimeout(() => this.endCountdown(room, startsTimedGame), this.countdownSeconds * 1000);
  }

  private endCountdown(room: Room, startsTimedGame: boolean) {
      if (room.phase !== "playing") return;
      room.countdownUntil = undefined;
      room.countdownTimer = undefined;
      if (startsTimedGame && room.mode === "timed") {
        room.deadline = Date.now() + (room.durationSeconds ?? DEFAULT_ROUND_SECONDS) * 1000;
        room.timer = setTimeout(() => this.finish(room), (room.durationSeconds ?? DEFAULT_ROUND_SECONDS) * 1000);
      }
      this.broadcast(room);
  }

  private broadcast(room: Room) {
    for (const viewer of room.players.values()) {
      const state: RoomState = {
        type: "state", roomCode: room.code, phase: room.phase, ownerId: room.ownerId,
        players: [...room.players.values()].map(({ id, name, score, connected }) => ({ id, name, score, connected })),
        deadline: room.deadline, winnerIds: room.winnerIds,
        mode: room.mode, targetScore: room.targetScore, durationSeconds: room.durationSeconds,
        countdownUntil: room.phase === "playing" ? room.countdownUntil : undefined,
        serverNow: Date.now(),
        question: room.phase === "playing" ? room.question : undefined,
        skipVotes: room.phase === "playing" ? room.skipVotes.size : undefined,
        skipVotesRequired: room.phase === "playing" ? [...room.players.values()].filter((player) => player.connected).length : undefined,
        hasVotedToSkip: room.phase === "playing" ? room.skipVotes.has(viewer.id) : undefined,
      };
      viewer.socket.send(JSON.stringify(state));
    }
  }

  private roomFor(playerId: string) { const code = this.playerRooms.get(playerId); return code ? this.rooms.get(code) : undefined; }
  private newPlayer(id: string, name: string, socket: SocketLike): InternalPlayer { return { id, name, socket, score: 0, connected: true }; }
  private validName(raw: string, socket: SocketLike) { const name = raw.trim().replace(/\s+/g, " "); if (name.length < 2 || name.length > 24) { this.error(socket, "Name must be between 2 and 24 characters."); return; } return name; }
  private error(socket: SocketLike, message: string) { socket.send(JSON.stringify({ type: "error", message })); }
  private deleteRoom(room: Room) { if (room.timer) clearTimeout(room.timer); if (room.countdownTimer) clearTimeout(room.countdownTimer); this.rooms.delete(room.code); }
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value!))) : fallback;
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

export function isAcceptedAnswer(answer: string, countryCode: string) {
  const normalized = normalizeAnswer(answer);
  if (!normalized || !(countryCode in flags)) return false;

  const matchingCountries = (matcher: (alias: string) => boolean) => new Set(
    Object.entries(flags)
      .filter(([, aliases]) => aliases.some((alias) => matcher(normalizeAnswer(alias))))
      .map(([code]) => code),
  );
  const uniquelyMatchesCountry = (countries: Set<string>) => countries.size === 1 && countries.has(countryCode);

  const exactMatches = matchingCountries((alias) => alias === normalized);
  if (exactMatches.size > 0) return uniquelyMatchesCountry(exactMatches);

  const fuzzyMatches = matchingCountries((alias) => isAnswerCorrect(normalized, alias));
  if (fuzzyMatches.size > 0) return uniquelyMatchesCountry(fuzzyMatches);

  if (normalized.length < 3) return false;
  return uniquelyMatchesCountry(matchingCountries((alias) => alias.startsWith(normalized)));
}
