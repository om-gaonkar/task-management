import {Schema,model} from "mongoose";
const projectSchema=new Schema({
  userId:{type:Schema.Types.ObjectId,ref:"User",required:true,index:true},
  name:{type:String,required:true,trim:true,maxlength:120},
  description:{type:Schema.Types.Mixed,default:null},
  status:{type:String,enum:["planning","active","on-hold","completed","archived"],default:"planning",index:true},
  priority:{type:String,enum:["low","medium","high","urgent"],default:"medium"},
  startDate:{type:Date,default:null},
  deadline:{type:Date,default:null},
  tagIds:[{type:Schema.Types.ObjectId,ref:"Tag"}],
  mediaIds:[{type:Schema.Types.ObjectId,ref:"MediaAsset"}],
  coverMediaId:{type:Schema.Types.ObjectId,ref:"MediaAsset",default:null},
  color:{type:String,default:null},
  archivedAt:{type:Date,default:null}
},{timestamps:true,versionKey:false});
projectSchema.index({userId:1,status:1,updatedAt:-1});
export const Project=model("Project",projectSchema);
