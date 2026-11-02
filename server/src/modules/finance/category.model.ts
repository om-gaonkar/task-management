import {Schema,model} from "mongoose";
const financeCategorySchema=new Schema({
  userId:{type:Schema.Types.ObjectId,ref:"User",required:true,index:true},
  name:{type:String,required:true,trim:true,maxlength:60},
  normalizedName:{type:String,required:true,lowercase:true},
  type:{type:String,enum:["income","expense"],required:true},
  color:{type:String,default:"#7b9a85"},
  archivedAt:{type:Date,default:null}
},{timestamps:true,versionKey:false});
financeCategorySchema.index({userId:1,type:1,normalizedName:1},{unique:true});
export const FinanceCategory=model("FinanceCategory",financeCategorySchema);
