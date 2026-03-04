import { Router } from "express";
import { prisma } from "../prisma";

export const statsRouter = Router();

statsRouter.get("/table", async (req, res) => {
  const semester = String(req.query.semester ?? "2026V");
  const sessionWhere = semester === "all" ? {} : { semester };

  const sessions = await prisma.session.findMany({
    where: sessionWhere,
    orderBy: { date: "asc" }
  });

  const people = await prisma.participant.findMany({
    orderBy: [{ isRegular: "desc" }, { name: "asc" }]
  });

  const sessionIds = sessions.map((s: Session) => s.id);

  const attempts = await prisma.attempt.findMany({
    where: { sessionId: { in: sessionIds } }
  });

  const cells: Record<string, Record<string, { seconds: number | null; note: string | null }>> = {};
  const nums: Record<string, number[]> = {};

  for (const p of people) {
    cells[p.id] = {};
    nums[p.id] = [];
    for (const s of sessions) cells[p.id][s.id] = { seconds: null, note: null };
  }

  for (const a of attempts) {
    nums[a.participantId].push(a.seconds);
    const cell = cells[a.participantId]?.[a.sessionId];
    if (!cell) continue;
    cell.seconds = a.seconds;
    cell.note = a.note ?? null;
  }

  const rows = people.map(p => {
    const arr = nums[p.id];
    const best = arr.length ? Math.min(...arr) : null;
    const avg = arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : null;
    return {
      participantId: p.id,
      name: p.name,
      isRegular: p.isRegular,
      bestOverall: best,
      avgOverall: avg
    };
  });

  res.json({
    semester,
    columns: sessions.map((s) => ({ sessionId: s.id, dateISO: s.date.toISOString() })),
    rows,
    cells
  });
});