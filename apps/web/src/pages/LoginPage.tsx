import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authClient } from "../auth/client";
import { useAuthSession } from "../auth/useAuthSession";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isPending } = useAuthSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nextPath = searchParams.get("next") || "/chug";

  useEffect(() => {
    if (!isPending && isAuthenticated) {
      navigate(nextPath, { replace: true });
    }
  }, [isAuthenticated, isPending, navigate, nextPath]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message || "Kunne ikke logge inn");
        return;
      }

      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke logge inn");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "grid", placeItems: "center", padding: "40px 0" }}>
      <div className="card" style={{ width: "min(460px, 100%)" }}>
        <h1>Admin-login</h1>
        <p>Logg inn med e-post og passord for å redigere chug-data, regler og kryss.</p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14, marginTop: 20 }}>
          <div>
            <label htmlFor="email">E-post</label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="password">Passord</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error && (
            <div
              style={{
                border: "1px solid rgba(239, 68, 68, 0.35)",
                borderRadius: 12,
                color: "#fecaca",
                padding: "10px 12px",
                background: "rgba(127, 29, 29, 0.3)",
              }}
            >
              {error}
            </div>
          )}

          <button className="btn btnPrimary" type="submit" disabled={submitting}>
            {submitting ? "Logger inn…" : "Logg inn"}
          </button>
        </form>
      </div>
    </div>
  );
}
