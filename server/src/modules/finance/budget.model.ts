import {Schema,model} from "mongoose";
const budgetSchema=new Schema({
  userId:{type:Schema.Types.ObjectId,ref:"User",required:true,index:true},
  periodMonth:{type:String,required:true,match:/^\d{4}-\d{2}$/},
  currency:{type:String,required:true,uppercase:true,match:/^[A-Z]{3}$/},
  categoryId:{type:Schema.Types.ObjectId,ref:"FinanceCategory",default:null},
  scopeKey:{type:String,required:true},
  amountMinor:{type:Number,required:true,min:1,max:Number.MAX_SAFE_INTEGER}
},{timestamps:true,versionKey:false});
budgetSchema.index({userId:1,periodMonth:1,currency:1,scopeKey:1},{unique:true});
export const Budget=model("Budget",budgetSchema);
