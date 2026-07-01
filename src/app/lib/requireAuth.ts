import { headers } from "next/headers";
import { verifyAuthToken } from "./auth/auth";

export async function requireAuth() {
  const authHeader = (await headers()).get("authorization");

  if (!authHeader) {
    throw new Error("NOT_AUTHENTICATED");
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("NOT_AUTHENTICATED");
  }

  const token = authHeader.substring(7).trim();

  if (!token) {
    throw new Error("NOT_AUTHENTICATED");
  }

  return await verifyAuthToken(token);
}

export async function requireAdmin() {
  const me = await requireAuth();

  if (me.type !== "admin" || me.role !== "admin") {
    throw new Error("FORBIDDEN");
  }

  return me;
}