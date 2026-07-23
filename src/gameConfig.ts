/** Host-facing defaults and server-enforced bounds for game settings. */
export const GAME_CONFIG = {
  countdownSeconds: 3,
  defaultDurationSeconds: 60,
  defaultTargetScore: 10,
  minDurationSeconds: 10,
  maxDurationSeconds: 3600,
  minTargetScore: 1,
  maxTargetScore: 100,
} as const;
