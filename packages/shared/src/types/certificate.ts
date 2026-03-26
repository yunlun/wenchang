export interface Certificate {
  _id: string;
  artworkId: string;
  userId: string;
  certNo: string;           // 证书编号，格式: WC-YYYYMMDD-XXXXXX
  ownerName: string;
  studioName?: string;
  artworkTitle: string;
  artworkHash: string;
  blockchainNetwork: string; // e.g. 'wenchang-mainnet'
  txHash: string;
  blockHeight?: number;
  issuedAt: string;
  pdfKey?: string;          // 生成的 PDF 存储 key
  verifyUrl: string;        // 公开核验链接
}

export interface CertificateVerifyResponse {
  valid: boolean;
  certificate?: Certificate;
  onChainData?: {
    txHash: string;
    blockHeight: number;
    timestamp: string;
    hash: string;
  };
}

