import { Router } from "express";
import { prisma } from "../prisma";

export const attemptsRouter = Router();

// POST /api/attempts/upsert
// body: { participantId, sessionId, seconds, note }
attemptsRouter.post("/upsert", async (req, res) => {
  const { participantId, sessionId, seconds, note } = req.body as {
    participantId: string;
    sessionId: string;
    seconds: number;
    note?: string | null;
  };

  if (!participantId || !sessionId || typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return res.status(400).json({ error: "Bad input" });
  }

  const saved = await prisma.attempt.upsert({
    where: { participantId_sessionId: { participantId, sessionId } },
    update: { seconds, note: note?.trim() ? note.trim() : null },
    create: { participantId, sessionId, seconds, note: note?.trim() ? note.trim() : null }
  });

  res.json(saved);
});