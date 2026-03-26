import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User.model';
import { PLAN_LIMITS } from '@wenchang/shared';
import type { RegisterDto, LoginDto } from '@wenchang/shared';
import { AppError } from '../middlewares/errorHandler';

export class AuthService {
  private signToken(userId: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new AppError('JWT_SECRET 未配置', 500);
    return jwt.sign({ sub: userId }, secret, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    } as jwt.SignOptions);
  }

  async register(dto: RegisterDto) {
    const exists = await UserModel.findOne({ email: dto.email }).lean();
    if (exists) throw new AppError('该邮箱已注册', 409);

    const user = await UserModel.create({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      studioName: dto.studioName,
      plan: 'free',
      usageCount: 0,
      usageLimit: PLAN_LIMITS.free,
    });

    const token = this.signToken((user._id as { toString(): string }).toString());
    return {
      token,
      user: {
        _id: (user._id as { toString(): string }).toString(),
        email: user.email,
        name: user.name,
        studioName: user.studioName,
        plan: user.plan,
        usageCount: user.usageCount,
        usageLimit: user.usageLimit,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await UserModel.findOne({ email: dto.email }).select('+password');
    if (!user) throw new AppError('邮箱或密码错误', 401);

    const valid = await user.comparePassword(dto.password);
    if (!valid) throw new AppError('邮箱或密码错误', 401);

    const token = this.signToken((user._id as { toString(): string }).toString());
    return {
      token,
      user: {
        _id: (user._id as { toString(): string }).toString(),
        email: user.email,
        name: user.name,
        studioName: user.studioName,
        plan: user.plan,
        usageCount: user.usageCount,
        usageLimit: user.usageLimit,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await UserModel.findById(userId).lean();
    if (!user) throw new AppError('用户不存在', 404);
    return user;
  }
}

export const authService = new AuthService();

