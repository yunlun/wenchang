export interface User {
  _id: string;
  email: string;
  name: string;
  studioName?: string;
  plan: 'free' | 'pro' | 'enterprise';
  usageCount: number;       // 本月存证次数
  usageLimit: number;       // 套餐上限
  createdAt: string;
  updatedAt: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  studioName?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: Omit<User, '_id'>  & { _id: string };
}

