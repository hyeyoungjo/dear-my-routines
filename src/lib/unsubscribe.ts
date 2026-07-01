/**
 * One-click email unsubscribe tokens (ADR-029). A signed link lets a recipient
 * opt out of transactional/marketing email without logging in: the token proves
 * the request came from a link we minted, not a guessed URL. This is a
 * **server-only** module — it reads UNSUBSCRIBE_SECRET from the environment and
 * must never be imported into a client bundle (that would leak the secret).
 *
 * The token is an HMAC-SHA256 of the recipient's (normalized) email. The secret
 * is read at call time — not cached at module load — so tests can inject an env
 * value and the runtime stays flexible.
 */
import { createHmac, timingSafeEqual } from "crypto";

/** Read the signing secret at call time; fail loudly if it is not configured. */
function secret(): string {
  const value = process.env.UNSUBSCRIBE_SECRET;
  if (!value) {
    throw new Error("UNSUBSCRIBE_SECRET is not set");
  }
  return value;
}

/** Trim + lowercase so casing/whitespace differences don't break verification. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** HMAC-SHA256(email, UNSUBSCRIBE_SECRET) as hex. Secret read at call time. */
export function unsubscribeToken(email: string): string {
  return createHmac("sha256", secret()).update(normalizeEmail(email)).digest("hex");
}

/** Constant-time verify of a token for an email. */
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = unsubscribeToken(email);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Full unsubscribe URL: `${baseUrl}/api/unsubscribe?e=<enc>&t=<token>`. */
export function unsubscribeUrl(email: string, baseUrl: string): string {
  const enc = encodeURIComponent(email);
  const token = unsubscribeToken(email);
  return `${baseUrl}/api/unsubscribe?e=${enc}&t=${token}`;
}
