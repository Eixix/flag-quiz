export const EN_UI = {
  online: "online", connecting: "connecting", offline: "offline",
  gameCode: "Your game code", shareCode: "Share this code or let a friend scan the QR code.",
  qrLoading: "QR code is being generated", copyLink: "Copy join link",
  waitingHostStart: "Waiting for the host to start…", waitingHost: "Waiting for the host…",
  startGame: "Start game", firstTo: "First to", timeMode: "Time mode",
  pointsToWin: "Points to win", seconds: "Seconds", familiarFlags: "54 familiar flags",
  countries: "196 countries", countriesTerritories: "250 countries & territories",
  explorer: "Explorer", world: "World", expert: "Expert",
  roundComplete: "Round complete", won: "You won!", goodGame: "Good game!", playAgain: "Play again",
  room: "Room", points: "points", flagAlt: "Flag to identify", getReady: "Get ready",
  waitingEveryone: "Waiting for everyone", voteSkip: "Vote to skip",
  heroStatus: "Multiplayer / live session", heroTitle: "How well do you", heroAccent: "know the world?",
  heroText: "Race your friends through the world’s flags. One shared question, one synchronized countdown.",
  yourName: "Your name", namePlaceholder: "e.g. Tobias", createGame: "Create a game",
  joinDivider: "or join one", roomCode: "ROOM CODE", join: "Join",
  connectionLost: "Connection lost. Refresh to try again.", readyPlaceholder: "Get ready…",
  answerPlaceholder: "Type the country…", submit: "Submit", offlinePlayer: "offline",
  footer: "Built for curious minds · Hexagons are bestagons.", flagsBy: "Flags by",
  imprint: "Imprint", privacy: "Privacy", language: "Deutsch",
} as const;

export type TranslationKey = keyof typeof EN_UI;
