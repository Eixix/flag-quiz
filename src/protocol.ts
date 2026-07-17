export type Player = { id: string; name: string; score: number; connected: boolean };

export type RoomState = {
  type: "state";
  roomCode: string;
  phase: "lobby" | "playing" | "finished";
  players: Player[];
  ownerId: string;
  question?: string;
  deadline?: number;
  winnerIds?: string[];
  skipsLeft?: number;
};

export type ServerMessage =
  | { type: "welcome"; playerId: string }
  | RoomState
  | { type: "error"; message: string }
  | { type: "answer"; correct: boolean };

export type ClientMessage =
  | { type: "create_room"; name: string }
  | { type: "join_room"; name: string; roomCode: string }
  | { type: "start_game" }
  | { type: "answer"; answer: string }
  | { type: "skip" }
  | { type: "play_again" };
