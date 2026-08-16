import { env } from "@my-better-t-app/env/server";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../prisma/generated";

export * from "../prisma/generated";

const dbUrl = process.env.DATABASE_URL || env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/squadmap";

const pool = new pg.Pool({
  connectionString: dbUrl,
  connectionTimeoutMillis: 1500,
});

// Suppress unhandled pool error events when PostgreSQL is offline or unreachable
pool.on("error", (err) => {
  console.warn("PostgreSQL Pool connection error (falling back to memory store):", err.message);
});

const adapter = new PrismaPg(pool);
const realPrisma = new PrismaClient({ adapter });

// In-Memory Fallback Store (for when PostgreSQL is offline or unreachable)
const memoryStore = {
  sessions: new Map<string, any>(),
  participants: new Map<string, any>(),
  messages: new Map<string, any>(),
};

export const prisma = new Proxy(realPrisma, {
  get(target, prop, receiver) {
    if (prop === "session") {
      return {
        create: async (args: any) => {
          try {
            return await realPrisma.session.create(args);
          } catch (err: any) {
            console.warn("PostgreSQL unavailable, using in-memory store fallback:", err.message);
            const id = `mem_session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const code = args.data.code;
            const now = new Date();
            const hostPartId = `mem_part_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const hostPart = {
              id: hostPartId,
              sessionId: id,
              displayName: args.data.participants.create.displayName,
              color: args.data.participants.create.color || "#059669",
              isHost: true,
              isArrived: false,
              lastLat: null,
              lastLng: null,
              lastSeenAt: now,
              joinedAt: now,
            };
            memoryStore.participants.set(hostPartId, hostPart);

            const sessionObj = {
              id,
              code,
              title: args.data.title,
              destinationName: args.data.destinationName,
              destinationLat: args.data.destinationLat,
              destinationLng: args.data.destinationLng,
              hostId: hostPartId,
              isActive: true,
              expiresAt: args.data.expiresAt,
              createdAt: now,
              updatedAt: now,
              participants: [hostPart],
              messages: [],
            };

            memoryStore.sessions.set(code, sessionObj);
            memoryStore.sessions.set(id, sessionObj);
            return sessionObj;
          }
        },
        findUnique: async (args: any) => {
          try {
            return await realPrisma.session.findUnique(args);
          } catch {
            const key = args.where?.code || args.where?.id;
            const s = memoryStore.sessions.get(key);
            if (!s) return null;
            const parts = Array.from(memoryStore.participants.values()).filter((p) => p.sessionId === s.id);
            const msgs = Array.from(memoryStore.messages.values())
              .filter((m) => m.sessionId === s.id)
              .map((m) => ({
                ...m,
                participant: memoryStore.participants.get(m.participantId),
              }));
            return {
              ...s,
              participants: parts,
              messages: msgs,
            };
          }
        },
        update: async (args: any) => {
          try {
            return await realPrisma.session.update(args);
          } catch {
            const id = args.where?.id;
            const s = memoryStore.sessions.get(id);
            if (s) {
              Object.assign(s, args.data);
            }
            return s;
          }
        },
      };
    }

    if (prop === "participant") {
      return {
        create: async (args: any) => {
          try {
            return await realPrisma.participant.create(args);
          } catch {
            const id = `mem_part_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const now = new Date();
            const partObj = {
              id,
              sessionId: args.data.sessionId,
              displayName: args.data.displayName,
              color: args.data.color || "#059669",
              isHost: args.data.isHost || false,
              isArrived: false,
              lastLat: null,
              lastLng: null,
              lastSeenAt: now,
              joinedAt: now,
            };
            memoryStore.participants.set(id, partObj);

            const s = memoryStore.sessions.get(args.data.sessionId);
            if (s && !s.participants.some((p: any) => p.id === id)) {
              s.participants.push(partObj);
            }

            return partObj;
          }
        },
        update: async (args: any) => {
          try {
            return await realPrisma.participant.update(args);
          } catch {
            const id = args.where?.id;
            const p = memoryStore.participants.get(id);
            if (p) {
              Object.assign(p, args.data);
            }
            return p;
          }
        },
      };
    }

    if (prop === "message") {
      return {
        create: async (args: any) => {
          try {
            return await realPrisma.message.create(args);
          } catch {
            const id = `mem_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const now = new Date();
            const msgObj = {
              id,
              sessionId: args.data.sessionId,
              participantId: args.data.participantId,
              content: args.data.content,
              createdAt: now,
            };
            memoryStore.messages.set(id, msgObj);
            const part = memoryStore.participants.get(args.data.participantId);
            return {
              ...msgObj,
              participant: part,
            };
          }
        },
      };
    }

    return Reflect.get(target, prop, receiver);
  },
});

export default prisma;
