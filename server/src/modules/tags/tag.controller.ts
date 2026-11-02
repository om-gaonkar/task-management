import type { Request,Response,NextFunction } from "express";
import * as service from "./tag.service.js";
const owner=(req:Request)=>req.auth!.userId;
export async function list(req:Request,res:Response,next:NextFunction){try{res.json({data:await service.listTags(owner(req))});}catch(e){next(e);}}
export async function create(req:Request,res:Response,next:NextFunction){try{res.status(201).json({data:await service.createTag(owner(req),req.body)});}catch(e){next(e);}}
export async function update(req:Request,res:Response,next:NextFunction){try{res.json({data:await service.updateTag(owner(req),req.params.tagId!,req.body)});}catch(e){next(e);}}
export async function remove(req:Request,res:Response,next:NextFunction){try{await service.deleteTag(owner(req),req.params.tagId!);res.status(204).send();}catch(e){next(e);}}
