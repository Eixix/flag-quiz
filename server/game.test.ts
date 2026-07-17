import { describe, expect, test } from "bun:test";
import { GameServer, isAnswerCorrect, normalizeAnswer } from "./game";

const socket = () => ({ messages: [] as any[], send(data: string) { this.messages.push(JSON.parse(data)); } });

describe("answer matching", () => {
  test("normalizes input and allows one typo", () => {
    expect(normalizeAnswer("  Côte d'Ivoire ")).toBe("cotedivoire");
    expect(isAnswerCorrect("germamy", "Germany")).toBeTrue();
    expect(isAnswerCorrect("German", "Germany")).toBeFalse();
    expect(isAnswerCorrect("", "Chad")).toBeFalse();
  });
});

describe("rooms", () => {
  test("creates, joins and starts an authoritative game", () => {
    const game = new GameServer(() => 0);
    const host = socket(), guest = socket();
    game.handle("host", host, { type: "create_room", name: "Host" });
    const code = host.messages.at(-1).roomCode;
    game.handle("guest", guest, { type: "join_room", name: "Guest", roomCode: code });
    game.handle("host", host, { type: "start_game" });
    expect(host.messages.at(-1).phase).toBe("playing");
    expect(guest.messages.at(-1).question).toBeString();
    expect(host.messages.at(-1).players).toHaveLength(2);
  });

  test("rejects unknown and full rooms", () => {
    const game = new GameServer(() => 0);
    const one = socket(), two = socket(), three = socket();
    game.handle("missing", one, { type: "join_room", name: "One", roomCode: "NOPE1" });
    expect(one.messages.at(-1).type).toBe("error");
    game.handle("one", one, { type: "create_room", name: "One" });
    const code = one.messages.at(-1).roomCode;
    game.handle("two", two, { type: "join_room", name: "Two", roomCode: code });
    game.handle("three", three, { type: "join_room", name: "Three", roomCode: code });
    expect(three.messages.at(-1).message).toContain("full");
  });
});
