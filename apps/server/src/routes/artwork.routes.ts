import { Router } from 'express';
import { z } from 'zod';
import { uploadArtwork, listArtworks, getArtwork, queryArtworkTx } from '../controllers/artwork.controller';
import { authenticate, checkQuota } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate';
import { upload } from '../config/multer';

const router = Router();

const createArtworkSchema = z.object({
  title: z.string().min(1, '请输入作品标题').max(200),
  description: z.string().max(2000).optional(),
  category: z.enum([
    'illustration', 'photography', 'design',
    'video', 'audio', 'document', 'other',
  ]),
});

// 所有路由需要认证
router.use(authenticate);

/** GET /api/v1/artworks */
router.get('/', listArtworks);

/** GET /api/v1/artworks/:id */
router.get('/:id', getArtwork);

/** GET /api/v1/artworks/:id/tx */
router.get('/:id/tx', queryArtworkTx);

/** POST /api/v1/artworks  (multipart/form-data) */
router.post(
  '/',
  checkQuota,
  upload.single('file'),
  validate(createArtworkSchema),
  uploadArtwork
);

export default router;

