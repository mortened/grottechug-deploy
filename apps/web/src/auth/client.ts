import { createAuthClient } from "better-auth/react";
import { API_BASE_URL } from "../lib/api";

export const authClient = createAuthClient({
  ...(API_BASE_URL ? { baseURL: API_BASE_URL } : {}),
  basePath: "/api/auth",
  fetchOptions: {
    credentials: "include",
  },
});

export type AppAuthSession = typeof authClient.$Infer.Session;
