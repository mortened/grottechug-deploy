import { prisma } from "./prisma";

async function main() {
  const rules = [
    { code: "ABSENCE", label: "Fravær", crosses: 2, details: "Ikke til stede" },
    { code: "REMOTE", label: "Remote (teller som fravær)", crosses: 2, details: "Remote" },
    { code: "VIDEO", label: "Video (teller som fravær)", crosses: 2, details: "Video" },
    { code: "MM", label: "Mildly moist", crosses: 0.5, details: "Litt søl" },
    { code: "W", label: "W-chug (wet)", crosses: 1, details: "Mer søl" }
  ];

  for (const r of rules) {
    await prisma.rule.upsert({ where: { code: r.code }, update: r, create: r });
  }
}

main().finally(async () => prisma.$disconnect());