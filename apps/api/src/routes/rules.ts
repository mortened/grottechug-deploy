import { Router } from "express";
import { prisma } from "../prisma";

export const rulesRouter = Router();

async function seedRulesIfEmpty() {
  const count = await prisma.rule.count();
  if (count > 0) return;

  const rules = [
    { code: "DNS", label: "DNS-chug", crosses: 3, details: null },
    { code: "DNF", label: "Tobias-chug/DNF-chug", crosses: 2, details: null },
    { code: "MM", label: "mm-chug", crosses: 0.5, details: null },
    { code: "W", label: "w-chug", crosses: 1, details: null },
    { code: "VW", label: "vw-chug", crosses: 2, details: null },
    { code: "P", label: "p-chug", crosses: 1, details: null },
    { code: "ABSENCE", label: "Fravær", crosses: 2, details: null },
    { code: "VOMIT", label: "Oppkast", crosses: 4, details: null },
    { code: "KPR", label: "KPR", crosses: 1, details: null }
  ];

  for (const r of rules) {
    await prisma.rule.upsert({ where: { code: r.code }, update: r, create: r });
  }
}

rulesRouter.get("/", async (_req, res) => {
  await seedRulesIfEmpty();
  const rules = await prisma.rule.findMany({ orderBy: { crosses: "desc" } });
  res.json(rules);
});