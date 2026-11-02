import {Types} from "mongoose";
import {AppError} from "../../shared/errors/app-error.js";
import {Project} from "../projects/project.model.js";
import {Tag} from "../tags/tag.model.js";
import {Budget} from "./budget.model.js";
import {FinanceCategory} from "./category.model.js";
import {Transaction} from "./transaction.model.js";

const asBig=(value:number)=>BigInt(value);
const monthRange=(month:string)=>({start:new Date(`${month}-01T00:00:00.000Z`),end:new Date(new Date(`${month}-01T00:00:00.000Z`).getTime()+32*86400000)});
async function validateTransactionLinks(userId:Types.ObjectId,input:Record<string,any>){
  if(input.categoryId){const category=await FinanceCategory.findOne({_id:input.categoryId,userId,archivedAt:null});if(!category)throw new AppError("Finance category not found",404,"CATEGORY_NOT_FOUND");if(input.type&&category.type!==input.type)throw new AppError("Category type does not match transaction type",400,"CATEGORY_TYPE_MISMATCH");}
  if(input.projectId&&!(await Project.exists({_id:input.projectId,userId,archivedAt:null})))throw new AppError("Project not found",404,"PROJECT_NOT_FOUND");
  if(input.tagIds?.length){const count=await Tag.countDocuments({_id:{$in:input.tagIds},userId});if(count!==new Set(input.tagIds).size)throw new AppError("One or more tags are invalid",400,"INVALID_TAGS");}
}
export async function listCategories(userId:Types.ObjectId){return FinanceCategory.find({userId,archivedAt:null}).sort({type:1,name:1}).lean();}
export async function createCategory(userId:Types.ObjectId,input:{name:string;type:"income"|"expense";color?:string}){
  const normalizedName=input.name.trim().toLowerCase();
  if(await FinanceCategory.exists({userId,type:input.type,normalizedName}))throw new AppError("Category already exists",409,"CATEGORY_EXISTS");
  return (await FinanceCategory.create({...input,name:input.name.trim(),normalizedName,userId})).toObject();
}
export async function archiveCategory(userId:Types.ObjectId,categoryId:string){
  const category=await FinanceCategory.findOneAndUpdate({_id:categoryId,userId,archivedAt:null},{$set:{archivedAt:new Date()}},{new:true});
  if(!category)throw new AppError("Finance category not found",404,"CATEGORY_NOT_FOUND");
  return category.toObject();
}
export async function listTransactions(userId:Types.ObjectId,query:{page:number;limit:number;type?:string;from?:string;to?:string;projectId?:string;currency?:string}){
  const filter:Record<string,unknown>={userId};
  if(query.type)filter.type=query.type;
  if(query.projectId)filter.projectId=new Types.ObjectId(query.projectId);
  if(query.currency)filter.currency=query.currency.toUpperCase();
  if(query.from||query.to)filter.occurredAt={...(query.from?{$gte:new Date(query.from)}:{}),...(query.to?{$lt:new Date(query.to)}:{})};
  const [items,total]=await Promise.all([Transaction.find(filter).sort({occurredAt:-1,createdAt:-1}).skip((query.page-1)*query.limit).limit(query.limit).lean(),Transaction.countDocuments(filter)]);
  return {items,page:query.page,limit:query.limit,total,pages:Math.ceil(total/query.limit)};
}
export async function createTransaction(userId:Types.ObjectId,input:Record<string,any>){
  await validateTransactionLinks(userId,input);
  const category=input.categoryId?await FinanceCategory.findOne({_id:input.categoryId,userId}):null;
  return (await Transaction.create({...input,userId,currency:input.currency.toUpperCase(),occurredAt:new Date(input.occurredAt),categoryName:category?.name??"Uncategorized",categoryId:input.categoryId?new Types.ObjectId(input.categoryId):null,projectId:input.projectId?new Types.ObjectId(input.projectId):null,tagIds:(input.tagIds??[]).map((id:string)=>new Types.ObjectId(id))})).toObject();
}
export async function updateTransaction(userId:Types.ObjectId,transactionId:string,input:Record<string,any>){
  const current=await Transaction.findOne({_id:transactionId,userId});
  if(!current)throw new AppError("Transaction not found",404,"TRANSACTION_NOT_FOUND");
  const merged={...current.toObject(),...input};
  await validateTransactionLinks(userId,merged);
  const update={...input};
  if(input.occurredAt)update.occurredAt=new Date(input.occurredAt);
  if(input.currency)update.currency=input.currency.toUpperCase();
  if(input.categoryId!==undefined){const category=input.categoryId?await FinanceCategory.findOne({_id:input.categoryId,userId}):null;update.categoryId=input.categoryId?new Types.ObjectId(input.categoryId):null;update.categoryName=category?.name??"Uncategorized";}
  if(input.projectId!==undefined)update.projectId=input.projectId?new Types.ObjectId(input.projectId):null;
  if(input.tagIds)update.tagIds=input.tagIds.map((id:string)=>new Types.ObjectId(id));
  const item=await Transaction.findOneAndUpdate({_id:transactionId,userId},{$set:update},{new:true,runValidators:true});
  return item!.toObject();
}
export async function deleteTransaction(userId:Types.ObjectId,transactionId:string){
  const result=await Transaction.deleteOne({_id:transactionId,userId});
  if(!result.deletedCount)throw new AppError("Transaction not found",404,"TRANSACTION_NOT_FOUND");
}
export async function financeSummary(userId:Types.ObjectId,from:string,to:string,currency?:string){
  const filter:Record<string,unknown>={userId,occurredAt:{$gte:new Date(from),$lt:new Date(to)}};
  if(currency)filter.currency=currency.toUpperCase();
  const items=await Transaction.find(filter).select("type amountMinor currency categoryName").lean();
  const buckets=new Map<string,{income:bigint;expense:bigint;categories:Map<string,bigint>}>();
  for(const item of items){const bucket=buckets.get(item.currency)??{income:0n,expense:0n,categories:new Map<string,bigint>()};const amount=asBig(item.amountMinor);if(item.type==="income")bucket.income+=amount;else{bucket.expense+=amount;bucket.categories.set(item.categoryName,(bucket.categories.get(item.categoryName)??0n)+amount);}buckets.set(item.currency,bucket);}
  return [...buckets.entries()].map(([code,value])=>({currency:code,incomeMinor:value.income.toString(),expenseMinor:value.expense.toString(),netMinor:(value.income-value.expense).toString(),spendingByCategory:[...value.categories.entries()].map(([name,amount])=>({name,amountMinor:amount.toString()})).sort((a,b)=>BigInt(a.amountMinor)>BigInt(b.amountMinor)?-1:1)}));
}
export async function createOrUpdateBudget(userId:Types.ObjectId,input:Record<string,any>){
  if(input.categoryId){const category=await FinanceCategory.findOne({_id:input.categoryId,userId,archivedAt:null,type:"expense"});if(!category)throw new AppError("Expense category not found",404,"CATEGORY_NOT_FOUND");}
  const scopeKey=input.categoryId??"all";
  const budget=await Budget.findOneAndUpdate({userId,periodMonth:input.periodMonth,currency:input.currency.toUpperCase(),scopeKey},{$set:{amountMinor:input.amountMinor,categoryId:input.categoryId?new Types.ObjectId(input.categoryId):null}},{new:true,upsert:true,setDefaultsOnInsert:true});
  return budget.toObject();
}
export async function listBudgets(userId:Types.ObjectId,month:string){
  const budgets=await Budget.find({userId,periodMonth:month}).lean();
  const {start,end}=monthRange(month);
  const expenses=await Transaction.find({userId,type:"expense",occurredAt:{$gte:start,$lt:end}}).select("amountMinor currency categoryId").lean();
  return budgets.map(budget=>{const spent=expenses.filter(x=>x.currency===budget.currency&&(!budget.categoryId||x.categoryId?.toString()===budget.categoryId.toString())).reduce((sum,x)=>sum+asBig(x.amountMinor),0n);const amount=asBig(budget.amountMinor);return {...budget,spentMinor:spent.toString(),remainingMinor:(amount-spent).toString(),usagePercent:Number((spent*10000n)/amount)/100};});
}
export async function projectExpenses(userId:Types.ObjectId,projectId:string,from?:string,to?:string){
  if(!(await Project.exists({_id:projectId,userId})))throw new AppError("Project not found",404,"PROJECT_NOT_FOUND");
  const filter:Record<string,unknown>={userId,projectId:new Types.ObjectId(projectId),type:"expense"};
  if(from||to)filter.occurredAt={...(from?{$gte:new Date(from)}:{}),...(to?{$lt:new Date(to)}:{})};
  const items=await Transaction.find(filter).sort({occurredAt:-1}).lean();
  const totals=new Map<string,bigint>();for(const item of items)totals.set(item.currency,(totals.get(item.currency)??0n)+asBig(item.amountMinor));
  return {items,totals:[...totals.entries()].map(([currency,amountMinor])=>({currency,amountMinor:amountMinor.toString()}))};
}
export async function exportTransactions(userId:Types.ObjectId,from?:string,to?:string){
  const filter:Record<string,unknown>={userId};if(from||to)filter.occurredAt={...(from?{$gte:new Date(from)}:{}),...(to?{$lt:new Date(to)}:{})};
  const items=await Transaction.find(filter).sort({occurredAt:1}).lean();
  const cell=(value:unknown)=>{const raw=String(value??"");return /[",\n]/.test(raw)?`"${raw.replace(/"/g,'""')}"`:raw;};
  return ["date,type,amountMinor,currency,category,projectId,paymentMethod,note",...items.map(x=>[x.occurredAt.toISOString(),x.type,x.amountMinor,x.currency,x.categoryName,x.projectId?.toString()??"",x.paymentMethod??"",x.note].map(cell).join(","))].join("\r\n");
}
