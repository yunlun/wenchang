import { Router } from 'express';
import {
  listCertificates,
  getCertificate,
  downloadCertificate,
  verifyCertificate,
} from '../controllers/certificate.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

/** GET /api/v1/certificates/verify/:certNo  (公开核验，无需登录) */
router.get('/verify/:certNo', verifyCertificate);

// 以下路由需要认证
router.use(authenticate);

/** GET /api/v1/certificates */
router.get('/', listCertificates);

/** GET /api/v1/certificates/:id */
router.get('/:id', getCertificate);

/** GET /api/v1/certificates/:id/download */
router.get('/:id/download', downloadCertificate);

export default router;

