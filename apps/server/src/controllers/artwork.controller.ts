import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { artworkService } from '../services/artwork.service';
import { AppError } from '../middlewares/errorHandler';

export const uploadArtwork = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) throw new AppError('请上传作品文件', 400);
    const artwork = await artworkService.createAndProcess(
      req.user!.id,
      req.body,
      req.file
    );
    res.status(202).json({
      code: 0,
      message: '作品上传成功，正在后台进行存证处理',
      data: artwork,
    });
  } catch (error) {
    next(error);
  }
};

export const listArtworks = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt((req.query.page as string) || '1', 10);
    const pageSize = parseInt((req.query.pageSize as string) || '20', 10);
    const result = await artworkService.getArtworksByUser(
      req.user!.id,
      page,
      pageSize
    );
    res.json({ code: 0, data: result });
  } catch (error) {
    next(error);
  }
};

export const getArtwork = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const artwork = await artworkService.getArtworkById(
      req.params.id,
      req.user!.id
    );
    if (!artwork) throw new AppError('作品不存在', 404);
    res.json({ code: 0, data: artwork });
  } catch (error) {
    next(error);
  }
};

