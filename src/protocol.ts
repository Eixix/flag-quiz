export type Player = { id: string; name: string; score: number; connected: boolean };
export type GameMode = "first_to" | "timed";
export type Difficulty = "explorer" | "world" | "expert";

export type RoomState = {
  type: "state";
  roomCode: string;
  phase: "lobby" | "playing" | "finished";
  players: Player[];
  ownerId: string;
  question?: string;
  deadline?: number;
  winnerIds?: string[];
  mode?: GameMode;
  targetScore?: number;
  durationSeconds?: number;
  difficulty?: Difficulty;
  countdownUntil?: number;
  serverNow?: number;
  skipVotes?: number;
  skipVotesRequired?: number;
  hasVotedToSkip?: boolean;
};

export type ServerMessage =
  | { type: "welcome"; playerId: string }
  | RoomState
  | { type: "error"; message: string }
  | { type: "answer"; correct: boolean };

export type ClientMessage =
  | { type: "create_room"; name: string }
  | { type: "join_room"; name: string; roomCode: string }
  | { type: "start_game"; mode?: GameMode; difficulty?: Difficulty; targetScore?: number; durationSeconds?: number }
  | { type: "answer"; answer: string; question: string; final?: boolean }
  | { type: "skip" }
  | { type: "play_again" };
