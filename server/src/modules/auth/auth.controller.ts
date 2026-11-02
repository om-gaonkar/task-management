import type { Request, Response, NextFunction } from "express";
import * as service from "./auth.service.js";
import { beginGoogleOAuth, completeGoogleOAuth } from "./oauth.service.js";
import { AppError } from "../../shared/errors/app-error.js";

export async function register(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json({ data: await service.register(req.body) }); } catch (error) { next(error); }
}
export async function login(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: { user: await service.login(req.body, req, res) } }); } catch (error) { next(error); }
}
export async function verifyEmail(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await service.verifyEmail(req.body.token) }); } catch (error) { next(error); }
}
export async function resendVerification(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await service.resendVerification(req.body.email) }); } catch (error) { next(error); }
}
export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw new AppError("Authentication required", 401);
    res.json({ data: { user: await service.currentUser(req.auth.userId) } });
  } catch (error) { next(error); }
}
export async function logout(req: Request, res: Response, next: NextFunction) {
  try { await service.logout(req, res); res.status(204).send(); } catch (error) { next(error); }
}
export async function refresh(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: { user: await service.refreshSession(req, res) } }); } catch (error) { next(error); }
}
export async function sessions(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await service.listSessions(req.auth!.userId, req.auth!.sessionId) }); } catch (error) { next(error); }
}
export async function revokeSession(req: Request, res: Response, next: NextFunction) {
  try { await service.revokeSession(req.auth!.userId, req.params.sessionId!); res.status(204).send(); } catch (error) { next(error); }
}
export async function logoutAll(req: Request, res: Response, next: NextFunction) {
  try { await service.revokeAllSessions(req.auth!.userId); service.clearSessionCookies(res); res.status(204).send(); } catch (error) { next(error); }
}
export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try { await service.changePassword(req.auth!.userId, req.body.currentPassword, req.body.newPassword, res); res.status(204).send(); } catch (error) { next(error); }
}
export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await service.requestPasswordReset(req.body.email) }); } catch (error) { next(error); }
}
export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await service.resetPassword(req.body.token, req.body.password) }); } catch (error) { next(error); }
}
export async function deactivate(req: Request, res: Response, next: NextFunction) {
  try { await service.deactivateAccount(req.auth!.userId, res); res.status(204).send(); } catch (error) { next(error); }
}
export async function updatePreferences(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: { user: await service.updatePreferences(req.auth!.userId, req.body) } }); } catch (error) { next(error); }
}
export function googleLogin(_req: Request, res: Response, next: NextFunction) {
  try { beginGoogleOAuth(res, "login"); } catch (error) { next(error); }
}
export function googleLink(_req: Request, res: Response, next: NextFunction) {
  try { beginGoogleOAuth(res, "link"); } catch (error) { next(error); }
}
export async function googleCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code) throw new AppError("Google authorization code is missing", 400, "OAUTH_CODE_MISSING");
    res.redirect(await completeGoogleOAuth(req, res, code, state));
  } catch (error) { next(error); }
}
