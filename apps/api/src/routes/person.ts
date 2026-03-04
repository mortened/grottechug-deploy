import { Router } from "express";
import { prisma } from "../prisma";

export const personRouter = Router();

// GET /api/person/:id?semester=2026V|2025H|all
personRouter.get("/:id", async (req, res) => {
  const id = req.params.id;
  const semester = String(req.query.semester ?? "all");

  const p = await prisma.participant.findUnique({ where: { id } });
  if (!p) return res.status(404).json({ error: "Not found" });

  const sessions = await prisma.session.findMany({
    where: semester === "all" ? {} : { semester },
    orderBy: { date: "asc" }
  });
  const sessionIds = sessions.map(s => s.id);

  const attempts = await prisma.attempt.findMany({
    where: { participantId: id, sessionId: { in: sessionIds } },
    include: { session: true },
    orderBy: { session: { date: "asc" } }
  });

  const points = attempts.map(a => ({
    dateISO: a.session.date.toISOString(),
    seconds: a.seconds,
    note: a.note ?? null
  }));

  const times = points.map(x => x.seconds);
  const best = times.length ? Math.min(...times) : null;
  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;

  const cleanTimes = points.filter(x => !x.note).map(x => x.seconds);
  const bestClean = cleanTimes.length ? Math.min(...cleanTimes) : null;

  res.json({
    participant: { id: p.id, name: p.name, isRegular: p.isRegular },
    semester,
    points,
    stats: {
      attempts: times.length,
      best,
      avg,
      bestClean
    }
  });
});