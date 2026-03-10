import { Router } from "express";
import { prisma } from "../prisma.js";

export const leaderboardRouter = Router();

// GET /api/leaderboard?semester=2026V|2025H|all
leaderboardRouter.get("/", async (req, res) => {
  const semester = String(req.query.semester ?? "all");

  const sessions = await prisma.session.findMany({
    where: semester === "all" ? {} : { semester },
    select: { id: true }
  });
  const sessionIds = sessions.map(s => s.id);

  if (!sessionIds.length) {
    return res.json({ semester, rows: [] });
  }

  const attempts = await prisma.attempt.findMany({
    where: {
      sessionId: { in: sessionIds },
      // NY LOGIKK: "clean" er nå enten ingenting, "mm-chug" eller "mm"
      OR: [
        { note: null },
        { note: "" },
        { note: "mm-chug" },
        { note: "mm" }
      ]
    },
    include: {
      participant: { select: { id: true, name: true, isRegular: true, imageUrl: true } },
      session: { select: { date: true } }
    }
  });

  const bestBy: Record<
    string,
    {
      participantId: string;
      name: string;
      isRegular: boolean;
      imageUrl: string | null;
      bestClean: number;
      dateISO: string;
      sessionId: string; // NY!
    }
  > = {};

  for (const a of attempts) {
    const pid = a.participant.id;
    const entry = bestBy[pid];

    if (!entry || a.seconds < entry.bestClean) {
      bestBy[pid] = {
        participantId: pid,
        name: a.participant.name,
        isRegular: a.participant.isRegular,
        imageUrl: a.participant.imageUrl ?? null,
        bestClean: a.seconds,
        dateISO: a.session.date.toISOString(),
        sessionId: a.sessionId // NY! Henter ID-en til sessionen herfra
      };
    }
  }

  const rows = Object.values(bestBy).sort((x, y) => x.bestClean - y.bestClean);
  res.json({ semester, rows });
});
