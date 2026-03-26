import { Router } from 'express';
import { z } from 'zod';
import { register, login, getProfile } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate';

const router = Router();

const registerSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
  password: z.string().min(8, '密码至少8位').max(64),
  name: z.string().min(1).max(50),
  studioName: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** POST /api/v1/auth/register */
router.post('/register', validate(registerSchema), register);

/** POST /api/v1/auth/login */
router.post('/login', validate(loginSchema), login);

/** GET /api/v1/auth/me */
router.get('/me', authenticate, getProfile);

export default router;

