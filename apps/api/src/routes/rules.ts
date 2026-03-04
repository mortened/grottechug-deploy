import { Router } from "express";
import { prisma } from "../prisma";

export const rulesRouter = Router();

async function seedRulesIfEmpty() {
  const count = await prisma.rule.count();
  if (count > 0) return;

  const rules = [
    { code: "DNS", label: "DNS-chug", crosses: 3, details: "Å være på Geogrotta uten å delta på chugging" },
    { code: "DNF", label: "Tobias-chug", crosses: 2, details: "Ikke fullføre chuggen innen 25 sek" },
    { code: "MM", label: "mm-chug", crosses: 0.5, details: "Mildly Moist chug, er å anse som et gult kort, 2 mm-chug på rad og man får kryss" },
    { code: "W", label: "w-chug", crosses: 1, details: "Wet chug, er å søle øl under chugging" },
    { code: "VW", label: "vw-chug", crosses: 2, details: "Very wet chug, er å søle en betydelig mengde øl under chugging eller å ha litt øl igjen i glasset" },
    { code: "P", label: "p-chug", crosses: 1, details: "Pause chug, er å måtte ta pause under chugging" },
    { code: "ABSENCE", label: "Fravær", crosses: 2, details: "Ikke tilstede på chugging" },
    { code: "VOMIT", label: "Oppkast", crosses: 4, details: "Oppkast under chugging" },
    { code: "KPR", label: "KPR", crosses: 1, details: "Klage-På-Regel, er dersom man klager på regler under chugging" }
  ];

  for (const r of rules) {
    await prisma.rule.upsert({ where: { code: r.code }, update: r, create: r });
  }
}

// GET all
rulesRouter.get("/", async (_req, res) => {
  await seedRulesIfEmpty();
  const rules = await prisma.rule.findMany({
                orderBy: [{ crosses: "desc" }, { code: "asc" }]
              });
  res.json(rules);
});

// PUT update existing by code
rulesRouter.put("/:code", async (req, res) => {
  const code = String(req.params.code).trim();

  const label = typeof req.body?.label === "string" ? req.body.label.trim() : undefined;
  const details = typeof req.body?.details === "string" ? req.body.details : undefined;
  const crossesRaw = req.body?.crosses;

  let crosses: number | undefined = undefined;
  if (crossesRaw !== undefined) {
    const c = Number(crossesRaw);
    if (!Number.isFinite(c)) return res.status(400).json({ error: "crosses must be a number" });
    crosses = c;
  }

  const updated = await prisma.rule.update({
    where: { code },
    data: {
      ...(label !== undefined ? { label } : {}),
      ...(details !== undefined ? { details } : {}),
      ...(crosses !== undefined ? { crosses } : {})
    }
  });

  res.json(updated);
});

// POST create new rule
rulesRouter.post("/", async (req, res) => {
  const code = String(req.body?.code ?? "").trim();
  const label = String(req.body?.label ?? "").trim();
  const details = String(req.body?.details ?? "");
  const crosses = Number(req.body?.crosses);

  if (!code || !label || !Number.isFinite(crosses)) {
    return res.status(400).json({ error: "Need code, label, crosses" });
  }

  const created = await prisma.rule.create({ data: { code, label, crosses, details } });
  res.json(created);
});