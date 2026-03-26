import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';
import authRoutes from './routes/auth.routes';
import artworkRoutes from './routes/artwork.routes';
import certificateRoutes from './routes/certificate.routes';

const app = express();

// ── 安全与基础中间件 ─────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // 允许无 origin 的请求（curl、服务端等）
      if (!origin) return callback(null, true);
      const allowed = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001')
        .split(',')
        .map((o) => o.trim());
      if (allowed.includes(origin)) return callback(null, true);
      callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── 全局限流 ─────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '请求过于频繁，请稍后重试' },
});
app.use('/api', limiter);

// ── 健康检查 ─────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API 路由 ─────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/artworks', artworkRoutes);
app.use('/api/v1/certificates', certificateRoutes);

// ── 404 & 全局错误处理 ───────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
