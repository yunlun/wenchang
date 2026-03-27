/**
 * 向 BSN 网关注册链账户地址（使用 Node.js 内置 https 模块）
 * 运行：node scripts/register-account.cjs
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

// 手动读取 .env
const envPath = path.join(__dirname, '../apps/server/.env');
const envVars = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
  });
}

const BASE_URL    = envVars.WENCHANG_API_URL  || '';
const PROJECT_ID  = envVars.BSN_PROJECT_ID   || '';
const PROJECT_KEY = envVars.BSN_PROJECT_KEY  || '';
const ADDRESS     = envVars.WENCHANG_FROM_ADDRESS || '';

if (!BASE_URL || !PROJECT_ID || !PROJECT_KEY || !ADDRESS) {
  console.error('❌ 缺少必要的环境变量，请先配置 apps/server/.env');
  console.error('需要：WENCHANG_API_URL, BSN_PROJECT_ID, BSN_PROJECT_KEY, WENCHANG_FROM_ADDRESS');
  process.exit(1);
}

const chainClientName = `wc_${ADDRESS.slice(-8)}`;
const body = JSON.stringify({ chainClientName, chainClientAddr: ADDRESS });

const url = new URL(`/api/${PROJECT_ID}/account/generate`, BASE_URL);
console.log('\n注册链账户到 BSN 网关...');
console.log('请求地址:', url.toString());
console.log('账户名称:', chainClientName);
console.log('链上地址:', ADDRESS, '\n');

const options = {
  hostname: url.hostname,
  port: url.port || 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'x-api-key': PROJECT_KEY,
  },
  rejectUnauthorized: false,
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('HTTP 状态码:', res.statusCode);
    try {
      const json = JSON.parse(data);
      console.log('响应：', JSON.stringify(json, null, 2));
      if (res.statusCode === 200 || json.code === 0) {
        console.log('\n✅ 注册成功！请将以下内容加入 apps/server/.env:');
        console.log(`WENCHANG_BSN_ACCOUNT=${chainClientName}`);
      }
    } catch {
      console.log('响应（原始）:', data);
    }
  });
});

req.on('error', (e) => console.error('❌ 请求失败:', e.message));
req.write(body);
req.end();

