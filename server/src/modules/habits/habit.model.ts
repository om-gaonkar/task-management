import {Schema,model} from "mongoose";
const habitSchema=new Schema({
  userId:{type:Schema.Types.ObjectId,ref:"User",required:true,index:true},
  name:{type:String,required:true,trim:true,maxlength:100},
  description:{type:String,default:"",maxlength:500},
  frequency:{type:String,enum:["daily","weekly"],required:true,default:"daily"},
  weekdays:{type:[Number],default:[]},
  targetCount:{type:Number,min:1,default:1},
  timezone:{type:String,required:true,default:"Asia/Kolkata"},
  archivedAt:{type:Date,default:null}
},{timestamps:true,versionKey:false});
habitSchema.index({userId:1,archivedAt:1,createdAt:-1});
const completionSchema=new Schema({
  userId:{type:Schema.Types.ObjectId,ref:"User",required:true},
  habitId:{type:Schema.Types.ObjectId,ref:"Habit",required:true},
  localDate:{type:String,required:true},
  completedAt:{type:Date,default:Date.now}
},{timestamps:true,versionKey:false});
completionSchema.index({userId:1,habitId:1,localDate:1},{unique:true});
completionSchema.index({userId:1,localDate:1});
export const Habit=model("Habit",habitSchema);
export const HabitCompletion=model("HabitCompletion",completionSchema);
