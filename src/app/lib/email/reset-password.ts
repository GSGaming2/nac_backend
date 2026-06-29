import bcrypt from "bcryptjs";
import crypto from "crypto";

import { prisma } from "@/app/lib/prisma";

export async function resetPassword(token: string, newPassword: string) {
  // Hash the incoming token for comparison
  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  // Find a valid, unused, non-expired reset token
  const record = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (!record) {
    throw new Error("INVALID_OR_EXPIRED_TOKEN");
  }

  // Hash the new password
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Find the account (User or Admin)
  const [user, admin] = await Promise.all([
    prisma.user.findUnique({
      where: {
        email: record.email,
      },
      select: {
        id: true,
      },
    }),

    prisma.admin.findUnique({
      where: {
        email: record.email,
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!user && !admin) {
    throw new Error("ACCOUNT_NOT_FOUND");
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (user) {
      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          passwordHash,

          // Future improvement:
          // tokenVersion: {
          //   increment: 1,
          // },
        },
      });
    }

    if (admin) {
      await tx.admin.update({
        where: {
          id: admin.id,
        },
        data: {
          passwordHash,

          // Future improvement:
          // tokenVersion: {
          //   increment: 1,
          // },
        },
      });
    }

    // Invalidate every active reset token for this email
    await tx.passwordResetToken.updateMany({
      where: {
        email: record.email,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });
  });

  return {
    email: record.email,
  };
}
