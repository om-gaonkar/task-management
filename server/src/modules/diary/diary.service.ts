import {Types} from "mongoose";
import {AppError} from "../../shared/errors/app-error.js";
import {Project} from "../projects/project.model.js";
import {Tag} from "../tags/tag.model.js";
import {Task} from "../tasks/task.model.js";
import {DiaryEntry} from "./diary.model.js";
type LinkInput={tagIds?:string[];linkedTaskIds?:string[];linkedProjectIds?:string[]};
async function validateLinks(userId:Types.ObjectId,input:LinkInput){
  const checks:Promise<number>[]=[];
  if(input.tagIds?.length)checks.push(Tag.countDocuments({_id:{$in:input.tagIds},userId}));
  if(input.linkedTaskIds?.length)checks.push(Task.countDocuments({_id:{$in:input.linkedTaskIds},userId,deletedAt:null}));
  if(input.linkedProjectIds?.length)checks.push(Project.countDocuments({_id:{$in:input.linkedProjectIds},userId,archivedAt:null}));
  const counts=await Promise.all(checks);
  const expected=[input.tagIds,input.linkedTaskIds,input.linkedProjectIds].filter(x=>x?.length).map(x=>new Set(x).size);
  if(counts.some((count,index)=>count!==expected[index]))throw new AppError("One or more linked records are unavailable",400,"INVALID_DIARY_LINKS");
}
function searchableText(content:unknown):string {
  if(typeof content==="string")return content.slice(0,100_000);
  if(!content||typeof content!=="object")return "";
  const out:string[]=[];
  const visit=(value:unknown,depth:number)=>{
    if(depth>20||out.join(" ").length>100_000)return;
    if(typeof value==="string"){out.push(value);return;}
    if(Array.isArray(value)){for(const item of value)visit(item,depth+1);return;}
    if(value&&typeof value==="object")for(const [key,item] of Object.entries(value)){if(["text","title","label"].includes(key))visit(item,depth+1);else if(typeof item==="object")visit(item,depth+1);}
  };
  visit(content,0);return out.join(" ").slice(0,100_000);
}
export async function listEntries(userId:Types.ObjectId,query:{start?:string;end?:string;page:number;limit:number;search?:string}){
  const filter:Record<string,unknown>={userId};
  if(query.start||query.end){filter.entryDate={...(query.start?{$gte:new Date(query.start)}:{}),...(query.end?{$lt:new Date(query.end)}:{})};}
  if(query.search){const escaped=query.search.replace(/[.*+?^$()|[\]\\]/g,"\\$&");filter.$or=[{title:{$regex:escaped,$options:"i"}},{contentText:{$regex:escaped,$options:"i"}}];}
  const [items,total]=await Promise.all([DiaryEntry.find(filter).sort({entryDate:-1,createdAt:-1}).skip((query.page-1)*query.limit).limit(query.limit).select("-contentText").lean(),DiaryEntry.countDocuments(filter)]);
  return {items,page:query.page,limit:query.limit,total,pages:Math.ceil(total/query.limit)};
}
export async function createEntry(userId:Types.ObjectId,input:Record<string,any>){
  await validateLinks(userId,input);
  const entry=await DiaryEntry.create({...input,userId,entryDate:new Date(input.entryDate),contentText:searchableText(input.content),tagIds:(input.tagIds??[]).map((id:string)=>new Types.ObjectId(id)),linkedTaskIds:(input.linkedTaskIds??[]).map((id:string)=>new Types.ObjectId(id)),linkedProjectIds:(input.linkedProjectIds??[]).map((id:string)=>new Types.ObjectId(id))});
  return entry.toObject();
}
export async function getEntry(userId:Types.ObjectId,entryId:string){
  const entry=await DiaryEntry.findOne({_id:entryId,userId}).select("-contentText").lean();
  if(!entry)throw new AppError("Diary entry not found",404,"DIARY_ENTRY_NOT_FOUND");
  return entry;
}
export async function updateEntry(userId:Types.ObjectId,entryId:string,input:Record<string,any>){
  await validateLinks(userId,input);
  const update={...input};
  delete update.version;
  if(input.entryDate)update.entryDate=new Date(input.entryDate);
  if(input.content!==undefined)update.contentText=searchableText(input.content);
  for(const key of ["tagIds","linkedTaskIds","linkedProjectIds"])if(input[key])update[key]=input[key].map((id:string)=>new Types.ObjectId(id));
  const entry=await DiaryEntry.findOneAndUpdate({_id:entryId,userId,version:input.version},{$set:update,$inc:{version:1}},{new:true,runValidators:true}).select("-contentText");
  if(!entry){const exists=await DiaryEntry.exists({_id:entryId,userId});if(!exists)throw new AppError("Diary entry not found",404,"DIARY_ENTRY_NOT_FOUND");throw new AppError("This entry changed elsewhere. Reload before saving again.",409,"DIARY_VERSION_CONFLICT");}
  return entry.toObject();
}
export async function deleteEntry(userId:Types.ObjectId,entryId:string){
  const result=await DiaryEntry.deleteOne({_id:entryId,userId});
  if(!result.deletedCount)throw new AppError("Diary entry not found",404,"DIARY_ENTRY_NOT_FOUND");
}
export async function diaryCalendar(userId:Types.ObjectId,start:string,end:string){
  const rows=await DiaryEntry.aggregate([{ $match:{userId,entryDate:{$gte:new Date(start),$lt:new Date(end)}}},{ $group:{_id:{$dateToString:{format:"%Y-%m-%d",date:"$entryDate"}},count:{$sum:1}}},{ $sort:{_id:1}}]);
  return rows.map(row=>({date:row._id,count:row.count}));
}
