/**
 * The small part of the SignalR JSON protocol this front end needs (handshake, invocations, ping, close). Pure functions only, so the
 * protocol is tested without a socket. Frames are JSON texts each ended by the record separator character.
 */
export const RECORD_SEPARATOR = "\u001e";

export const MESSAGE_TYPE = { Invocation: 1, Completion: 3, Ping: 6, Close: 7 } as const;

export type HubMessage = { type: number; target?: string; arguments?: unknown[]; invocationId?: string; error?: string; allowReconnect?: boolean };

export function encodeFrame(message: unknown): string {
  return JSON.stringify(message) + RECORD_SEPARATOR;
}

export const HANDSHAKE_REQUEST = encodeFrame({ protocol: "json", version: 1 });

export function invocation(target: string, args: unknown[], invocationId: string): string {
  return encodeFrame({ type: MESSAGE_TYPE.Invocation, invocationId, target, arguments: args });
}

export const PING_FRAME = encodeFrame({ type: MESSAGE_TYPE.Ping });

/** Splits received text into complete messages and the unfinished rest (a frame may arrive in pieces). Malformed frames are dropped. */
export function decodeFrames(buffer: string): { messages: HubMessage[]; rest: string } {
  const parts = buffer.split(RECORD_SEPARATOR);
  const rest = parts.pop() ?? "";
  const messages: HubMessage[] = [];
  for (const part of parts) {
    if (!part.trim()) continue;
    try {
      const parsed = JSON.parse(part) as HubMessage;
      if (parsed && typeof parsed === "object") messages.push(parsed);
    } catch {
      // A malformed frame is skipped; the connection stays usable.
    }
  }
  return { messages, rest };
}

/** The handshake answer is `{}` on success or `{"error":"..."}`. It has no `type`. */
export function handshakeError(message: HubMessage): string | null {
  return typeof message.error === "string" && message.error ? message.error : null;
}

/** Exponential backoff with a ceiling: 1s, 2s, 4s, 8s, 16s, then 30s. */
export function reconnectDelay(attempt: number): number {
  return Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt));
}

/** The negotiate answer names the token to put in the socket address (`connectionToken` for negotiate version 1, else `connectionId`). */
export function connectionTokenOf(negotiate: unknown): string | null {
  const value = negotiate as { connectionToken?: unknown; connectionId?: unknown } | null;
  const token = value?.connectionToken ?? value?.connectionId;
  return typeof token === "string" && token ? token : null;
}

/** `http(s)://host/path` to `ws(s)://host/path`. */
export function toSocketUrl(httpUrl: string): string {
  return httpUrl.replace(/^http/i, "ws");
}
