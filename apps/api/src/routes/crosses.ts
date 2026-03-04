import { Router } from "express";
import { prisma } from "../prisma";

export const crossesRouter = Router();

// GET /api/crosses/summary?semester=2026V|2025H|all
crossesRouter.get("/summary", async (req, res) => {
  const semester = String(req.query.semester ?? "all");

  const sessions = await prisma.session.findMany({
    where: semester === "all" ? {} : { semester },
    select: { id: true }
  });
  const sessionIds = sessions.map(s => s.id);

  const violations = await prisma.violation.findMany({
    where: { sessionId: { in: sessionIds } },
    include: { participant: true }
  });

  const totals: Record<string, { participantId: string; name: string; isRegular: boolean; total: number; count: number }> =
    {};

  for (const v of violations) {
    const pid = v.participantId;
    if (!totals[pid]) {
      totals[pid] = {
        participantId: pid,
        name: v.participant.name,
        isRegular: v.participant.isRegular,
        total: 0,
        count: 0
      };
    }
    totals[pid].total += v.crosses;
    totals[pid].count += 1;
  }

  const rows = Object.values(totals).sort((a, b) => b.total - a.total);

  res.json({ semester, rows });
});