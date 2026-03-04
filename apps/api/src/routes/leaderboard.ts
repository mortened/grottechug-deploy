import { Router } from "express";
import { prisma } from "../prisma";

export const leaderboardRouter = Router();

// GET /api/leaderboard?semester=2026V|2025H|all
leaderboardRouter.get("/", async (req, res) => {
  const semester = String(req.query.semester ?? "all");

  const sessions = await prisma.session.findMany({
    where: semester === "all" ? {} : { semester },
    select: { id: true }
  });
  const sessionIds = sessions.map(s => s.id);

  const attempts = await prisma.attempt.findMany({
    where: {
      sessionId: { in: sessionIds },
      OR: [{ note: null }, { note: "" }]
    },
    include: { participant: true, session: true }
  });

  // best clean per participant
  const bestBy: Record<string, { participantId: string; name: string; bestClean: number; dateISO: string }> = {};
  for (const a of attempts) {
    const pid = a.participantId;
    const entry = bestBy[pid];
    if (!entry || a.seconds < entry.bestClean) {
      bestBy[pid] = {
        participantId: pid,
        name: a.participant.name,
        bestClean: a.seconds,
        dateISO: a.session.date.toISOString()
      };
    }
  }

  const rows = Object.values(bestBy).sort((x, y) => x.bestClean - y.bestClean);
  res.json({ semester, rows });
});