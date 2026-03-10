import { authClient } from "./client";

export function useAuthSession() {
  const sessionState = authClient.useSession();
  const data = sessionState.data ?? null;
  const user = data?.user ? ({ ...data.user } as typeof data.user & { role?: string }) : null;

  return {
    ...sessionState,
    data,
    user,
    session: data?.session ?? null,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === "admin",
  };
}
