import { connection } from "next/server";

// The browser opens the auction hub (a WebSocket) straight to the Gateway: the Next.js proxy route cannot carry a WebSocket. The address comes
// from REALTIME_URL, read per request like /api/features. Unset means realtime is off and the room keeps refreshing on a timer.
export async function GET(): Promise<Response> {
  await connection();
  const raw = process.env.REALTIME_URL?.trim();
  let url: string | null = null;
  try {
    if (raw) {
      const parsed = new URL(raw);
      if ((parsed.protocol === "http:" || parsed.protocol === "https:") && !parsed.username && !parsed.password) url = parsed.origin;
    }
  } catch {
    url = null;
  }
  return Response.json({ url }, { headers: { "Cache-Control": "no-store" } });
}
