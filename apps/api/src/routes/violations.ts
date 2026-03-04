import { Router } from "express";
import { prisma } from "../prisma";

export const violationsRouter = Router();

// POST /api/violations/absence
violationsRouter.post("/absence", async (req, res) => {
  const { participantId, sessionDateISO, ruleCode, reason } = req.body as {
    participantId: string;
    sessionDateISO: string;
    ruleCode: string; // ABSENCE/REMOTE/VIDEO
    reason?: string;
  };

  const date = new Date(sessionDateISO);
  if (!participantId || Number.isNaN(date.getTime())) return res.status(400).json({ error: "Bad input" });

  const rule = await prisma.rule.findUnique({ where: { code: ruleCode } });
  if (!rule) return res.status(400).json({ error: `Unknown rule: ${ruleCode}` });

  // Finn session på dato – hvis ikke finnes, lag semester="UNKNOWN" (blir rettet av import senere)
  const session = await prisma.session.upsert({
    where: { date },
    update: {},
    create: { date, semester: "UNKNOWN" }
  });

  const v = await prisma.violation.create({
    data: {
      participantId,
      sessionId: session.id,
      ruleCode: rule.code,
      crosses: rule.crosses,
      reason: reason ?? null
    }
  });

  res.json(v);
});

// GET /api/violations
violationsRouter.get("/", async (_req, res) => {
  const items = await prisma.violation.findMany({
    orderBy: { createdAt: "desc" },
    include: { participant: true, session: true }
  });

  res.json(items.map(v => ({
    id: v.id,
    participantName: v.participant.name,
    dateISO: v.session.date.toISOString(),
    ruleCode: v.ruleCode,
    crosses: v.crosses,
    reason: v.reason
  })));
});