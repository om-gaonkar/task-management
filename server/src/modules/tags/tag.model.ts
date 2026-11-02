import { Schema, model } from "mongoose";

const tagSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 40 },
  normalizedName: { type: String, required: true, lowercase: true, trim: true },
  color: { type: String, default: "#6f9580" },
  description: { type: String, maxlength: 200, default: null }
}, { timestamps: true, versionKey: false });

tagSchema.index({ userId: 1, normalizedName: 1 }, { unique: true });
export const Tag = model("Tag", tagSchema);
