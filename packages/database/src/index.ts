import { Prisma, PrismaClient } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";

export { Prisma, PrismaClient };

export function createId(): string {
  return uuidv7();
}

export function createDatabaseClient(): PrismaClient {
  return new PrismaClient();
}

export const prisma = createDatabaseClient();
