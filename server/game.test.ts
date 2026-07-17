import { describe, expect, test } from "bun:test";
import { GameServer, isAcceptedAnswer, isAnswerCorrect, normalizeAnswer } from "./game";

const socket = () => ({ messages: [] as any[], send(data: string) { this.messages.push(JSON.parse(data)); } });

describe("answer matching", () => {
  test("normalizes input and allows one typo", () => {
    expect(normalizeAnswer("  Côte d'Ivoire ")).toBe("cotedivoire");
    expect(isAnswerCorrect("germamy", "Germany")).toBeTrue();
    expect(isAnswerCorrect("German", "Germany")).toBeFalse();
    expect(isAnswerCorrect("", "Chad")).toBeFalse();
  });

  test("accepts aliases and unambiguous country prefixes", () => {
    expect(isAcceptedAnswer("DRC", "CD")).toBeTrue();
    expect(isAcceptedAnswer("germ", "DE")).toBeTrue();
    expect(isAcceptedAnswer("south", "KR")).toBeFalse();
    expect(isAcceptedAnswer("congo", "CG")).toBeTrue();
    expect(isAcceptedAnswer("con", "CG")).toBeFalse();
    expect(isAcceptedAnswer("Iran", "IQ")).toBeFalse();
    expect(isAcceptedAnswer("Iraq", "IQ")).toBeTrue();
  });
});

describe("rooms", () => {
  test("supports multiple players with one shared question", () => {
    const game = new GameServer(() => 0);
    const host = socket(), guest = socket(), third = socket();
    game.handle("host", host, { type: "create_room", name: "Host" });
    const code = host.messages.at(-1).roomCode;
    game.handle("guest", guest, { type: "join_room", name: "Guest", roomCode: code });
    game.handle("third", third, { type: "join_room", name: "Third", roomCode: code });
    game.handle("host", host, { type: "start_game" });
    expect(host.messages.at(-1).phase).toBe("playing");
    expect(host.messages.at(-1).question).toBe(guest.messages.at(-1).question);
    expect(guest.messages.at(-1).question).toBe(third.messages.at(-1).question);
    expect(host.messages.at(-1).players).toHaveLength(3);

    game.handle("host", host, { type: "answer", answer: "Afghanistan", question: "AF" });
    expect(host.messages.at(-1).question).toBe("AL");
    expect(guest.messages.at(-1).question).toBe("AL");
    expect(host.messages.at(-1).players.find((player: any) => player.id === "host").score).toBe(1);

    game.handle("guest", guest, { type: "answer", answer: "Alb", question: "AF" });
    expect(guest.messages.at(-1).question).toBe("AL");
  });

  test("only skips after every connected player agrees", () => {
    const game = new GameServer(() => 0);
    const one = socket(), two = socket(), three = socket();
    game.handle("one", one, { type: "create_room", name: "One" });
    const code = one.messages.at(-1).roomCode;
    game.handle("two", two, { type: "join_room", name: "Two", roomCode: code });
    game.handle("three", three, { type: "join_room", name: "Three", roomCode: code });
    game.handle("one", one, { type: "start_game" });
    expect(one.messages.at(-1).question).toBe("AF");
    game.handle("one", one, { type: "skip" });
    game.handle("two", two, { type: "skip" });
    expect(one.messages.at(-1).question).toBe("AF");
    expect(one.messages.at(-1).skipVotes).toBe(2);
    game.handle("three", three, { type: "skip" });
    expect(one.messages.at(-1).question).toBe("AL");
    expect(one.messages.at(-1).skipVotes).toBe(0);
  });
});
