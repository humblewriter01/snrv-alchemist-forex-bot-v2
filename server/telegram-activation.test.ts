import { describe, expect, it } from "vitest";
import { telegramActivationOwnerKeys } from "./routers/signal-router";

describe("Telegram activation owner keys", () => {
  it("normalizes, deduplicates, and retains both authenticated and webhook owners", () => {
    expect(telegramActivationOwnerKeys(" owner-a ", " owner-b ")).toEqual(["owner-a", "owner-b"]);
    expect(telegramActivationOwnerKeys(" owner-a ", "owner-a")).toEqual(["owner-a"]);
  });

  it("does not return a blank settings key", () => {
    expect(telegramActivationOwnerKeys(" ", " ")).toEqual([]);
  });
});
