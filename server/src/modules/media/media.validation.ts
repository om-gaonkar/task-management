import { z } from "zod";
const id = z.string().regex(/^[a-f\d]{24}$/i);
export const uploadSignatureSchema = z.object({
  parentType: z.enum(["task", "project", "diary"]),
  parentId: id
});
export const confirmUploadSchema = z.object({
  mediaId: id,
  altText: z.string().max(300).optional(),
  caption: z.string().max(500).optional()
});
