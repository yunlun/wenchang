import axios, { AxiosInstance } from 'axios';
import type {
  WenchangSubmitRequest,
  WenchangSubmitResponse,
  WenchangQueryResponse,
} from '@wenchang/shared';
import { logger } from '../config/logger';

/**
 * 文昌链 / BSN 网关 API 服务
 * 说明：不同 BSN 网关版本在「鉴权头」和「接口路径」上存在差异，
 * 这里做了多组兼容尝试，优先走环境变量显式配置。
 */
export class WenchangService {
  private client: AxiosInstance;
  private baseURL: string;
  private projectId: string;
  private projectKey: string;
  private chainId: string;
  private gasPrice: string;

  constructor() {
    this.baseURL =
      process.env.WENCHANG_API_URL || 'https://opbningxia.bsngate.com:18602';

    this.projectId =
      process.env.BSN_PROJECT_ID ||
      process.env.WENCHANG_PROJECT_ID ||
      '';

    this.projectKey =
      process.env.BSN_PROJECT_KEY ||
      process.env.WENCHANG_API_KEY ||
      '';

    this.chainId = process.env.WENCHANG_CHAIN_ID || 'wenchangchain';
    this.gasPrice = process.env.WENCHANG_GAS_PRICE || '1.0';

    if (!this.projectId) {
      throw new Error('请配置 BSN_PROJECT_ID（或 WENCHANG_PROJECT_ID）');
    }
    if (!this.projectKey) {
      throw new Error('请配置 BSN_PROJECT_KEY（或 WENCHANG_API_KEY）');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      logger.debug(`[Wenchang] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
      return config;
    });
  }

  private submitPathCandidates(): string[] {
    const custom = process.env.WENCHANG_SUBMIT_PATH;
    const defaults = [
      '/v1beta1/nft/nfts',
      '/api/v1beta1/nft/nfts',
      '/api/v1/nft/nfts',
    ];
    return custom ? [custom, ...defaults.filter((p) => p !== custom)] : defaults;
  }

  private queryPathCandidates(): string[] {
    const custom = process.env.WENCHANG_QUERY_PATH;
    const defaults = ['/v1beta1/tx', '/api/v1beta1/tx', '/api/v1/tx'];
    return custom ? [custom, ...defaults.filter((p) => p !== custom)] : defaults;
  }

  private authHeaderCandidates(): Record<string, string>[] {
    return [
      {
        'X-Project-Id': this.projectId,
        'X-Api-Key': this.projectKey,
      },
      {
        projectId: this.projectId,
        projectKey: this.projectKey,
      },
      {
        appId: this.projectId,
        appKey: this.projectKey,
      },
    ];
  }

  private buildBodyCandidates(payload: WenchangSubmitRequest): Record<string, unknown>[] {
    const nftBody = {
      class_id: process.env.WENCHANG_CLASS_ID || 'copyright',
      name: payload.metadata.title,
      uri: '',
      uri_hash: payload.hash,
      data: JSON.stringify(payload.metadata),
      recipient: process.env.WENCHANG_RECIPIENT_ADDR || '',
    };

    return [
      // 版本1：直接 NFT body
      nftBody,
      // 版本2：带链参数包裹
      {
        chain_id: this.chainId,
        gas_price: this.gasPrice,
        data: nftBody,
      },
      // 版本3：另一种命名
      {
        chainId: this.chainId,
        gasPrice: this.gasPrice,
        body: nftBody,
      },
    ];
  }

  private normalizeSubmitResponse(data: Record<string, unknown>): WenchangSubmitResponse {
    const txHash =
      (data.tx_hash as string) ||
      (data.txHash as string) ||
      (data.hash as string) ||
      (data.result as { txHash?: string } | undefined)?.txHash ||
      '';

    if (!txHash) {
      throw new Error(`网关返回成功但未找到 txHash: ${JSON.stringify(data)}`);
    }

    return {
      success: true,
      txHash,
      blockHeight:
        (data.height as number | undefined) ||
        (data.block_height as number | undefined) ||
        (data.blockHeight as number | undefined),
      fee: (data.gas_fee as string | undefined) || (data.fee as string | undefined),
      timestamp: (data.timestamp as string | undefined) || new Date().toISOString(),
    };
  }

  /**
   * 提交作品哈希上链存证
   */
  async submitHash(payload: WenchangSubmitRequest): Promise<WenchangSubmitResponse> {
    const errors: string[] = [];
    const paths = this.submitPathCandidates();
    const headersList = this.authHeaderCandidates();
    const bodies = this.buildBodyCandidates(payload);

    for (const path of paths) {
      for (const headers of headersList) {
        for (const body of bodies) {
          try {
            const { data } = await this.client.post(path, body, {
              headers: {
                ...headers,
                'X-Chain-Id': this.chainId,
                'X-Gas-Price': this.gasPrice,
              },
            });

            return this.normalizeSubmitResponse((data || {}) as Record<string, unknown>);
          } catch (error: unknown) {
            const msg =
              (error as { response?: { status?: number; data?: unknown }; message?: string })
                .response?.status
                ? `[${path}] status=${(error as { response?: { status?: number } }).response?.status} body=${JSON.stringify((error as { response?: { data?: unknown } }).response?.data || {})}`
                : `[${path}] ${(error as { message?: string }).message || 'unknown error'}`;
            errors.push(msg);
          }
        }
      }
    }

    const allErrors = errors.join(' | ');
    logger.error('[Wenchang] submitHash failed all strategies:', allErrors);

    if (allErrors.includes('Non-gRPC request matched gRPC route')) {
      throw new Error(
        '当前 BSN 网关是 gRPC 路由，不支持 axios 的 HTTP JSON 调用。请改用 gRPC 客户端，或向 BSN 控制台确认可用的 HTTP/OpenAPI 网关地址。'
      );
    }

    throw new Error(
      '文昌链存证提交失败，请检查 BSN 网关地址/项目ID/项目Key/接口路径。可在 WENCHANG_SUBMIT_PATH 指定准确路径。'
    );
  }

  /**
   * 查询链上存证记录
   */
  async queryByTxHash(txHash: string): Promise<WenchangQueryResponse> {
    const paths = this.queryPathCandidates();

    for (const basePath of paths) {
      try {
        const { data } = await this.client.get(`${basePath}/${txHash}`, {
          headers: {
            'X-Project-Id': this.projectId,
            'X-Api-Key': this.projectKey,
            projectId: this.projectId,
            projectKey: this.projectKey,
          },
        });

        return {
          found: true,
          txHash: ((data as { tx_hash?: string; txHash?: string }).tx_hash ||
            (data as { txHash?: string }).txHash ||
            txHash) as string,
          blockHeight:
            (data as { height?: number; block_height?: number }).height ||
            (data as { block_height?: number }).block_height,
          data: (data || {}) as Record<string, unknown>,
          timestamp: (data as { timestamp?: string }).timestamp,
        };
      } catch {
        // try next path
      }
    }

    return { found: false };
  }
}

export const wenchangService = new WenchangService();
