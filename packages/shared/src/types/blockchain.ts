// 文昌链 API 相关类型
export interface WenchangSubmitRequest {
  hash: string;             // 作品 SHA-256
  metadata: {
    title: string;
    author: string;
    studio?: string;
    timestamp: number;
    fileSize: number;
    mimeType: string;
  };
}

export interface WenchangSubmitResponse {
  success: boolean;
  txHash: string;
  blockHeight?: number;
  fee?: string;
  timestamp: string;
}

export interface WenchangQueryResponse {
  found: boolean;
  txHash?: string;
  blockHeight?: number;
  data?: Record<string, unknown>;
  timestamp?: string;
}

