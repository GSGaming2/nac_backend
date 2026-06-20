import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
const admin_secret = new TextEncoder().encode(process.env.JWT_ADMIN_SECRET!);

export type AuthPayload = {
  sub: string; // user/admin id as string
  type: "user" | "admin";
  email: string;
  role: "user" | "admin";
};

export async function signAuthToken(payload: AuthPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyAuthToken(token: string) {
  let secretToUse = secret;
  if (token.includes("admin")) {
    secretToUse = admin_secret;
  }

  const { payload } = await jwtVerify(token, secretToUse);
  return payload as unknown as AuthPayload;
}