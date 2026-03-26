import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User.model';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    plan: string;
    usageCount: number;
    usageLimit: number;
  };
}

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('未提供认证令牌', 401);
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new AppError('服务配置错误', 500);

    const decoded = jwt.verify(token, secret) as { sub: string };
    const user = await UserModel.findById(decoded.sub).lean();
    if (!user) throw new AppError('用户不存在', 401);

    req.user = {
      id: (user._id as { toString(): string }).toString(),
      email: user.email,
      plan: user.plan,
      usageCount: user.usageCount,
      usageLimit: user.usageLimit,
    };
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    next(new AppError('令牌无效或已过期', 401));
  }
};

/** 检查存证配额 */
export const checkQuota = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const user = req.user!;
  if (user.usageCount >= user.usageLimit) {
    return next(new AppError(`本月存证配额已用尽 (${user.usageLimit} 次)，请升级套餐`, 403));
  }
  next();
};

