import { Schema, model } from "mongoose";
const diaryEntrySchema=new Schema({
  userId:{type:Schema.Types.ObjectId,ref:"User",required:true,index:true},
  title:{type:String,trim:true,default:"",maxlength:160},
  content:{type:Schema.Types.Mixed,required:true},
  contentText:{type:String,default:"",select:false},
  entryDate:{type:Date,required:true},
  timezone:{type:String,required:true,default:"Asia/Kolkata"},
  tagIds:[{type:Schema.Types.ObjectId,ref:"Tag"}],
  mood:{type:String,default:null, maxlength:40},
  linkedTaskIds:[{type:Schema.Types.ObjectId,ref:"Task"}],
  linkedProjectIds:[{type:Schema.Types.ObjectId,ref:"Project"}],
  version:{type:Number,default:1}
},{timestamps:true,versionKey:false});
diaryEntrySchema.index({userId:1,entryDate:-1,createdAt:-1});
diaryEntrySchema.index({userId:1,updatedAt:-1});
export const DiaryEntry=model("DiaryEntry",diaryEntrySchema);
