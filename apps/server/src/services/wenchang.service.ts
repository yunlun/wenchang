import axios, { AxiosInstance } from 'axios';
import type {
  WenchangSubmitRequest,
  WenchangSubmitResponse,
  WenchangQueryResponse,
} from '@wenchang/shared';
import { logger } from '../config/logger';

/**
 * 文昌链 / BSN 开放联盟链网关 API 服务
 *
 * 接入说明（来自 BSN 文档 7.3.1）：
 * REST 接口地址格式：
 *   {网关}/api/{projectId}/{bsnAccount}/rest/txs      ← 托管签名广播
 *   {网关}/api/{projectId}/{bsnAccount}/rest/{irita接口路径}
 * Header 中需带：x-api-key: {projectKey}
 *
 * 本服务采用「存 Memo 哈希」策略：
 * 把作品 SHA-256 写入一笔链上交易的 memo 字段，
 * 不依赖 WASM 合约，任何开放联盟链项目即可使用。
 */
export class WenchangService {
  private client: AxiosInstance;
  private projectId: string;
  private projectKey: string;
  private bsnAccount: string;
  private chainId: string;
  private fromAddress: string;

  constructor() {
    const baseURL = process.env.WENCHANG_API_URL || 'https://opbningxia.bsngate.com:18602';
    this.projectId = process.env.BSN_PROJECT_ID || process.env.WENCHANG_PROJECT_ID || '';
    this.projectKey = process.env.BSN_PROJECT_KEY || process.env.WENCHANG_API_KEY || '';
    this.bsnAccount = process.env.WENCHANG_BSN_ACCOUNT || '';
    this.chainId = process.env.WENCHANG_CHAIN_ID || 'wenchangchain';
    this.fromAddress = process.env.WENCHANG_FROM_ADDRESS || '';

    if (!this.projectId) throw new Error('请在 .env 中配置 BSN_PROJECT_ID');
    if (!this.projectKey) throw new Error('请在 .env 中配置 BSN_PROJECT_KEY');

    this.client = axios.create({
      baseURL,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.projectKey,
      },
    });

    this.client.interceptors.request.use((config) => {
      logger.debug(`[Wenchang] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
      return config;
    });
  }

  /**
   * 构造 REST 接口路径候选列表
   * 优先用 WENCHANG_SUBMIT_PATH 精确指定，否则自动枚举
   */
  private restPaths(suffix: string): string[] {
    const custom = process.env.WENCHANG_SUBMIT_PATH;
    if (custom) return [custom];

    const bases: string[] = [
      ...(this.bsnAccount
        ? [`/api/${this.projectId}/${this.bsnAccount}/rest`]
        : []),
      `/api/${this.projectId}/rest`,
    ];

    return bases.map((b) => `${b}/${suffix}`);
  }

  /**
   * 提交作品哈希上链
   *
   * 策略：用 irita「bank/send」接口（zero-value 转账），
   * 把 SHA-256 哈希写入 memo 字段，完成链上存证。
   * 这是 BSN 文档中无需合约的最小可行方案。
   */
  async submitHash(payload: WenchangSubmitRequest): Promise<WenchangSubmitResponse> {
    const memo = `WC:${payload.hash}|${payload.metadata.title}|${payload.metadata.author}`;
    const from = this.fromAddress;
    const denom = process.env.WENCHANG_FEE_DENOM || 'ugas';
    const gas = process.env.WENCHANG_GAS || '80000';
    const feeAmount = process.env.WENCHANG_FEE_AMOUNT || '800';

    // BSN 托管签名广播报文（v1 格式）
    const txBody = {
      tx: {
        msg: [
          {
            type: 'cosmos-sdk/MsgSend',
            value: {
              from_address: from,
              to_address: from,          // 零值自发，只是为了把 memo 写链上
              amount: [{ amount: '1', denom }],
            },
          },
        ],
        fee: {
          amount: [{ amount: feeAmount, denom }],
          gas,
        },
        signatures: null,
        memo,
      },
      mode: 'sync',
    };

    const paths = this.restPaths('txs');
    const errors: string[] = [];

    for (const path of paths) {
      try {
        logger.debug(`[Wenchang] trying path: ${path}`);
        const { data } = await this.client.post(path, txBody);

        const raw = (data || {}) as Record<string, unknown>;
        const txHash =
          (raw.txhash as string) ||
          (raw.tx_hash as string) ||
          (raw.txHash as string) ||
          (raw.hash as string) ||
          ((raw.result as { txhash?: string } | undefined)?.txhash) ||
          '';

        // ── 关键：检查链上 code，非 0 表示交易被链拒绝 ──
        const chainCode = raw.code as number | undefined;
        if (chainCode !== undefined && chainCode !== 0) {
          const rawLog = (raw.raw_log as string) || JSON.stringify(raw);
          const msg = `交易被链拒绝 code=${chainCode}: ${rawLog}`;
          logger.error(`[Wenchang] ${path} ${msg}`);
          errors.push(`[${path}] chain_code=${chainCode} raw_log=${rawLog.slice(0, 200)}`);
          continue; // 尝试下一条路径（通常无意义，但保持一致性）
        }

        if (!txHash) {
          logger.warn(`[Wenchang] ${path} returned 2xx but no txHash: ${JSON.stringify(raw)}`);
          errors.push(`[${path}] no_txhash: ${JSON.stringify(raw).slice(0, 200)}`);
          continue;
        }

        logger.info(`[Wenchang] submitHash success txHash=${txHash}`);
        return {
          success: true,
          txHash,
          blockHeight:
            (raw.height as number | undefined) ||
            (raw.block_height as number | undefined),
          fee: `${feeAmount}${denom}`,
          timestamp: new Date().toISOString(),
        };
      } catch (error: unknown) {
        const e = error as { response?: { status?: number; data?: unknown }; message?: string };
        const status = e.response?.status ?? 0;
        const body = JSON.stringify(e.response?.data || {}).slice(0, 300);
        const msg = `[${path}] status=${status} body=${body}`;
        errors.push(msg);
        logger.warn(`[Wenchang] ${msg}`);

        if (body.includes('Non-gRPC')) {
          throw new Error(
            '当前 BSN 网关端口是 gRPC 路由，无法用 HTTP/JSON 调用。' +
            '请去 BSN 控制台查看「接入参数」里的 REST 接口地址（通常端口不同）。'
          );
        }
      }
    }

    const detail = errors.join(' \n');
    logger.error('[Wenchang] submitHash failed all paths:', detail);
    throw new Error(
      `文昌链存证提交失败。\n排查步骤：\n` +
      `1. 确认 WENCHANG_BSN_ACCOUNT 已正确配置（BSN控制台->接入参数）\n` +
      `2. 确认 WENCHANG_FROM_ADDRESS 已配置（链上账户地址）\n` +
      `3. 或设置 WENCHANG_SUBMIT_PATH 为精确接口路径\n` +
      `详细错误：\n${detail}`
    );
  }

  /**
   * 轮询确认交易是否真正上链（广播后链需要几秒出块）
   * 最多等待 maxWaitMs，每隔 intervalMs 查一次
   */
  async waitForConfirmation(
    txHash: string,
    maxWaitMs = 60_000,
    intervalMs = 3_000
  ): Promise<{ confirmed: boolean; blockHeight?: number; timestamp?: string }> {
    const deadline = Date.now() + maxWaitMs;
    const queryPaths = process.env.WENCHANG_QUERY_PATH
      ? [process.env.WENCHANG_QUERY_PATH]
      : [
          ...(this.bsnAccount
            ? [`/api/${this.projectId}/${this.bsnAccount}/rest/txs/${txHash}`]
            : []),
          `/api/${this.projectId}/rest/txs/${txHash}`,
        ];

    while (Date.now() < deadline) {
      for (const fullPath of queryPaths) {
        try {
          const { data } = await this.client.get(fullPath);
          const raw = (data || {}) as Record<string, unknown>;
          const code = raw.code as number | undefined;
          const height = (raw.height as string | number | undefined);

          // code 0 且有 height 表示真正上链
          if ((code === undefined || code === 0) && height) {
            logger.info(`[Wenchang] tx confirmed height=${height} txHash=${txHash}`);
            return {
              confirmed: true,
              blockHeight: typeof height === 'string' ? parseInt(height) : height,
              timestamp: raw.timestamp as string | undefined,
            };
          }
          // code 非 0 表示链上执行失败，不必继续等待
          if (code !== undefined && code !== 0) {
            logger.error(`[Wenchang] tx failed on chain code=${code} raw_log=${raw.raw_log}`);
            return { confirmed: false };
          }
        } catch {
          // 查询失败（404 等）说明还未上链，继续等
        }
      }
      logger.debug(`[Wenchang] waiting for tx confirmation... txHash=${txHash}`);
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    logger.warn(`[Wenchang] tx confirmation timeout txHash=${txHash}`);
    return { confirmed: false };
  }

  /**
   * 查询链上存证记录（按 txHash 查询交易详情）
   */
  async queryByTxHash(txHash: string): Promise<WenchangQueryResponse> {
    const queryPaths = process.env.WENCHANG_QUERY_PATH
      ? [process.env.WENCHANG_QUERY_PATH]
      : [
          ...(this.bsnAccount
            ? [`/api/${this.projectId}/${this.bsnAccount}/rest/txs/${txHash}`]
            : []),
          `/api/${this.projectId}/rest/txs/${txHash}`,
          `/api/${this.projectId}/rpc/tx?hash=0x${txHash}&prove=false`,
        ];

    for (const fullPath of queryPaths) {
      try {
        const { data } = await this.client.get(fullPath);
        const raw = (data || {}) as Record<string, unknown>;
        return {
          found: true,
          txHash:
            (raw.txhash as string) ||
            (raw.tx_hash as string) ||
            txHash,
          blockHeight:
            (raw.height as number | undefined) ||
            (raw.block_height as number | undefined),
          data: raw,
          timestamp: (raw.timestamp as string | undefined),
        };
      } catch {
        // try next
      }
    }

    return { found: false };
  }
}

export const wenchangService = new WenchangService();
