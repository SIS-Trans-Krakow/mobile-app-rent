import sharp from 'sharp';
import fs from 'fs';

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

function readMagicBytes(filePath: string, count: number): Buffer {
  const buf = Buffer.allocUnsafe(count);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buf, 0, count, 0);
  fs.closeSync(fd);
  return buf;
}

function isPdfKitSupported(filePath: string): boolean {
  try {
    const magic = readMagicBytes(filePath, 4);
    const isJpeg = JPEG_MAGIC.every((b, i) => magic[i] === b);
    const isPng = PNG_MAGIC.every((b, i) => magic[i] === b);
    return isJpeg || isPng;
  } catch {
    return false;
  }
}

/**
 * Converts an uploaded image to JPEG if it is in an unsupported format
 * (e.g. WebP, AVIF, HEIC). The file is overwritten in-place so the
 * stored filename stays the same. Non-image files (e.g. .gitkeep) are
 * silently skipped.
 */
export async function convertToPdfCompatibleJpeg(filePath: string): Promise<void> {
  if (isPdfKitSupported(filePath)) return;

  try {
    const converted = await sharp(filePath).jpeg({ quality: 90 }).toBuffer();
    fs.writeFileSync(filePath, converted);
  } catch (err) {
    // Not a recognised image — skip silently (e.g. .gitkeep placeholder file)
    console.warn('[image] Could not convert image to JPEG:', filePath, (err as Error).message);
  }
}
