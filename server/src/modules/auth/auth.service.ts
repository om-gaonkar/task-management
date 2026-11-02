import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { AppError } from "../../shared/errors/app-error.js";
import { User } from "../users/user.model.js";
import { EmailVerificationToken, Session } from "./auth.model.js";
import { env } from "../../config/env.js";

const SESSION_COOKIE = "pw_session";
const CSRF_COOKIE = "pw_csrf";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

function cookieOptions(httpOnly: boolean) {
  return {
    httpOnly,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: "/api/v1",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    maxAge: SESSION_TTL_MS
  } as const;
}

function setSessionCookies(res: Response, secret: string, csrf: string) {
  res.cookie(SESSION_COOKIE, secret, cookieOptions(true));
  res.cookie(CSRF_COOKIE, csrf, cookieOptions(false));
}

export function clearSessionCookies(res: Response) {
  const options = cookieOptions(true);
  res.clearCookie(SESSION_COOKIE, options);
  res.clearCookie(CSRF_COOKIE, { ...options, httpOnly: false });
}

function publicUser(user: { _id: Types.ObjectId; name: string; email: string; avatarUrl?: string | null; preferences?: unknown }) {
  return { id: user._id.toString(), name: user.name, email: user.email, avatarUrl: user.avatarUrl ?? null, preferences: user.preferences ?? {} };
}

async function issueSession(userId: Types.ObjectId, req: Request, res: Response) {
  const secret = randomBytes(48).toString("base64url");
  const csrf = randomBytes(32).toString("base64url");
  await Session.create({
    userId,
    secretHash: digest(secret),
    csrfHash: digest(csrf),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    userAgent: req.get("user-agent")?.slice(0, 500) ?? null,
    ipAddress: req.ip ?? null
  });
  setSessionCookies(res, secret, csrf);
}

export async function register(input: { name: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const exists = await User.exists({ email });
  if (exists) throw new AppError("An account with this email already exists", 409, "EMAIL_EXISTS");
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const user = await User.create({ name: input.name.trim(), email, passwordHash });
  const raw = randomBytes(32).toString("base64url");
  await EmailVerificationToken.create({
    userId: user._id,
    tokenHash: digest(raw),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000)
  });
  // Email delivery is deliberately an adapter boundary; never return the verification token in production.
  return { user: publicUser(user), verificationQueued: false, developmentVerificationToken: env.NODE_ENV === "development" ? raw : undefined };
}

export async function login(input: { email: string; password: string }, req: Request, res: Response) {
  const user = await User.findOne({ email: input.email.toLowerCase().trim() }).select("+passwordHash");
  if (!user?.passwordHash || !user.isActive) throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  const valid = await argon2.verify(user.passwordHash, input.password);
  if (!valid) throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  if (!user.emailVerifiedAt) throw new AppError("Verify your email before signing in", 403, "EMAIL_NOT_VERIFIED");
  await issueSession(user._id, req, res);
  return publicUser(user);
}

export async function verifyEmail(token: string) {
  const tokenHash = digest(token);
  const verification = await EmailVerificationToken.findOne({ tokenHash, expiresAt: { $gt: new Date() } });
  if (!verification) throw new AppError("Verification link is invalid or expired", 400, "INVALID_VERIFICATION");
  const user = await User.findByIdAndUpdate(verification.userId, { $set: { emailVerifiedAt: new Date() } }, { new: true });
  await EmailVerificationToken.deleteMany({ userId: verification.userId });
  if (!user) throw new AppError("Account not found", 404, "USER_NOT_FOUND");
  return { verified: true };
}

export async function authenticateRequest(req: Request) {
  const secret = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!secret) throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
  const session = await Session.findOne({ secretHash: digest(secret), revokedAt: null, expiresAt: { $gt: new Date() } }).select("+csrfHash");
  if (!session) throw new AppError("Session is invalid or expired", 401, "SESSION_INVALID");
  return { userId: session.userId, sessionId: session._id.toString(), csrfHash: session.csrfHash };
}

export async function currentUser(userId: Types.ObjectId) {
  const user = await User.findOne({ _id: userId, isActive: true });
  if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");
  return publicUser(user);
}

export async function logout(req: Request, res: Response) {
  const secret = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (secret) await Session.updateOne({ secretHash: digest(secret), revokedAt: null }, { $set: { revokedAt: new Date() } });
  clearSessionCookies(res);
}

export async function refreshSession(req: Request, res: Response) {
  const secret = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!secret) throw new AppError("Session is invalid or expired", 401, "SESSION_INVALID");
  const secretHash = digest(secret);
  const nextSecret = randomBytes(48).toString("base64url");
  const nextCsrf = randomBytes(32).toString("base64url");
  const session = await Session.findOneAndUpdate(
    { secretHash, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { secretHash: digest(nextSecret), csrfHash: digest(nextCsrf), expiresAt: new Date(Date.now() + SESSION_TTL_MS), lastUsedAt: new Date() } },
    { new: true }
  );
  if (!session) throw new AppError("Session is invalid or already rotated", 401, "SESSION_INVALID");
  setSessionCookies(res, nextSecret, nextCsrf);
  return currentUser(session.userId);
}

export async function enforceCsrf(req: Request, csrfHash: string) {
  const supplied = req.get("x-csrf-token");
  if (!supplied || !safeEqual(digest(supplied), csrfHash)) throw new AppError("CSRF validation failed", 403, "CSRF_INVALID");
}
