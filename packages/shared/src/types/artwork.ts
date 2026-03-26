export type ArtworkStatus =
  | 'pending'       // 已上传，等待处理
  | 'hashing'       // 正在计算 Hash
  | 'submitting'    // 正在提交文昌链
  | 'confirmed'     // 链上确认完成
  | 'failed';       // 存证失败

export interface Artwork {
  _id: string;
  userId: string;
  title: string;
  description?: string;
  category: ArtworkCategory;
  fileName: string;
  fileSize: number;         // bytes
  mimeType: string;
  storageKey: string;       // OSS / 本地路径 key
  sha256Hash: string;       // 文件 SHA-256
  status: ArtworkStatus;
  blockchainTxHash?: string;
  certificateId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ArtworkCategory =
  | 'illustration'
  | 'photography'
  | 'design'
  | 'video'
  | 'audio'
  | 'document'
  | 'other';

export interface CreateArtworkDto {
  title: string;
  description?: string;
  category: ArtworkCategory;
}

export interface ArtworkListResponse {
  data: Artwork[];
  total: number;
  page: number;
  pageSize: number;
}

