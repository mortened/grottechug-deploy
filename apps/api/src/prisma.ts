import "./env.js";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import { appEnv } from "./env.js";

const adapter = appEnv.tursoDatabaseUrl
  ? new PrismaLibSQL({
      url: appEnv.tursoDatabaseUrl,
      authToken: appEnv.tursoAuthToken || undefined,
    })
  : undefined;

export const prisma = adapter ? new PrismaClient({ adapter }) : new PrismaClient();
