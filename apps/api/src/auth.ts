import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { fromNodeHeaders } from "better-auth/node";
import type { IncomingHttpHeaders } from "node:http";
import { appEnv, matchesTrustedOrigin, usesCrossOriginCookies } from "./env.js";
import { prisma } from "./prisma.js";

const LOCAL_TRUSTED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4000",
  "http://127.0.0.1:4000"
];

export function getTrustedOrigins() {
  const configured = [appEnv.frontendOrigin, appEnv.betterAuthUrl]
    .filter((value): value is string => Boolean(value));

  const localOrigins = appEnv.isProduction ? [] : LOCAL_TRUSTED_ORIGINS;

  return Array.from(new Set([...localOrigins, ...configured, ...appEnv.trustedOriginsFromEnv]));
}

const trustedOrigins = getTrustedOrigins();

export function isTrustedOrigin(origin: string) {
  return trustedOrigins.some((pattern) => matchesTrustedOrigin(origin, pattern));
}

export const auth = betterAuth({
  appName: "Grottechug",
  basePath: "/api/auth",
  ...(appEnv.betterAuthUrl ? { baseURL: appEnv.betterAuthUrl } : {}),
  trustedOrigins,
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: !appEnv.allowSignUp,
  },
  advanced: {
    useSecureCookies: appEnv.isProduction,
    defaultCookieAttributes: {
      sameSite: usesCrossOriginCookies() ? "none" : "lax",
      secure: appEnv.isProduction,
    },
  },
  user: {
    modelName: "User",
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "member",
        input: false,
      },
      participantId: {
        type: "string",
        required: false,
        input: false,
        unique: true,
      },
    },
  },
  session: {
    modelName: "AuthSession",
  },
  account: {
    modelName: "AuthAccount",
  },
  verification: {
    modelName: "AuthVerification",
  },
});

export async function getRequestSession(headers: IncomingHttpHeaders) {
  return auth.api.getSession({
    headers: fromNodeHeaders(headers),
  });
}
