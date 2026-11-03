import jwt from "jsonwebtoken";

export interface AccessTokenPayload {
  sub: string; // userId
  email: string;
}

// Read env vars lazily (inside functions) rather than into module-level
// consts — those get evaluated at import time, which can run before
// dotenv has populated process.env depending on import order.
function accessSecret(): string {
  return process.env.JWT_ACCESS_SECRET as string;
}
function refreshSecret(): string {
  return process.env.JWT_REFRESH_SECRET as string;
}
function accessExpiresIn(): string {
  return process.env.JWT_ACCESS_EXPIRES_IN || "15m";
}
function refreshExpiresIn(): string {
  return process.env.JWT_REFRESH_EXPIRES_IN || "7d";
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, accessSecret(), { expiresIn: accessExpiresIn() } as jwt.SignOptions);
}

export function signRefreshToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, refreshSecret(), { expiresIn: refreshExpiresIn() } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, accessSecret()) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): AccessTokenPayload {
  return jwt.verify(token, refreshSecret()) as AccessTokenPayload;
}

export function refreshExpiryDate(): Date {
  const days = parseInt(refreshExpiresIn().replace(/\D/g, "")) || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
