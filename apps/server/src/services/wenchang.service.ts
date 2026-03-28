import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import * as http from 'http';
import * as net from 'net';
import * as tls from 'tls';
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
  private makeHttpsAgent: () => https.Agent;

  constructor() {
    const baseURL = process.env.WENCHANG_API_URL || 'https://opbningxia.bsngate.com:18602';
    this.projectId = process.env.BSN_PROJECT_ID || process.env.WENCHANG_PROJECT_ID || '';
    this.projectKey = process.env.BSN_PROJECT_KEY || process.env.WENCHANG_API_KEY || '';
    this.bsnAccount = process.env.WENCHANG_BSN_ACCOUNT || '';
    this.chainId = process.env.WENCHANG_CHAIN_ID || 'wenchangchain';
    this.fromAddress = process.env.WENCHANG_FROM_ADDRESS || '';

    if (!this.projectId) throw new Error('请在 .env 中配置 BSN_PROJECT_ID');
    if (!this.projectKey) throw new Error('请在 .env 中配置 BSN_PROJECT_KEY');

    const makeHttpsAgent = () => {
      // 强制直连，忽略系统代理（Cursor 注入的动态代理不适用于 BSN）
      return new https.Agent({ rejectUnauthorized: false });
    };

    // httpsAgent 在每次请求时动态创建，确保读到最新的代理配置
    this.makeHttpsAgent = makeHttpsAgent;

    this.client = axios.create({
      baseURL,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.projectKey,
      },
      proxy: false,
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
    const gas = process.env.WENCHANG_GAS || '200000';
    const feeAmount = process.env.WENCHANG_FEE_AMOUNT || '200000';
    const privateKey = process.env.WENCHANG_PRIVATE_KEY || '';
    const publicKey = process.env.WENCHANG_PUBLIC_KEY || '';
    // 文昌链 ugas 受 owner 限制，转账目标需为 owner 地址
    const transferTo = process.env.WENCHANG_TOKEN_OWNER || 'iaa14ffm5gc6g698ckmgp63q49963fra4w5aspmrd9';

    if (!privateKey || !publicKey) {
      throw new Error('请在 .env 中配置 WENCHANG_PRIVATE_KEY 和 WENCHANG_PUBLIC_KEY');
    }

    const httpsAgent = this.makeHttpsAgent();
    logger.info(`[Wenchang] submitHash (secp256k1) from=${from} to=${transferTo} url=${process.env.WENCHANG_API_URL} pub=${publicKey.slice(0, 10)}...`);

    // ── Step 1: 查询账户信息 ──
    const accountPath = `/api/${this.projectId}/rest/cosmos/auth/v1beta1/accounts/${from}`;
    let accountNumber = '0';
    let sequence = '0';
    try {
      const { data } = await this.client.get(accountPath, { httpsAgent });
      const acc = (data?.account?.value || data?.account || data?.result?.value || data?.result || data) as any;
      accountNumber = String(acc?.account_number ?? acc?.accountNumber ?? '0');
      sequence = String(acc?.sequence ?? '0');
      logger.info(`[Wenchang] account_number=${accountNumber} sequence=${sequence}`);
    } catch (e: any) {
      logger.warn(`[Wenchang] Failed to query account: ${e.message}`);
    }

    // ── Step 2: 构建并签名交易 ──
    const { buildSignedTx } = await import('./sm2-signer');
    const { txBytesBase64 } = await buildSignedTx({
      privateKey,
      publicKey,
      fromAddress: from,
      toAddress: transferTo,
      amount: '1',
      denom,
      fee: feeAmount,
      feeDenom: denom,
      gas,
      memo,
      chainId: this.chainId,
      accountNumber,
      sequence,
    });

    // ── Step 3: RPC 广播 ──
    const broadcastPath = `/api/${this.projectId}/rpc`;
    const rpcBody = {
      jsonrpc: '2.0',
      id: 1,
      method: 'broadcast_tx_sync',
      params: { tx: txBytesBase64 },
    };
    const errors: string[] = [];

    try {
      logger.debug(`[Wenchang] broadcasting to: ${broadcastPath}`);
      const { data } = await this.client.post(broadcastPath, rpcBody, { httpsAgent });

      const raw = (data || {}) as Record<string, unknown>;
      const result = (raw.result || {}) as Record<string, unknown>;
      const txHash = (result.hash as string) || (raw.txhash as string) || '';
      const code = result.code as number | undefined;

      if (code !== undefined && code !== 0) {
        const log = (result.log as string) || JSON.stringify(result);
        throw new Error(`交易被链拒绝 code=${code}: ${log.slice(0, 300)}`);
      }

      if (!txHash) {
        throw new Error(`广播成功但未返回 txHash: ${JSON.stringify(raw).slice(0, 200)}`);
      }

      logger.info(`[Wenchang] submitHash success txHash=${txHash}`);
      return {
        success: true,
        txHash,
        fee: `${feeAmount}${denom}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const e = error as { response?: { status?: number; data?: unknown }; message?: string; code?: string };
      const status = e.response?.status ?? 0;
      const body = JSON.stringify(e.response?.data || {}).slice(0, 300);
      const msg = `[${broadcastPath}] status=${status} body=${body} message=${e.message}`;
      errors.push(msg);
      logger.warn(`[Wenchang] ${msg}`);
    }

    const detail = errors.join('\n');
    logger.error('[Wenchang] submitHash failed:', detail);
    throw new Error(`文昌链存证提交失败。\n详细错误：\n${detail}`);
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
