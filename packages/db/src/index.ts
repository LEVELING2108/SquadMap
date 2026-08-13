import { PrismaClient } from "../prisma/generated";

export * from "../prisma/generated";

export function createPrismaClient() {
  return new PrismaClient();
}

const prisma = createPrismaClient();
export default prisma;



