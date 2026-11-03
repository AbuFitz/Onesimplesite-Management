"use client";
import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { uploadPhotoAction } from "@/app/actions/photo";

/** Pick a picture, see it cropped to a square, and save. The picture is shrunk to 256px here so it stays tiny. */
export function PhotoUpload() {
  const input = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState("");
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const bmp = await createImageBitmap(f);
    const side = Math.min(bmp.width, bmp.height);
    const c = document.createElement("canvas"); c.width = c.height = 256;
    c.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.85));
    const dt = new DataTransfer(); dt.items.add(new File([blob], "me.jpg", { type: "image/jpeg" })); input.current!.files = dt.files;
    setPreview(c.toDataURL("image/jpeg", 0.85));
  }
  return (
    <form ref={form} action={uploadPhotoAction} className="flex flex-wrap items-center gap-3">
      <label className="btn btn-quiet cursor-pointer"><Camera size={16} aria-hidden /> Choose a picture<input ref={input} name="photo" type="file" accept="image/png,image/jpeg,image/webp" onChange={onPick} className="sr-only" /></label>
      {preview && <><span className="inline-block size-12 rounded-full bg-cover" style={{ backgroundImage: `url(${preview})` }} aria-label="Preview" role="img" /><button className="btn">Save picture</button></>}
    </form>
  );
}
