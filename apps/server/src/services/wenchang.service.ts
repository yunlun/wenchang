import axios, { AxiosInstance } from 'axios';
import type {
  WenchangSubmitRequest,
  WenchangSubmitResponse,
  WenchangQueryResponse,
} from '@wenchang/shared';
import { logger } from '../config/logger';

/**
 * 文昌链 API 服务
 * 文档参考: https://docs.irita.io/
 */
export class WenchangService {
  private client: AxiosInstance;

  constructor() {
    const baseURL = process.env.WENCHANG_API_URL || 'https://apis.wenchang.bianjie.ai';

    this.client = axios.create({
      baseURL,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.WENCHANG_API_KEY || '',
        'X-Project-Id': process.env.WENCHANG_PROJECT_ID || '',
      },
    });

    this.client.interceptors.request.use((config) => {
      logger.debug(`[Wenchang] ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });
  }

  /**
   * 是否处于 Mock 模式（未配置真实 API Key 时自动启用）
   */
  private isMock(): boolean {
    const key = process.env.WENCHANG_API_KEY || '';
    return !key || key === 'your-wenchang-api-key';
  }

  /**
   * 提交作品哈希上链存证
   * 实际接口路径需根据文昌链 OpenAPI 文档调整
   */
  async submitHash(payload: WenchangSubmitRequest): Promise<WenchangSubmitResponse> {
    // ── Mock 模式：开发阶段无需真实文昌链账号 ──────────────
    if (this.isMock()) {
      logger.warn('[Wenchang] Running in MOCK mode. Set WENCHANG_API_KEY in .env to use real chain.');
      // 模拟 300ms 网络延迟
      await new Promise((r) => setTimeout(r, 300));
      const mockTxHash = `MOCK-${payload.hash.substring(0, 16).toUpperCase()}-${Date.now()}`;
      return {
        success: true,
        txHash: mockTxHash,
        blockHeight: Math.floor(Math.random() * 1_000_000) + 500_000,
        fee: '0.002IRIS',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const body = {
        class_id: process.env.WENCHANG_CLASS_ID || 'copyright',
        name: payload.metadata.title,
        uri: '',
        uri_hash: payload.hash,
        data: JSON.stringify(payload.metadata),
        recipient: process.env.WENCHANG_RECIPIENT_ADDR || '',
      };

      const { data } = await this.client.post('/v1beta1/nft/nfts', body);

      return {
        success: true,
        txHash: data.tx_hash as string,
        blockHeight: data.height as number | undefined,
        fee: data.gas_fee as string | undefined,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('[Wenchang] submitHash failed:', error);
      throw new Error('文昌链存证提交失败，请稍后重试');
    }
  }


  /**
   * 查询链上存证记录
   */
  async queryByTxHash(txHash: string): Promise<WenchangQueryResponse> {
    try {
      const { data } = await this.client.get(`/v1beta1/tx/${txHash}`);
      return {
        found: true,
        txHash: data.tx_hash as string,
        blockHeight: data.height as number | undefined,
        data: data as Record<string, unknown>,
        timestamp: data.timestamp as string | undefined,
      };
    } catch (error) {
      logger.error('[Wenchang] queryByTxHash failed:', error);
      return { found: false };
    }
  }
}

export const wenchangService = new WenchangService();
