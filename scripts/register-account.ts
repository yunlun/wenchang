/**
 * 向 BSN 网关注册链账户地址
 * 文档 7.4.1: POST /api/{projectId}/account/generate
 * 运行：pnpm dlx tsx scripts/register-account.ts
 */
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../apps/server/.env') });

const BASE_URL   = process.env.WENCHANG_API_URL  || '';
const PROJECT_ID = process.env.BSN_PROJECT_ID    || '';
const PROJECT_KEY= process.env.BSN_PROJECT_KEY   || '';
const ADDRESS    = process.env.WENCHANG_FROM_ADDRESS || '';

if (!BASE_URL || !PROJECT_ID || !PROJECT_KEY || !ADDRESS) {
  console.error('缺少必要的环境变量，请先配置 apps/server/.env');
  process.exit(1);
}

const chainClientName = `wc_${ADDRESS.slice(-8)}`;

console.log('\n注册链账户到 BSN 网关...');
console.log('网关地址:', BASE_URL);
console.log('项目 ID :', PROJECT_ID);
console.log('账户名称:', chainClientName);
console.log('链上地址:', ADDRESS, '\n');

async function main(): Promise<void> {
  try {
    const { data } = await axios.post(
      `${BASE_URL}/api/${PROJECT_ID}/account/generate`,
      { chainClientName, chainClientAddr: ADDRESS },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': PROJECT_KEY,
        },
        timeout: 15_000,
      }
    );

    console.log('✅ 注册成功！响应：', JSON.stringify(data, null, 2));
    console.log('\n请将以下内容更新到 apps/server/.env:');
    console.log(`WENCHANG_BSN_ACCOUNT=${chainClientName}`);
  } catch (err: unknown) {
    const e = err as { response?: { status?: number; data?: unknown }; message?: string };
    console.error('❌ 注册失败');
    console.error('状态码:', e.response?.status);
    console.error('响应体:', JSON.stringify(e.response?.data || e.message, null, 2));
  }
}

main();
