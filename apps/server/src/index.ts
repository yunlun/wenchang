import 'dotenv/config';
import app from './app';
import { connectDB } from './config/database';
import { logger } from './config/logger';

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  try {
    // 连接 MongoDB
    await connectDB();

    // 启动 HTTP 服务
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
      logger.info(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();

