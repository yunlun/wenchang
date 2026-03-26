// API 响应状态码
export const API_CODES = {
  SUCCESS: 0,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
} as const;

// 套餐限制
export const PLAN_LIMITS = {
  free: 5,
  pro: 100,
  enterprise: Infinity,
} as const;

// 允许上传的文件类型
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
  'application/pdf',
  'application/zip',
] as const;

// 文件大小限制 100MB
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

// 证书编号前缀
export const CERT_PREFIX = 'WC';

// 文昌链网络标识
export const WENCHANG_NETWORK = {
  MAINNET: 'wenchang-mainnet',
  TESTNET: 'wenchang-testnet',
} as const;

