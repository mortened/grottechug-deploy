import "./env.js";
import { prisma } from "./prisma.js";

type AdminSeed = {
  email: string;
  password: string;
  name: string;
};

function getAdminSeeds(): AdminSeed[] {
  const seeds = [1, 2].map((index) => {
    const email = process.env[`ADMIN_${index}_EMAIL`]?.trim() ?? "";
    const password = process.env[`ADMIN_${index}_PASSWORD`]?.trim() ?? "";
    const name = process.env[`ADMIN_${index}_NAME`]?.trim() || `Admin ${index}`;

    if (!email && !password) {
      return null;
    }

    if (!email || !password) {
      throw new Error(`ADMIN_${index}_EMAIL and ADMIN_${index}_PASSWORD must both be set`);
    }

    return { email, password, name };
  });

  return seeds.filter((seed): seed is AdminSeed => seed !== null);
}

async function seedAdmins() {
  const adminSeeds = getAdminSeeds();

  if (adminSeeds.length === 0) {
    console.log("No admin credentials configured, skipping admin user seed.");
    return;
  }

  process.env.AUTH_ALLOW_SIGNUP = "true";
  const { auth } = await import("./auth.js");

  for (const admin of adminSeeds) {
    const existingUser = await prisma.user.findUnique({
      where: { email: admin.email },
    });

    if (!existingUser) {
      const created = await auth.api.signUpEmail({
        body: {
          email: admin.email,
          name: admin.name,
          password: admin.password,
        },
      });

      await prisma.user.update({
        where: { id: created.user.id },
        data: {
          emailVerified: true,
          role: "admin",
        },
      });

      console.log(`Created admin user ${admin.email}`);
      continue;
    }

    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        emailVerified: true,
        name: admin.name,
        role: "admin",
      },
    });

    console.log(`Updated admin user ${admin.email}`);
  }
}

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

  await seedAdmins();
}

main().finally(async () => prisma.$disconnect());
