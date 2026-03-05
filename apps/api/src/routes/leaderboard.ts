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

  // Hvis ingen sessions i semesteret, returner tomt
  if (!sessionIds.length) {
    return res.json({ semester, rows: [] });
  }

  const attempts = await prisma.attempt.findMany({
    where: {
      sessionId: { in: sessionIds },
      // "clean" = ingen anmerkning
      OR: [{ note: null }, { note: "" }]
    },
    include: {
      participant: { select: { id: true, name: true, isRegular: true, imageUrl: true } },
      session: { select: { date: true } }
    }
  });

  // best clean per participant
  const bestBy: Record<
    string,
    {
      participantId: string;
      name: string;
      isRegular: boolean;
      imageUrl: string | null;
      bestClean: number;
      dateISO: string;
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
        dateISO: a.session.date.toISOString()
      };
    }
  }

  const rows = Object.values(bestBy).sort((x, y) => x.bestClean - y.bestClean);
  res.json({ semester, rows });
});