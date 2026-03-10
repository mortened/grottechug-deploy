import "dotenv/config";

function normalizeUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function normalizeOptionalUrl(value?: string | null) {
  if (!value) return undefined;

  const normalized = normalizeUrl(value);
  return normalized || undefined;
}

function parseTrustedOrigins(value?: string) {
  return (value ?? "")
    .split(",")
    .map((origin) => normalizeOptionalUrl(origin))
    .filter((origin): origin is string => Boolean(origin));
}

function resolveDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || "file:./dev.db";
}

export const appEnv = {
  isProduction: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? "4000"),
  databaseUrl: resolveDatabaseUrl(),
  tursoDatabaseUrl: process.env.TURSO_DATABASE_URL?.trim() ?? "",
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN?.trim() ?? "",
  betterAuthSecret: process.env.BETTER_AUTH_SECRET?.trim() ?? "",
  betterAuthUrl: normalizeOptionalUrl(process.env.BETTER_AUTH_URL),
  frontendOrigin: normalizeOptionalUrl(process.env.FRONTEND_ORIGIN),
  allowSignUp: process.env.AUTH_ALLOW_SIGNUP === "true",
  trustedOriginsFromEnv: parseTrustedOrigins(process.env.BETTER_AUTH_TRUSTED_ORIGINS),
};

process.env.DATABASE_URL = appEnv.databaseUrl;

if (!Number.isFinite(appEnv.port)) {
  throw new Error("PORT must be a valid number");
}

function requireHttps(name: string, value: string | undefined) {
  if (!value) return;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  if (appEnv.isProduction && parsed.protocol !== "https:") {
    throw new Error(`${name} must use https in production`);
  }
}

export function usesCrossOriginCookies() {
  if (!appEnv.frontendOrigin || !appEnv.betterAuthUrl) {
    return false;
  }

  try {
    return new URL(appEnv.frontendOrigin).origin !== new URL(appEnv.betterAuthUrl).origin;
  } catch {
    return false;
  }
}

export function matchesTrustedOrigin(origin: string, pattern: string) {
  const normalizedOrigin = normalizeUrl(origin);
  const normalizedPattern = normalizeUrl(pattern);

  if (normalizedOrigin === normalizedPattern) {
    return true;
  }

  const wildcardMatch = normalizedPattern.match(/^(https?:\/\/)?\*\.(.+)$/);
  if (!wildcardMatch) {
    return false;
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(normalizedOrigin);
  } catch {
    return false;
  }

  const [, protocolPrefix, hostnamePattern] = wildcardMatch;
  if (protocolPrefix && parsedOrigin.protocol !== `${protocolPrefix === "https://" ? "https" : "http"}:`) {
    return false;
  }

  const { hostname } = parsedOrigin;
  return hostname !== hostnamePattern && hostname.endsWith(`.${hostnamePattern}`);
}

export function assertProductionEnv() {
  if (!appEnv.isProduction) {
    return;
  }

  if (!appEnv.tursoDatabaseUrl) {
    throw new Error("TURSO_DATABASE_URL must be set in production");
  }

  if (!appEnv.tursoDatabaseUrl.startsWith("libsql://")) {
    throw new Error("TURSO_DATABASE_URL must use the libsql:// protocol");
  }

  if (!appEnv.tursoAuthToken) {
    throw new Error("TURSO_AUTH_TOKEN must be set in production");
  }

  if (!appEnv.betterAuthSecret || appEnv.betterAuthSecret === "replace-me" || appEnv.betterAuthSecret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be set to a high-entropy value with at least 32 characters in production");
  }

  if (!appEnv.betterAuthUrl) {
    throw new Error("BETTER_AUTH_URL must be set in production");
  }

  if (!appEnv.frontendOrigin) {
    throw new Error("FRONTEND_ORIGIN must be set in production");
  }

  requireHttps("BETTER_AUTH_URL", appEnv.betterAuthUrl);
  requireHttps("FRONTEND_ORIGIN", appEnv.frontendOrigin);
}
