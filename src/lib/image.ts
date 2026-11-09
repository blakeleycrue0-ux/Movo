/**
 * Client-side image preparation: decode, downscale and re-encode before upload.
 * Re-encoding strips metadata (e.g. EXIF location) and bounds the file size.
 */
export async function prepareImage(file: File, maxSide = 1600, quality = 0.85): Promise<{ blob: Blob; width: number; height: number }> {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error("attachment_type_not_allowed");
  if (file.type === "image/gif") {
    // Keep GIFs as-is (animation); they are still size-limited by the server and bucket.
    const bmp = await createImageBitmap(file);
    return { blob: file, width: bmp.width, height: bmp.height };
  }
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("upload_failed");
  ctx.drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", quality));
  if (!blob) throw new Error("upload_failed");
  return { blob, width: w, height: h };
}

/** Square crop from the centre, for avatars. */
export async function prepareAvatar(file: File, size = 512): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("attachment_type_not_allowed");
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("upload_failed");
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.88));
  if (!blob) throw new Error("upload_failed");
  return blob;
}

export function randomName(ext: string) {
  return `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
}
