import { PrismaClient } from "@prisma/client";

// In dev, Next.js reloads files often. Without this, every reload would
// open a new database connection. We stash the client on the global
// object so it survives reloads.
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
