import { Router } from "express";
import { prisma } from "../prisma";

export const analyticsRouter = Router();

type Semester = "all" | "2026V" | "2025H";

function norm(s: string) {
  return s.trim().toLowerCase();
}

function classifyNote(note: string | null) {
  if (!note || !note.trim()) return { has: false, mm: false, w: false, vw: false, p: false };
  const t = norm(note);
  return {
    has: true,
    mm: /\bmm\b/.test(t),
    vw: /\bvw\b/.test(t) || t.includes("very wet"),
    w: /\bw\b/.test(t) || t.includes("w-chug") || t.includes("wet"),
    p: /\bp\b/.test(t) || t.includes("p-chug")
  };
}

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function binHistogram(values: number[], binWidth = 0.5) {
  if (!values.length) return [];
  const min = Math.floor(Math.min(...values) / binWidth) * binWidth;
  const max = Math.ceil(Math.max(...values) / binWidth) * binWidth;

  const bins: { bin: string; from: number; to: number; count: number }[] = [];
  for (let x = min; x < max; x += binWidth) {
    bins.push({ bin: `${x.toFixed(1)}–${(x + binWidth).toFixed(1)}`, from: x, to: x + binWidth, count: 0 });
  }

  for (const v of values) {
    const idx = Math.min(bins.length - 1, Math.max(0, Math.floor((v - min) / binWidth)));
    bins[idx].count++;
  }

  return bins;
}

analyticsRouter.get("/", async (req, res) => {
  const semester = String(req.query.semester ?? "all") as Semester;

  const sessions = await prisma.session.findMany({
    where: semester === "all" ? {} : { semester },
    orderBy: { date: "asc" }
  });
  const sessionIds = sessions.map(s => s.id);

  const attempts = await prisma.attempt.findMany({
    where: { sessionId: { in: sessionIds } },
    include: { participant: true, session: true }
  });

  // Per day time series
  const byDay: Record<string, { dateISO: string; times: number[]; cleanTimes: number[]; notes: number; total: number }> = {};
  for (const a of attempts) {
    const dateISO = a.session.date.toISOString();
    if (!byDay[dateISO]) byDay[dateISO] = { dateISO, times: [], cleanTimes: [], notes: 0, total: 0 };
    byDay[dateISO].times.push(a.seconds);
    byDay[dateISO].total++;
    const c = classifyNote(a.note ?? null);
    if (c.has) byDay[dateISO].notes++;
    if (!c.has) byDay[dateISO].cleanTimes.push(a.seconds);
  }

  const timeSeries = Object.values(byDay)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
    .map(d => ({
      dateISO: d.dateISO,
      date: new Date(d.dateISO).toLocaleDateString(),
      avg: d.times.length ? mean(d.times) : null,
      bestClean: d.cleanTimes.length ? Math.min(...d.cleanTimes) : null,
      attempts: d.total,
      wetRate: d.total ? d.notes / d.total : 0
    }));

  // Note breakdown totals
  let mm = 0, w = 0, vw = 0, p = 0;
  for (const a of attempts) {
    const c = classifyNote(a.note ?? null);
    if (c.mm) mm++;
    if (c.w) w++;
    if (c.vw) vw++;
    if (c.p) p++;
  }

  // Histogram of times
  const allTimes = attempts.map(a => a.seconds);
  const histogram = binHistogram(allTimes, 0.5);

  // Top 10 by best clean (no note)
  const bestCleanBy: Record<string, { participantId: string; name: string; bestClean: number }> = {};
  for (const a of attempts) {
    const c = classifyNote(a.note ?? null);
    if (c.has) continue; // clean only
    const pid = a.participantId;
    const entry = bestCleanBy[pid];
    if (!entry || a.seconds < entry.bestClean) {
      bestCleanBy[pid] = { participantId: pid, name: a.participant.name, bestClean: a.seconds };
    }
  }
  const topClean = Object.values(bestCleanBy).sort((a, b) => a.bestClean - b.bestClean).slice(0, 10);

  res.json({
    semester,
    overview: {
      sessions: sessions.length,
      attempts: attempts.length
    },
    timeSeries,
    noteBreakdown: { mm, w, vw, p },
    histogram,
    topClean
  });
});