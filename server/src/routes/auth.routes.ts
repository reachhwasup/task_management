import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshExpiryDate,
} from "../lib/jwt";
import { requireAuth } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { slugify, withRandomSuffix } from "../utils/slugify";
import type { User } from "@prisma/client";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  workspaceName: z.string().min(1).max(80).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const googleSchema = z.object({
  credential: z.string().min(1),
});

const REFRESH_COOKIE = "refreshToken";

// Lazily constructed: reading GOOGLE_CLIENT_ID at import time would run into
// the same dotenv load-order trap as lib/jwt.ts (see there for why).
let googleClient: OAuth2Client | null = null;
function getGoogleClient(): OAuth2Client {
  if (!googleClient) googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  return googleClient;
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: refreshExpiryDate(),
    path: "/api/auth",
  });
}

function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarColor: user.avatarColor,
    avatarUrl: user.avatarUrl,
  };
}

async function issueSession(user: User, res: Response) {
  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const refreshToken = signRefreshToken({ sub: user.id, email: user.email });
  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiryDate() },
  });
  setRefreshCookie(res, refreshToken);
  return accessToken;
}

async function createPersonalWorkspace(user: User, requestedName?: string) {
  const baseSlug = slugify(requestedName || `${user.name}'s Workspace`);
  let slug = baseSlug;
  if (await prisma.workspace.findUnique({ where: { slug } })) {
    slug = withRandomSuffix(baseSlug);
  }
  return prisma.workspace.create({
    data: {
      name: requestedName || `${user.name}'s Workspace`,
      slug,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });
}

router.post("/register", async (req, res) => {
  const data = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new ApiError(409, "An account with this email already exists");

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, passwordHash },
  });

  // Every new user gets a personal workspace to start in, like Asana's default org.
  const workspace = await createPersonalWorkspace(user, data.workspaceName);
  const accessToken = await issueSession(user, res);

  res.status(201).json({ user: publicUser(user), accessToken, workspace });
});

router.post("/login", async (req, res) => {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) throw new ApiError(401, "Invalid email or password");
  if (!user.passwordHash) {
    throw new ApiError(401, "This account uses Google sign-in. Use the Google button to log in.");
  }

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) throw new ApiError(401, "Invalid email or password");

  const accessToken = await issueSession(user, res);
  res.json({ user: publicUser(user), accessToken });
});

router.post("/google", async (req, res) => {
  const { credential } = googleSchema.parse(req.body);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new ApiError(500, "Google sign-in is not configured on this server");

  let payload;
  try {
    const ticket = await getGoogleClient().verifyIdToken({ idToken: credential, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    throw new ApiError(401, "Invalid Google credential");
  }
  if (!payload?.sub || !payload.email) throw new ApiError(401, "Invalid Google credential");
  if (!payload.email_verified) throw new ApiError(401, "Google email is not verified");

  let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });

  if (!user) {
    // Link to an existing password account with the same email, if any.
    const existingByEmail = await prisma.user.findUnique({ where: { email: payload.email } });
    if (existingByEmail) {
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          googleId: payload.sub,
          avatarUrl: existingByEmail.avatarUrl ?? payload.picture ?? null,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name || payload.email.split("@")[0],
          googleId: payload.sub,
          avatarUrl: payload.picture ?? null,
        },
      });
      await createPersonalWorkspace(user);
    }
  }

  const accessToken = await issueSession(user, res);
  res.json({ user: publicUser(user), accessToken });
});

router.post("/refresh", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw new ApiError(401, "No refresh token");

  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.expiresAt < new Date()) {
    throw new ApiError(401, "Refresh token expired or invalid");
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new ApiError(401, "Refresh token invalid");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new ApiError(401, "User not found");

  // Rotate the refresh token.
  await prisma.refreshToken.delete({ where: { token } });
  const accessToken = await issueSession(user, res);
  res.json({ accessToken, user: publicUser(user) });
});

router.post("/logout", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    await prisma.refreshToken.deleteMany({ where: { token } });
  }
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
  res.status(204).send();
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) throw new ApiError(404, "User not found");
  res.json({ user: publicUser(user) });
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  avatarColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

router.patch("/me", requireAuth, async (req, res) => {
  const data = updateProfileSchema.parse(req.body);
  const user = await prisma.user.update({ where: { id: req.userId }, data });
  res.json({ user: publicUser(user) });
});

export default router;
