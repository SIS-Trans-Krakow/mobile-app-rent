import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getUploadsDir } from './paths';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;

function isPngBuffer(buffer: Buffer): boolean {
  if (buffer.length < PNG_MAGIC.length) return false;
  return PNG_MAGIC.equals(buffer.subarray(0, PNG_MAGIC.length));
}

function decodeBase64DataUrl(dataUrl: string): Buffer | null {
  const cleaned = dataUrl.trim();
  if (!cleaned) return null;

  const commaIdx = cleaned.indexOf(',');
  const base64Body = commaIdx >= 0 ? cleaned.substring(commaIdx + 1) : cleaned;

  try {
    const buffer = Buffer.from(base64Body, 'base64');
    return buffer.length > 0 ? buffer : null;
  } catch {
    return null;
  }
}

export function saveSignatureFromBase64(dataUrl: unknown, prefix = 'sig'): string | null {
  if (typeof dataUrl !== 'string' || !dataUrl) return null;

  const buffer = decodeBase64DataUrl(dataUrl);
  if (!buffer) {
    throw new Error('Invalid signature payload');
  }
  if (buffer.length > MAX_SIGNATURE_BYTES) {
    throw new Error('Signature file too large');
  }
  if (!isPngBuffer(buffer)) {
    throw new Error('Signature must be a PNG image');
  }

  const filename = `${prefix}_${uuidv4()}.png`;
  fs.writeFileSync(path.join(getUploadsDir(), filename), buffer);
  return filename;
}

export function saveSignatureFromUploadedFile(
  file: Express.Multer.File,
  prefix = 'sig'
): string {
  const buffer = fs.readFileSync(file.path);
  if (buffer.length > MAX_SIGNATURE_BYTES) {
    fs.unlinkSync(file.path);
    throw new Error('Signature file too large');
  }
  if (!isPngBuffer(buffer)) {
    fs.unlinkSync(file.path);
    throw new Error('Signature must be a PNG image');
  }

  const finalName = `${prefix}_${uuidv4()}.png`;
  const finalPath = path.join(getUploadsDir(), finalName);
  fs.renameSync(file.path, finalPath);
  return finalName;
}

export function copySignatureSnapshot(
  sourceFilename: string | null | undefined,
  prefix = 'sig_snap'
): string {
  if (!sourceFilename) return '';
  const sourcePath = path.join(getUploadsDir(), sourceFilename);
  if (!fs.existsSync(sourcePath)) return '';

  const ext = path.extname(sourceFilename) || '.png';
  const finalName = `${prefix}_${uuidv4()}${ext}`;
  fs.copyFileSync(sourcePath, path.join(getUploadsDir(), finalName));
  return finalName;
}

export function removeSignatureFile(filename: string | null | undefined): void {
  if (!filename) return;
  const filePath = path.join(getUploadsDir(), filename);
  if (!fs.existsSync(filePath)) return;
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    console.warn('[signature] Failed to remove signature file:', filePath, (err as Error).message);
  }
}
