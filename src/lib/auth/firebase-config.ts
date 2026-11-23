export type FirebasePublicConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
};

export function parseFirebasePublicConfig(raw: Record<string, unknown> | null | undefined): FirebasePublicConfig | null {
  if (!raw || typeof raw !== "object") return null;

  const apiKey = typeof raw.apiKey === "string" ? raw.apiKey.trim() : "";
  const authDomain = typeof raw.authDomain === "string" ? raw.authDomain.trim() : "";
  const projectId = typeof raw.projectId === "string" ? raw.projectId.trim() : "";
  const appId = typeof raw.appId === "string" ? raw.appId.trim() : "";

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }

  return { apiKey, authDomain, projectId, appId };
}

export function readFirebasePublicConfig(env: Record<string, string | undefined>): FirebasePublicConfig | null {
  return parseFirebasePublicConfig({
    apiKey: env.FIREBASE_API_KEY,
    authDomain: env.FIREBASE_AUTH_DOMAIN,
    projectId: env.FIREBASE_PROJECT_ID,
    appId: env.FIREBASE_APP_ID,
  });
}
