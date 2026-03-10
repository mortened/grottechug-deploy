import { Router } from "express";
import { requireAdmin } from "../auth-middleware.js";
import { prisma } from "../prisma.js";

export const participantsRouter = Router();

/**
 * SEARCH (må ligge før /:id routes)
 * GET /api/participants/search?query=Maria
 */
participantsRouter.get("/search", async (req, res) => {
  const query = String(req.query.query ?? "").trim();
  if (!query) return res.json([]);

  const q = query.toLowerCase();

  const people = await prisma.participant.findMany({
    where: { nameLower: { contains: q } },
    orderBy: [{ isRegular: "desc" }, { name: "asc" }],
    take: 12,
    select: { id: true, name: true, isRegular: true, imageUrl: true }
  });

  res.json(people);
});

/**
 * GET /api/participants?includeGuests=true|false
 */
// participantsRouter.ts

participantsRouter.get("/", async (req, res) => {
  const includeGuests = req.query.includeGuests === "true";
  const where = includeGuests ? {} : { isRegular: true };

  const people = await prisma.participant.findMany({
    where,
    orderBy: [{ isRegular: "desc" }, { name: "asc" }],
    select: { 
      id: true, 
      name: true, 
      isRegular: true, 
      imageUrl: true,
      // Legg til denne for å telle antall forsøk
      _count: {
        select: { attempts: true }
      }
    }
  });

  // Mapper om resultatet slik at frontend får "attempts" som et flatt felt
  const formattedPeople = people.map(p => ({
    id: p.id,
    name: p.name,
    isRegular: p.isRegular,
    imageUrl: p.imageUrl,
    attempts: p._count.attempts
  }));

  res.json(formattedPeople);
});

/**
 * POST /api/participants/guest-upsert
 * body: { name: "Maria" }
 */
participantsRouter.post("/guest-upsert", requireAdmin, async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "Missing name" });

  const nameLower = name.toLowerCase();

  const p = await prisma.participant.upsert({
    where: { nameLower },
    update: {}, // behold som den er hvis finnes
    create: { name, nameLower, isRegular: false },
    select: { id: true, name: true, isRegular: true, imageUrl: true }
  });

  res.json(p);
});

/**
 * DELETE /api/participants/:id/hard
 * (må ligge før /:id)
 */
participantsRouter.delete("/:id/hard", requireAdmin, async (req, res) => {
  const id = String(req.params.id);

  await prisma.$transaction([
    prisma.attempt.deleteMany({ where: { participantId: id } }),
    prisma.violation.deleteMany({ where: { participantId: id } }),
    prisma.participant.delete({ where: { id } })
  ]);

  res.json({ ok: true });
});

/**
 * DELETE /api/participants/:id
 */
participantsRouter.delete("/:id", requireAdmin, async (req, res) => {
  await prisma.participant.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});
