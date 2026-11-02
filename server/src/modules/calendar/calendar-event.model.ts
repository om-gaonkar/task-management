import {Schema,model} from "mongoose";
const calendarEventSchema=new Schema({
  userId:{type:Schema.Types.ObjectId,ref:"User",required:true,index:true},
  title:{type:String,required:true,trim:true,maxlength:160},
  description:{type:String,default:"",maxlength:2000},
  startAt:{type:Date,required:true,index:true},
  endAt:{type:Date,default:null},
  allDay:{type:Boolean,default:false},
  timezone:{type:String,default:"Asia/Kolkata"},
  color:{type:String,default:null}
},{timestamps:true,versionKey:false});
calendarEventSchema.index({userId:1,startAt:1});
export const CalendarEvent=model("CalendarEvent",calendarEventSchema);
