import { beforeAll, describe, expect, it } from "vitest";
import {
  unsubscribeToken,
  unsubscribeUrl,
  verifyUnsubscribeToken,
} from "./unsubscribe";

beforeAll(() => {
  process.env.UNSUBSCRIBE_SECRET = "test-secret";
});

describe("unsubscribe tokens", () => {
  it("is deterministic for the same email", () => {
    expect(unsubscribeToken("a@b.com")).toBe(unsubscribeToken("a@b.com"));
  });

  it("verifies a correct token", () => {
    const token = unsubscribeToken("a@b.com");
    expect(verifyUnsubscribeToken("a@b.com", token)).toBe(true);
  });

  it("rejects a tampered token or a different email", () => {
    const token = unsubscribeToken("a@b.com");
    expect(verifyUnsubscribeToken("a@b.com", `${token}00`)).toBe(false);
    expect(verifyUnsubscribeToken("a@b.com", "not-a-token")).toBe(false);
    expect(verifyUnsubscribeToken("other@b.com", token)).toBe(false);
  });

  it("normalizes casing and whitespace", () => {
    const token = unsubscribeToken("a@b.com");
    expect(unsubscribeToken("  A@B.com ")).toBe(token);
    expect(verifyUnsubscribeToken("  A@B.com ", token)).toBe(true);
  });

  it("builds a url with an encoded email and the token", () => {
    const url = unsubscribeUrl("a+x@b.com", "https://example.com");
    expect(url).toBe(
      `https://example.com/api/unsubscribe?e=a%2Bx%40b.com&t=${unsubscribeToken("a+x@b.com")}`,
    );
  });
});
