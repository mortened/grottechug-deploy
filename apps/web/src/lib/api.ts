function normalizeBaseUrl(value?: string) {
  return value?.trim().replace(/\/+$/, "") ?? "";
}

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_URL);

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}

export function apiFetch(path: string, init: RequestInit = {}) {
  return fetch(apiUrl(path), {
    credentials: "include",
    ...init,
  });
}
