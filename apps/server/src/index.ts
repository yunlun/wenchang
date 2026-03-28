import * as dotenv from 'dotenv';
// 强制覆盖已有环境变量，确保 .env 里的代理配置生效
dotenv.config({ override: true });

// 主动清除 Cursor 注入的所有代理，让 BSN 请求直连
delete process.env.https_proxy;
delete process.env.HTTPS_PROXY;
delete process.env.http_proxy;
delete process.env.HTTP_PROXY;
delete process.env.all_proxy;
delete process.env.ALL_PROXY;
delete process.env.socks_proxy;
delete process.env.SOCKS_PROXY;
delete process.env.socks5_proxy;
delete process.env.SOCKS5_PROXY;

async function main() {
  const { default: app } = await import('./app');
  const { connectDB } = await import('./config/database');
  const { logger } = await import('./config/logger');

  const PORT = process.env.PORT || 4000;

  try {
    await connectDB();

    app.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
      logger.info(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
      const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || '';
      if (proxy) logger.info(`🌐 BSN proxy: ${proxy}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
