import type { Request, Response, NextFunction } from "express";
import * as service from "./media.service.js";
const owner = (req: Request) => req.auth!.userId;
export async function sign(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json({ data: await service.createUploadSignature(owner(req), req.body) }); } catch (error) { next(error); }
}
export async function confirm(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await service.confirmUpload(owner(req), req.body) }); } catch (error) { next(error); }
}
export async function get(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await service.listAttachments(owner(req), req.params.mediaId!) }); } catch (error) { next(error); }
}
export async function remove(req: Request, res: Response, next: NextFunction) {
  try { const result = await service.deleteAttachment(owner(req), req.params.mediaId!); res.status(result.deleted ? 204 : 202).json(result); } catch (error) { next(error); }
}
