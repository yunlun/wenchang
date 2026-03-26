import { Request, Response } from 'express';

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    code: 404,
    message: `路由不存在: ${req.method} ${req.originalUrl}`,
  });
}

