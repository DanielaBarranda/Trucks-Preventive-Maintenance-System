// Shrinks phone photos before upload: a 10 MB camera photo becomes ~300 KB,
// which matters on patchy mobile data. The server accepts JPG/PNG up to 10 MB.

const MAX_SIDE = 1600;
const MAX_BYTES = 10 * 1024 * 1024;
const SENDABLE = ['image/jpeg', 'image/png'];
// iPhones may hand over HEIC; we can send it only if the browser converts it to JPEG
const DECODABLE = [...SENDABLE, 'image/heic', 'image/heif'];

export function fitWithin(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function prepareUpload(file: File): Promise<File> {
  if (!DECODABLE.includes(file.type)) throw new Error('Use a JPG or PNG photo.');

  const resized = await resizeToJpeg(file);
  if (resized && (resized.size < file.size || !SENDABLE.includes(file.type))) return resized;

  // Could not shrink it (or shrinking didn't help): send the original if the server accepts it
  if (!SENDABLE.includes(file.type)) throw new Error('Use a JPG or PNG photo.');
  if (file.size > MAX_BYTES) throw new Error('Photo is too big (max 10 MB).');
  return file;
}

// null when this browser cannot decode or encode the image
async function resizeToJpeg(file: File): Promise<File | null> {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fff';               // PNG transparency becomes white, not black
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    if (!blob || blob.size > MAX_BYTES) return null;
    const name = file.name.replace(/\.[^.]*$/, '') || 'photo';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
  } catch {
    return null;
  }
}
