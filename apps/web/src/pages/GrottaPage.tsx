import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type Person = {
  id: string;
  name: string;
  isRegular: boolean;
  imageUrl?: string | null;
};

export function GrottaPage() {
  const nav = useNavigate();
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    (async () => {
      // includeGuests=false => kun faste fra backend
      const res = await fetch("/api/participants?includeGuests=false");
      const json: Person[] = await res.json();
      setPeople(json);
    })();
  }, []);

  const cards = useMemo(() => people.filter(p => p.isRegular), [people]);

  return (
    <div>
      <h1>Grotta</h1>
      <p>Faste medlemmer. Trykk på et kort for profil.</p>

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
          gap: 14
        }}
      >
        {cards.map(p => (
          <button
            key={p.id}
            className="card cardCard"
            onClick={() => nav(`/person/${p.id}`)}
            style={{
              cursor: "pointer",
              padding: 12,
              textAlign: "left",
              border: "1px solid var(--border)",
              background: "rgba(0,0,0,0.16)"
            }}
            title={`Åpne profil: ${p.name}`}
          >
            {/* Navn over bildet, sentrert i midten */}
            <div
              style={{
                fontWeight: 900,
                marginBottom: 10,
                fontSize: 20,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: "var(--text)",
                textAlign: "center"

              }}
            >
              {p.name}
            </div>

            {/* Bilde */}
            <div
              style={{
                borderRadius: 16,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.05)",
                aspectRatio: "3 / 4",
                display: "grid",
                placeItems: "center"
              }}
            >
              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <div style={{ color: "var(--muted)", fontWeight: 800 }}>
                  Ingen bilde
                </div>
              )}
            </div>
          </button>
        ))}

        {!cards.length && (
          <div style={{ color: "var(--muted)" }}>
            Ingen faste enda.
          </div>
        )}
      </div>
    </div>
  );
}