import { publicProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import prisma from "@my-better-t-app/db";

const AVATAR_COLORS = [
  "#EF4444", // Red
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
];

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

export const sessionRouter = router({
  createSession: publicProcedure
    .input(
      z.object({
        hostDisplayName: z.string().min(2).max(30),
        destinationName: z.string().min(2).max(100),
        destinationLat: z.number(),
        destinationLng: z.number(),
        title: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const code = generateRoomCode();
        const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours

        const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!;

        const session = await prisma.session.create({
          data: {
            code,
            title: input.title || `Trip to ${input.destinationName}`,
            destinationName: input.destinationName,
            destinationLat: input.destinationLat,
            destinationLng: input.destinationLng,
            expiresAt,
            participants: {
              create: {
                displayName: input.hostDisplayName,
                color,
                isHost: true,
              },
            },
          },
          include: {
            participants: true,
          },
        });

        const hostParticipant = session.participants[0]!;

        await prisma.session.update({
          where: { id: session.id },
          data: { hostId: hostParticipant.id },
        });

        return {
          session,
          participant: hostParticipant,
        };
      } catch (err: any) {
        console.error("DB Error in createSession:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message || "Failed to create trip session room",
        });
      }
    }),


  getSession: publicProcedure
    .input(
      z.object({
        code: z.string(),
      })
    )
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        include: {
          participants: {
            orderBy: { joinedAt: "asc" },
          },
          messages: {
            orderBy: { createdAt: "asc" },
            take: 50,
            include: {
              participant: true,
            },
          },
        },
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session room not found",
        });
      }

      if (!session.isActive || new Date() > session.expiresAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This trip session has expired",
        });
      }

      return session;
    }),

  joinSession: publicProcedure
    .input(
      z.object({
        code: z.string(),
        displayName: z.string().min(2).max(30),
      })
    )
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        include: { participants: true },
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session room not found",
        });
      }

      if (!session.isActive || new Date() > session.expiresAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This trip session has expired",
        });
      }

      // Choose color not heavily used
      const color = AVATAR_COLORS[session.participants.length % AVATAR_COLORS.length]!;

      const participant = await prisma.participant.create({
        data: {
          sessionId: session.id,
          displayName: input.displayName,
          color,
          isHost: false,
        },
      });

      return {
        session,
        participant,
      };
    }),

  updateLocation: publicProcedure
    .input(
      z.object({
        participantId: z.string(),
        lat: z.number(),
        lng: z.number(),
        speed: z.number().optional(),
        accuracy: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const participant = await prisma.participant.findUnique({
        where: { id: input.participantId },
        include: { session: true },
      });

      if (!participant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Participant not found" });
      }

      // Check if participant is within 100m of destination (approx 0.001 deg lat/lng)
      const dLat = Math.abs(participant.session.destinationLat - input.lat);
      const dLng = Math.abs(participant.session.destinationLng - input.lng);
      const isArrived = dLat < 0.001 && dLng < 0.001;

      const updated = await prisma.participant.update({
        where: { id: input.participantId },
        data: {
          lastLat: input.lat,
          lastLng: input.lng,
          lastSpeed: input.speed || null,
          lastAccuracy: input.accuracy || null,
          lastSeenAt: new Date(),
          isArrived: isArrived || participant.isArrived,
        },
      });

      return updated;
    }),

  sendMessage: publicProcedure
    .input(
      z.object({
        code: z.string(),
        participantId: z.string(),
        content: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
      });

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session room not found" });
      }

      const message = await prisma.message.create({
        data: {
          sessionId: session.id,
          participantId: input.participantId,
          content: input.content.trim(),
        },
        include: {
          participant: true,
        },
      });

      return message;
    }),
});

