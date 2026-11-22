import { connection } from "next/server";
import { parseFeatureList } from "@/lib/features/feature-flags";

// Read at request time on the server. `connection()` opts the handler out of prerendering, so the value of FEATURES is not
// frozen at build time and a deployment can switch features on or off with a restart.
export async function GET(): Promise<Response> {
  await connection();
  return Response.json({ enabled: parseFeatureList(process.env.FEATURES) }, { headers: { "Cache-Control": "no-store" } });
}
