import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

type Person = {
  id: string;
  name: string;
  isRegular: boolean;
  imageUrl?: string | null;
};

type Cell = { seconds: number | null; note: string | null };
type TableResponse = {
  semester: string;
  columns: Array<{ sessionId: string; dateISO: string }>;
  rows: Array<{
    participantId: string;
    name: string;
    isRegular: boolean;
    bestOverall: number | null;
    avgOverall: number | null;
  }>;
  cells: Record<string, Record<string, Cell>>;
};

type GuestSortMode = "alpha" | "chugs";

function getInitials(name: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function GrottaPage() {
  const nav = useNavigate();
  const [people, setPeople] = useState<Person[]>([]);
  const [showGuests, setShowGuests] = useState(false);
  const [guestSortMode, setGuestSortMode] = useState<GuestSortMode>("alpha");
  const [chugCountById, setChugCountById] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const [peopleRes, statsRes] = await Promise.all([
        apiFetch("/api/participants?includeGuests=true"),
        apiFetch("/api/stats/table?semester=all")
      ]);

      const peopleJson: Person[] = await peopleRes.json();
      const statsJson: TableResponse = await statsRes.json();

      setPeople(peopleJson);

      const counts: Record<string, number> = {};
      for (const personId of Object.keys(statsJson.cells ?? {})) {
        const rowCells = statsJson.cells[personId] ?? {};
        let count = 0;

        for (const sessionId of Object.keys(rowCells)) {
          const cell = rowCells[sessionId];
          if (cell?.seconds != null) count += 1;
        }

        counts[personId] = count;
      }

      setChugCountById(counts);
    })();
  }, []);

  const regularCards = useMemo(() => {
    return [...people.filter(p => p.isRegular)].sort((a, b) => a.name.localeCompare(b.name, "no"));
  }, [people]);

  const guestCards = useMemo(() => {
    const guests = [...people.filter(p => !p.isRegular)];

    if (guestSortMode === "alpha") {
      guests.sort((a, b) => a.name.localeCompare(b.name, "no"));
      return guests;
    }

    guests.sort((a, b) => {
      const ca = chugCountById[a.id] ?? 0;
      const cb = chugCountById[b.id] ?? 0;
      if (cb !== ca) return cb - ca;
      return a.name.localeCompare(b.name, "no");
    });

    return guests;
  }, [people, guestSortMode, chugCountById]);

  const renderCard = (p: Person, showChugCount: boolean) => {
    const chugCount = chugCountById[p.id] ?? 0;

    return (
      <button
        key={p.id}
        className="card cardCard"
        onClick={() => nav(`/person/${p.id}`)}
        style={{
          cursor: "pointer",
          padding: 12,
          textAlign: "left",
          border: "1px solid var(--border)",
          background: "rgba(0,0,0,0.16)",
          display: "flex",
          flexDirection: "column",
          gap: 10
        }}
        title={`Åpne profil: ${p.name}`}
      >
        {/* Navn over bildet */}
        <div
          style={{
            fontWeight: 900,
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

        {/* Bilde / initialer */}
        <div
          style={{
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.05)",
            aspectRatio: "3 / 4",
            display: "grid",
            placeItems: "center",
            width: "100%"
          }}
        >
          {p.imageUrl ? (
            <img
              src={p.imageUrl}
              alt={p.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div
              style={{
                color: "var(--muted)",
                fontWeight: 900,
                fontSize: "3.5rem",
                opacity: 0.5
              }}
            >
              {getInitials(p.name)}
            </div>
          )}
        </div>

        {/* Bare gjester får chugs nederst */}
        {showChugCount && (
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
              color: "var(--muted)",
              fontSize: 13,
              fontWeight: 700
            }}
          >
            <span>{chugCount} chugs</span>
          </div>
        )}
      </button>
    );
  };

  return (
    <div style={{ paddingBottom: 60 }}>
      <h1>Grotta</h1>
      <p>Grottamedlemmer. Trykk på et kort for profil.</p>

      {/* Faste */}
      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
          gap: 14
        }}
      >
        {regularCards.map(p => renderCard(p, false))}

        {!regularCards.length && (
          <div style={{ color: "var(--muted)" }}>
            Ingen grottamedlemmer registrert enda.
          </div>
        )}
      </div>

      {/* Toggle guests */}
      <div style={{ marginTop: 40, textAlign: "center" }}>
        <button
          className="btn"
          onClick={() => setShowGuests(!showGuests)}
          style={{ padding: "10px 20px", fontSize: "1rem" }}
        >
          {showGuests ? "Skjul gjester" : "Vis gjester"}
        </button>
      </div>

      {/* Guests section */}
      {showGuests && (
        <div style={{ marginTop: 30 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              borderBottom: "1px solid var(--border)",
              paddingBottom: 10
            }}
          >
            <h2 style={{ margin: 0 }}>Gjester</h2>

            {/* Finere sorteringsknapp */}
            <button
              className="btn"
              onClick={() => setGuestSortMode(prev => (prev === "alpha" ? "chugs" : "alpha"))}
              title={guestSortMode === "alpha" ? "Sorter gjester etter antall chugs" : "Sorter gjester alfabetisk"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.07)"
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(255,255,255,0.08)",
                  fontSize: 15,
                  fontWeight: 900
                }}
              >
                {guestSortMode === "alpha" ? "A" : "🏆"}
              </span>

              <span style={{ fontWeight: 700 }}>
                {guestSortMode === "alpha" ? "Alfabetisk" : "Flest chugs"}
              </span>

              <span style={{ color: "var(--muted)", fontSize: 12 }}>
                ⇅
              </span>
            </button>
          </div>

          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
              gap: 14
            }}
          >
            {guestCards.map(p => renderCard(p, true))}

            {!guestCards.length && (
              <div style={{ color: "var(--muted)" }}>
                Ingen gjester registrert enda.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
