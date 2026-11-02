import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { AppError } from "../../shared/errors/app-error.js";
import { User } from "../users/user.model.js";
import { EmailVerificationToken, PasswordResetToken, Session } from "./auth.model.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email.service.js";
import { env } from "../../config/env.js";

const SESSION_COOKIE = "pw_session";
const CSRF_COOKIE = "pw_csrf";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_TTL_MS = 30 * 60 * 1000;

const digest = (value: string) => createHmac("sha256", env.SESSION_SECRET).update(value).digest("hex");
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
  res.clearCookie(SESSION_COOKIE, cookieOptions(true));
  res.clearCookie(CSRF_COOKIE, cookieOptions(false));
}
function publicUser(user: { _id: Types.ObjectId; name: string; email: string; avatarUrl?: string | null; preferences?: unknown }) {
  return { id: user._id.toString(), name: user.name, email: user.email, avatarUrl: user.avatarUrl ?? null, preferences: user.preferences ?? {} };
}

export async function createSessionForUser(userId: Types.ObjectId, req: Request, res: Response) {
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

async function issueVerification(user: { _id: Types.ObjectId; email: string; name: string }) {
  await EmailVerificationToken.deleteMany({ userId: user._id });
  const raw = randomBytes(32).toString("base64url");
  await EmailVerificationToken.create({
    userId: user._id,
    tokenHash: digest(raw),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS)
  });
  const queued = await sendVerificationEmail(user.email, user.name, raw);
  return { verificationQueued: queued, developmentVerificationToken: !queued && env.NODE_ENV === "development" ? raw : undefined };
}

export async function register(input: { name: string; email: string; password: string }) {
  if (env.NODE_ENV === "production" && !env.smtpConfigured) {
    throw new AppError("Email delivery must be configured before registration is enabled", 503, "EMAIL_NOT_CONFIGURED");
  }
  const email = input.email.trim().toLowerCase();
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  let user;
  try {
    user = await User.create({ name: input.name.trim(), email, passwordHash });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new AppError("An account with this email already exists", 409, "EMAIL_EXISTS");
    throw error;
  }
  try {
    const verification = await issueVerification(user);
    return { user: publicUser(user), ...verification };
  } catch (error) {
    await EmailVerificationToken.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id, emailVerifiedAt: null });
    throw error;
  }
}

export async function resendVerification(emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  const user = await User.findOne({ email, emailVerifiedAt: null, isActive: true });
  if (!user) return { accepted: true };
  if (env.NODE_ENV === "production" && !env.smtpConfigured) return { accepted: true };
  const verification = await issueVerification(user);
  return { accepted: true, ...verification };
}

export async function login(input: { email: string; password: string }, req: Request, res: Response) {
  const user = await User.findOne({ email: input.email.toLowerCase().trim() }).select("+passwordHash");
  if (!user?.passwordHash || !user.isActive) throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  const valid = await argon2.verify(user.passwordHash, input.password);
  if (!valid) throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  if (!user.emailVerifiedAt) throw new AppError("Verify your email before signing in", 403, "EMAIL_NOT_VERIFIED");
  await createSessionForUser(user._id, req, res);
  return publicUser(user);
}

export async function verifyEmail(token: string) {
  const verification = await EmailVerificationToken.findOneAndDelete({
    tokenHash: digest(token),
    expiresAt: { $gt: new Date() },
    usedAt: null
  });
  if (!verification) throw new AppError("Verification link is invalid or expired", 400, "INVALID_VERIFICATION");
  const user = await User.findByIdAndUpdate(verification.userId, { $set: { emailVerifiedAt: new Date() } }, { new: true });
  if (!user) throw new AppError("Account not found", 404, "USER_NOT_FOUND");
  return { verified: true };
}

export async function authenticateRequest(req: Request) {
  const secret = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!secret) throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
  const session = await Session.findOne({
    secretHash: digest(secret), revokedAt: null, expiresAt: { $gt: new Date() }
  }).select("+csrfHash");
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
  if (secret) {
    const session = await Session.findOne({ secretHash: digest(secret), revokedAt: null }).select("+csrfHash");
    if (session) {
      await enforceCsrf(req, session.csrfHash);
      await Session.updateOne({ _id: session._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    }
  }
  clearSessionCookies(res);
}

export async function refreshSession(req: Request, res: Response) {
  const secret = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!secret) throw new AppError("Session is invalid or expired", 401, "SESSION_INVALID");
  const secretHash = digest(secret);
  const current = await Session.findOne({
    secretHash, revokedAt: null, expiresAt: { $gt: new Date() }
  }).select("+csrfHash");
  if (!current) throw new AppError("Session is invalid or expired", 401, "SESSION_INVALID");
  await enforceCsrf(req, current.csrfHash);

  const nextSecret = randomBytes(48).toString("base64url");
  const nextCsrf = randomBytes(32).toString("base64url");
  const session = await Session.findOneAndUpdate(
    { _id: current._id, secretHash, csrfHash: current.csrfHash, revokedAt: null, expiresAt: { $gt: new Date() } },
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

export async function listSessions(userId: Types.ObjectId, currentSessionId: string) {
  const sessions = await Session.find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } })
    .select("createdAt lastUsedAt expiresAt userAgent ipAddress").sort({ lastUsedAt: -1 }).lean();
  return sessions.map(session => ({
    id: session._id.toString(),
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
    isCurrent: session._id.toString() === currentSessionId
  }));
}

export async function revokeSession(userId: Types.ObjectId, sessionId: string) {
  const session = await Session.findOneAndUpdate(
    { _id: sessionId, userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    { new: true }
  );
  if (!session) throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
}
export async function revokeAllSessions(userId: Types.ObjectId) {
  await Session.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function changePassword(userId: Types.ObjectId, currentPassword: string, nextPassword: string, res: Response) {
  const user = await User.findOne({ _id: userId, isActive: true }).select("+passwordHash");
  if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, currentPassword))) {
    throw new AppError("Current password is incorrect", 400, "CURRENT_PASSWORD_INVALID");
  }
  user.passwordHash = await argon2.hash(nextPassword, { type: argon2.argon2id });
  await user.save();
  await revokeAllSessions(userId);
  clearSessionCookies(res);
}

export async function requestPasswordReset(emailInput: string) {
  const user = await User.findOne({ email: emailInput.trim().toLowerCase(), isActive: true, emailVerifiedAt: { $ne: null } });
  if (!user) return { accepted: true };
  if (env.NODE_ENV === "production" && !env.smtpConfigured) return { accepted: true };
  await PasswordResetToken.deleteMany({ userId: user._id });
  const raw = randomBytes(32).toString("base64url");
  await PasswordResetToken.create({ userId: user._id, tokenHash: digest(raw), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) });
  const queued = await sendPasswordResetEmail(user.email, user.name, raw);
  return { accepted: true, developmentResetToken: !queued && env.NODE_ENV === "development" ? raw : undefined };
}

export async function resetPassword(token: string, password: string) {
  const reset = await PasswordResetToken.findOneAndUpdate(
    { tokenHash: digest(token), expiresAt: { $gt: new Date() }, usedAt: null },
    { $set: { usedAt: new Date() } },
    { new: true }
  );
  if (!reset) throw new AppError("Password reset link is invalid or expired", 400, "INVALID_RESET_TOKEN");
  const user = await User.findOne({ _id: reset.userId, isActive: true });
  if (!user) throw new AppError("Account not found", 404, "USER_NOT_FOUND");
  user.passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await user.save();
  await revokeAllSessions(user._id);
  await PasswordResetToken.deleteMany({ userId: user._id });
  return { passwordReset: true };
}

export async function deactivateAccount(userId: Types.ObjectId, res: Response) {
  const user = await User.findOneAndUpdate({ _id: userId, isActive: true }, { $set: { isActive: false } });
  if (!user) throw new AppError("Account not found", 404, "USER_NOT_FOUND");
  await revokeAllSessions(userId);
  clearSessionCookies(res);
}

export async function updatePreferences(userId: Types.ObjectId, preferences: { theme?: "light" | "dark" | "system"; timezone?: string; currency?: string }) {
  if (preferences.timezone) {
    try { new Intl.DateTimeFormat("en-US", { timeZone: preferences.timezone }).format(); }
    catch { throw new AppError("Invalid IANA timezone", 400, "INVALID_TIMEZONE"); }
  }
  if (preferences.currency && !/^[A-Z]{3}$/i.test(preferences.currency)) throw new AppError("Invalid ISO currency code", 400, "INVALID_CURRENCY");
  const update: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(preferences)) update[`preferences.${key}`] = key === "currency" && typeof value === "string" ? value.toUpperCase() : value;
  const user = await User.findOneAndUpdate({ _id: userId, isActive: true }, { $set: update }, { new: true });
  if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");
  return publicUser(user);
}
