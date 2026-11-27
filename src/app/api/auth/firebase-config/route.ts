import { connection } from "next/server";
import { readFirebasePublicConfig } from "@/lib/auth/firebase-config";

/**
 * Returns public Firebase Web App config at request time so standalone builds
 * can configure Google Sign-In via environment variables without rebuilding.
 */
export async function GET(): Promise<Response> {
  await connection();

  const config = readFirebasePublicConfig(process.env);
  if (!config) {
    return Response.json(
      {
        title: "Đăng nhập Google chưa được cấu hình trên máy chủ.",
        status: 503,
        errorCode: "FIREBASE_NOT_CONFIGURED",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(config, { headers: { "Cache-Control": "no-store" } });
}
