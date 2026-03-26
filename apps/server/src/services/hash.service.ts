import crypto from 'crypto';
import fs from 'fs';

/**
 * 计算文件的 SHA-256 哈希（流式，支持大文件）
 */
export function computeFileSHA256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * 计算字符串 / Buffer 的 SHA-256
 */
export function computeSHA256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

