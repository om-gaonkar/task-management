import {Schema,model} from "mongoose";
const transactionSchema=new Schema({
  userId:{type:Schema.Types.ObjectId,ref:"User",required:true,index:true},
  type:{type:String,enum:["income","expense"],required:true,index:true},
  amountMinor:{type:Number,required:true,min:1,max:Number.MAX_SAFE_INTEGER},
  currency:{type:String,required:true,uppercase:true,match:/^[A-Z]{3}$/,default:"INR"},
  categoryId:{type:Schema.Types.ObjectId,ref:"FinanceCategory",default:null,index:true},
  categoryName:{type:String,default:"Uncategorized",maxlength:60},
  projectId:{type:Schema.Types.ObjectId,ref:"Project",default:null,index:true},
  occurredAt:{type:Date,required:true,index:true},
  paymentMethod:{type:String,default:null,maxlength:50},
  note:{type:String,default:"",maxlength:1000},
  tagIds:[{type:Schema.Types.ObjectId,ref:"Tag"}]
},{timestamps:true,versionKey:false});
transactionSchema.index({userId:1,occurredAt:-1});
transactionSchema.index({userId:1,type:1,occurredAt:-1});
export const Transaction=model("Transaction",transactionSchema);
