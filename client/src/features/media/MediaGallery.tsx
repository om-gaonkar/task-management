import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, LoaderCircle, Trash2, UploadCloud } from "lucide-react";
import { api } from "../../lib/api-client";

type ParentType="task"|"project"|"diary";
type Signature={mediaId:string;apiKey:string;timestamp:number;signature:string;folder:string;publicId:string;overwrite:boolean;allowedFormats:string;uploadUrl:string;maxBytes:number};
type MediaItem={_id:string;secureUrl:string;format:string;width:number;height:number;bytes:number;altText:string;caption:string;createdAt:string};
type MediaResponse={data:MediaItem[]};

function uploadToCloudinary(file:File,signature:Signature,onProgress:(value:number)=>void){
 return new Promise<string>((resolve,reject)=>{
  const data=new FormData();data.append("file",file);data.append("api_key",signature.apiKey);data.append("timestamp",String(signature.timestamp));data.append("signature",signature.signature);data.append("folder",signature.folder);data.append("public_id",signature.publicId);data.append("overwrite",String(signature.overwrite));data.append("allowed_formats",signature.allowedFormats);
  const xhr=new XMLHttpRequest();xhr.open("POST",signature.uploadUrl);xhr.timeout=90_000;
  xhr.upload.onprogress=event=>{if(event.lengthComputable)onProgress(Math.round(event.loaded/event.total*100));};
  xhr.onload=()=>{if(xhr.status>=200&&xhr.status<300){try{const result=JSON.parse(xhr.responseText) as {public_id?:string};if(!result.public_id){reject(new Error("Cloudinary response did not include an asset identifier."));return;}resolve(result.public_id);}catch{reject(new Error("Cloudinary returned an unreadable response."));}}else{try{const result=JSON.parse(xhr.responseText) as {error?:{message?:string}};reject(new Error(result.error?.message??"Image upload failed."));}catch{reject(new Error("Image upload failed."));}}};
  xhr.onerror=()=>reject(new Error("Network error while uploading the image."));
  xhr.ontimeout=()=>reject(new Error("Image upload timed out."));
  xhr.send(data);
 });
}

export function MediaGallery({parentType,parentId}: {parentType:ParentType;parentId:string}){
 const inputRef=useRef<HTMLInputElement>(null);const queryClient=useQueryClient();const[progress,setProgress]=useState(0);const[message,setMessage]=useState<string|null>(null);
 const queryKey=["media",parentType,parentId] as const;
 const attachments=useQuery({queryKey,queryFn:()=>api<MediaResponse>(`/media?parentType=${parentType}&parentId=${parentId}`),enabled:Boolean(parentId)});
 const uploadMutation=useMutation({
  mutationFn:async(files:File[])=>{
   const result:MediaItem[]=[];
   for(const file of files){
    setProgress(0);
    const signed=await api<{data:Signature}>("/media/upload-signature",{method:"POST",body:JSON.stringify({parentType,parentId})});
    await uploadToCloudinary(file,signed.data,setProgress);
    const confirmed=await api<{data:MediaItem}>("/media/confirm-upload",{method:"POST",body:JSON.stringify({mediaId:signed.data.mediaId,altText:file.name})});
    result.push(confirmed.data);
   }
   return result;
  },
  onSuccess:async()=>{setProgress(100);setMessage("Image attached.");await queryClient.invalidateQueries({queryKey});},
  onError:error=>{setMessage(error instanceof Error?error.message:"Could not upload the image.");void queryClient.invalidateQueries({queryKey});},
  onSettled:()=>{if(inputRef.current)inputRef.current.value="";}
 });
 const removeMutation=useMutation({mutationFn:(id:string)=>api(`/media/${id}`,{method:"DELETE"}),onSuccess:()=>void queryClient.invalidateQueries({queryKey})});
 async function handleFiles(files:FileList|null){
  if(!files?.length)return;
  const selected=Array.from(files);
  const allowed=new Set(["image/jpeg","image/png","image/webp","image/gif"]);
  const invalid=selected.find(file=>!allowed.has(file.type)||file.size>8*1024*1024);
  if(invalid){setMessage(`${invalid.name}: choose a JPEG, PNG, WebP, or GIF image up to 8 MB.`);if(inputRef.current)inputRef.current.value="";return;}
  setMessage(null);uploadMutation.mutate(selected);
 }
 const items=attachments.data?.data??[];
 return <section className="media-gallery">
  <div className="media-gallery-heading"><div><span><ImagePlus size={14}/> Images</span><small>{items.length} attached</small></div><button className="button button-secondary button-small" onClick={()=>inputRef.current?.click()} disabled={uploadMutation.isPending}><UploadCloud size={14}/>{uploadMutation.isPending?"Uploading…":"Add images"}</button><input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={event=>void handleFiles(event.target.files)}/></div>
  {uploadMutation.isPending&&<div className="media-progress"><div><LoaderCircle size={13}/> Uploading images… <b>{progress}%</b></div><div className="progress-track"><span style={{width:`${progress}%`}}/></div></div>}
  {attachments.isLoading?<p className="media-empty">Loading images…</p>:attachments.isError?<p className="media-error">{attachments.error.message}</p>:items.length===0?<p className="media-empty">No images attached yet.</p>:<div className="media-grid">{items.map(item=><figure className="media-item" key={item._id}><a href={item.secureUrl} target="_blank" rel="noreferrer"><img src={item.secureUrl} alt={item.altText||"Attached image"} loading="lazy"/></a><button className="media-remove" title="Remove image" aria-label="Remove image" onClick={()=>removeMutation.mutate(item._id)} disabled={removeMutation.isPending}><Trash2 size={13}/></button></figure>)}</div>}
  {message&&<p className={message.includes("attached")?"media-success":"media-error"}>{message}</p>}
  {removeMutation.error&&<p className="media-error">{removeMutation.error.message}</p>}
 </section>;
}
