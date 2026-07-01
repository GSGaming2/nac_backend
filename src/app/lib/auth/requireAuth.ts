import { headers } from "next/headers";
import { verifyAuthToken } from "@/app/lib/auth/auth";

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export async function requireAuth() {
  const authorization = (await headers()).get("authorization");

  if (!authorization) {
    throw new AuthError("Authorization header is missing.");
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer") {
    throw new AuthError("Invalid authorization scheme.");
  }

  if (!token) {
    throw new AuthError("Authentication token is missing.");
  }

  try {
    return await verifyAuthToken(token);
  } catch (error) {
    console.error("JWT Verification Error:", error);

    throw new AuthError("Invalid or expired authentication token.");
  }
}

export async function requireUser() {
  const auth = await requireAuth();

  if (auth.type !== "user") {
    throw new AuthError("Only users can access this resource.", 403);
  }

  return auth;
}

export async function requireAdmin() {
  const auth = await requireAuth();

  if (auth.type !== "admin" || auth.role !== "admin") {
    throw new AuthError("Administrator access required.", 403);
  }

  return auth;
}