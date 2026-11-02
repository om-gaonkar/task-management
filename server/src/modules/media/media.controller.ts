import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as service from "./media.service.js";
const owner=(req:Request)=>req.auth!.userId;
export async function sign(req:Request,res:Response,next:NextFunction){try{res.status(201).json({data:await service.createUploadSignature(owner(req),req.body)});}catch(error){next(error);}}
export async function confirm(req:Request,res:Response,next:NextFunction){try{res.json({data:await service.confirmUpload(owner(req),req.body)});}catch(error){next(error);}}
export async function listForParent(req:Request,res:Response,next:NextFunction){
 try{const query=z.object({parentType:z.enum(["task","project","diary"]),parentId:z.string().regex(/^[a-f\d]{24}$/i)}).parse(req.query);res.json({data:await service.listParentAttachments(owner(req),query.parentType,query.parentId)});}catch(error){next(error);}
}
export async function get(req:Request,res:Response,next:NextFunction){try{res.json({data:await service.listAttachment(owner(req),req.params.mediaId!)});}catch(error){next(error);}}
export async function remove(req:Request,res:Response,next:NextFunction){try{const result=await service.deleteAttachment(owner(req),req.params.mediaId!);res.status(result.deleted?204:202).json(result);}catch(error){next(error);}}
