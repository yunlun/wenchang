import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { certificateService } from '../services/certificate.service';
import { CertificateModel } from '../models/Certificate.model';
import { AppError } from '../middlewares/errorHandler';

export const listCertificates = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const certs = await CertificateModel.find({ userId: req.user!.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ code: 0, data: certs });
  } catch (error) {
    next(error);
  }
};

export const getCertificate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const cert = await CertificateModel.findOne({
      _id: req.params.id,
      userId: req.user!.id,
    }).lean();
    if (!cert) throw new AppError('证书不存在', 404);
    res.json({ code: 0, data: cert });
  } catch (error) {
    next(error);
  }
};

export const downloadCertificate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const cert = await CertificateModel.findOne({
      _id: req.params.id,
      userId: req.user!.id,
    }).lean();
    if (!cert) throw new AppError('证书不存在', 404);

    // 重新生成 PDF，确保使用最新模板（避免旧乱码文件）
    const pdfPath = await certificateService.generatePDF(cert as any);

    res.download(pdfPath, `${cert.certNo}.pdf`);
  } catch (error) {
    next(error);
  }
};

/** 公开核验接口（无需登录） */
export const verifyCertificate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await certificateService.verifyCertificate(req.params.certNo);
    res.json({ code: 0, data: result });
  } catch (error) {
    next(error);
  }
};

