import { cookies } from "next/headers";
import { verifyAuthToken } from "./auth/auth";

export async function requireAuth() {
  const token = (await cookies()).get("auth_token")?.value;
  if (!token) throw new Error("NOT_AUTHENTICATED");
  return await verifyAuthToken(token);
}

export async function requireAdmin() {
  const me = await requireAuth();
  if (me.type !== "admin" || me.role !== "admin") throw new Error("FORBIDDEN");
  return me;
}