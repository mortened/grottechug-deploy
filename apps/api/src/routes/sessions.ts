import { Router } from "express";
import { prisma } from "../prisma";

export const sessionsRouter = Router();

// POST /api/sessions
// body: { dateISO: string, semester: "2026V"|"2025H" }
sessionsRouter.post("/", async (req, res) => {
  const { dateISO, semester } = req.body as { dateISO: string; semester: string };
  const date = new Date(dateISO);
  if (!semester || Number.isNaN(date.getTime())) return res.status(400).json({ error: "Bad input" });

  const created = await prisma.session.upsert({
    where: { date },
    update: { semester },
    create: { date, semester }
  });
  res.json(created);
});