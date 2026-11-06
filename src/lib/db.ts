import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { databaseMixUp } from "./db-guard";

const mixUp = databaseMixUp(process.env.APP_ENV, process.env.DATABASE_URL);
if (mixUp) throw new Error(mixUp);

const g = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient =
  g.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
if (process.env.NODE_ENV !== "production") g.prisma = db;

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
