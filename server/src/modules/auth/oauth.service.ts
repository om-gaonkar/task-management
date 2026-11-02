import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { AppError } from "../../shared/errors/app-error.js";
import { env } from "../../config/env.js";
import { User } from "../users/user.model.js";
import { authenticateRequest, createSessionForUser } from "./auth.service.js";

const STATE_COOKIE = "pw_oauth_state";
const VERIFIER_COOKIE = "pw_oauth_verifier";
const MODE_COOKIE = "pw_oauth_mode";
const TTL = 5 * 60 * 1000;

function oauthClient() {
  if (!env.googleConfigured || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_CALLBACK_URL) {
    throw new AppError("Google OAuth is not configured", 503, "GOOGLE_OAUTH_NOT_CONFIGURED");
  }
  return new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_CALLBACK_URL);
}
function cookieOptions() {
  return { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "lax" as const, path: "/api/v1/auth/google", maxAge: TTL };
}
function clearOAuthCookies(res: Response) {
  for (const name of [STATE_COOKIE, VERIFIER_COOKIE, MODE_COOKIE]) res.clearCookie(name, cookieOptions());
}
function equal(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function redirectClient(path: string) {
  return new URL(path, env.CLIENT_URL).toString();
}

export function beginGoogleOAuth(res: Response, mode: "login" | "link") {
  const client = oauthClient();
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const options = cookieOptions();
  res.cookie(STATE_COOKIE, state, options);
  res.cookie(VERIFIER_COOKIE, verifier, options);
  res.cookie(MODE_COOKIE, mode, options);
  const url = client.generateAuthUrl({
    access_type: "online",
    prompt: "select_account",
    scope: ["openid", "email", "profile"],
    state,
    code_challenge: challenge,
    code_challenge_method: "S256"
  });
  res.redirect(url);
}

export async function completeGoogleOAuth(req: Request, res: Response, code: string, state: string) {
  const savedState = req.cookies?.[STATE_COOKIE] as string | undefined;
  const verifier = req.cookies?.[VERIFIER_COOKIE] as string | undefined;
  const mode = req.cookies?.[MODE_COOKIE] as "login" | "link" | undefined;
  clearOAuthCookies(res);
  if (!savedState || !verifier || !mode || !state || !equal(savedState, state)) {
    throw new AppError("Google OAuth state validation failed", 400, "OAUTH_STATE_INVALID");
  }

  const client = oauthClient();
  const { tokens } = await client.getToken({ code, codeVerifier: verifier });
  if (!tokens.id_token) throw new AppError("Google identity token is missing", 401, "GOOGLE_ID_TOKEN_MISSING");
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email || payload.email_verified !== true) {
    throw new AppError("Google did not provide a verified email identity", 401, "GOOGLE_IDENTITY_UNVERIFIED");
  }
  if (!["accounts.google.com", "https://accounts.google.com"].includes(payload.iss ?? "")) {
    throw new AppError("Google identity issuer is invalid", 401, "GOOGLE_ISSUER_INVALID");
  }

  const email = payload.email.toLowerCase();
  if (mode === "link") {
    const auth = await authenticateRequest(req);
    const user = await User.findOne({ _id: auth.userId, isActive: true });
    if (!user) throw new AppError("Account not found", 404, "USER_NOT_FOUND");
    if (user.email !== email) throw new AppError("The Google account email must match your Daymark account email to link it", 409, "GOOGLE_EMAIL_MISMATCH");
    const existing = await User.findOne({ googleSub: payload.sub });
    if (existing && existing._id.toString() !== user._id.toString()) throw new AppError("This Google account is linked to another user", 409, "GOOGLE_ACCOUNT_ALREADY_LINKED");
    user.googleSub = payload.sub;
    user.emailVerifiedAt ??= new Date();
    if (!user.avatarUrl && payload.picture) user.avatarUrl = payload.picture;
    await user.save();
    return redirectClient("/settings/account?google=linked");
  }

  let user = await User.findOne({ googleSub: payload.sub });
  if (!user) {
    user = await User.findOne({ email });
    if (user) {
      if (user.googleSub && user.googleSub !== payload.sub) throw new AppError("This email is linked to another Google account", 409, "GOOGLE_ACCOUNT_CONFLICT");
      user.googleSub = payload.sub;
      user.emailVerifiedAt ??= new Date();
      if (!user.avatarUrl && payload.picture) user.avatarUrl = payload.picture;
      await user.save();
    } else {
      try {
        user = await User.create({
          name: payload.name?.trim() || email.split("@")[0] || "Google user",
          email,
          googleSub: payload.sub,
          avatarUrl: payload.picture ?? null,
          emailVerifiedAt: new Date()
        });
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        user = await User.findOne({ $or: [{ email }, { googleSub: payload.sub }] });
        if (!user || user.googleSub && user.googleSub !== payload.sub) throw new AppError("Unable to safely link this Google account", 409, "GOOGLE_ACCOUNT_CONFLICT");
      }
    }
  }
  if (!user.isActive) throw new AppError("Your account has been deactivated", 403, "ACCOUNT_DEACTIVATED");
  await createSessionForUser(user._id, req, res);
  return redirectClient("/auth/callback");
}
