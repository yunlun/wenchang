import path from 'path';
import fs from 'fs';
import { ArtworkModel } from '../models/Artwork.model';
import { UserModel } from '../models/User.model';
import { computeFileSHA256 } from './hash.service';
import { wenchangService } from './wenchang.service';
import { certificateService } from './certificate.service';
import { logger } from '../config/logger';
import type { CreateArtworkDto } from '@wenchang/shared';

export class ArtworkService {
  /**
   * 上传作品 -> 计算 Hash -> 上链存证 -> 颁发证书
   * 整个流程异步执行，前端通过轮询 status 获取进度
   */
  async createAndProcess(
    userId: string,
    dto: CreateArtworkDto,
    file: Express.Multer.File
  ) {
    // 1. 创建初始记录
    const artwork = await ArtworkModel.create({
      userId,
      title: dto.title,
      description: dto.description,
      category: dto.category,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      storageKey: file.filename,
      sha256Hash: 'pending',
      status: 'hashing',
    });

    // 2. 异步处理（不阻塞 HTTP 响应）
    this.processArtwork(artwork.id as string, userId, file.path).catch(
      (err) => logger.error(`[Artwork] processArtwork failed ${artwork.id}:`, err)
    );

    return artwork;
  }

  private async processArtwork(
    artworkId: string,
    userId: string,
    filePath: string
  ): Promise<void> {
    try {
      // ── Step 1: 计算 SHA-256 ──────────────────────────
      logger.info(`[Artwork] Computing hash for ${artworkId}`);
      const sha256Hash = await computeFileSHA256(filePath);

      await ArtworkModel.findByIdAndUpdate(artworkId, {
        sha256Hash,
        status: 'submitting',
      });

      // ── Step 2: 查询是否已存证（防重） ──────────────────
      const existing = await ArtworkModel.findOne({
        sha256Hash,
        userId,
        status: 'confirmed',
      }).lean();

      if (existing) {
        await ArtworkModel.findByIdAndUpdate(artworkId, {
          status: 'failed',
          errorMessage: '该作品已存在确认的存证记录，请勿重复提交',
        });
        return;
      }

      // ── Step 3: 提交文昌链 ───────────────────────────
      logger.info(`[Artwork] Submitting to Wenchang chain: ${sha256Hash}`);
      const artwork = await ArtworkModel.findById(artworkId).lean();
      if (!artwork) return;

      const user = await UserModel.findById(userId).lean();
      if (!user) return;

      const chainResult = await wenchangService.submitHash({
        hash: sha256Hash,
        metadata: {
          title: artwork.title,
          author: user.name,
          studio: user.studioName,
          timestamp: Date.now(),
          fileSize: artwork.fileSize,
          mimeType: artwork.mimeType,
        },
      });

      // ── Step 3b: 轮询等待链上确认 ────────────────────
      logger.info(`[Artwork] Waiting for on-chain confirmation: ${chainResult.txHash}`);
      await ArtworkModel.findByIdAndUpdate(artworkId, { status: 'submitting' });

      const confirmation = await wenchangService.waitForConfirmation(chainResult.txHash);

      if (!confirmation.confirmed) {
        // 广播出去了但链上没确认（余额不足、格式错误等）
        await ArtworkModel.findByIdAndUpdate(artworkId, {
          status: 'failed',
          blockchainTxHash: chainResult.txHash,
          errorMessage: '交易已广播但链上未确认，可能原因：账户余额不足（ugas）或交易格式错误',
        });
        return;
      }

      await ArtworkModel.findByIdAndUpdate(artworkId, {
        blockchainTxHash: chainResult.txHash,
        status: 'confirmed',
      });

      // ── Step 4: 颁发证书 ─────────────────────────────
      logger.info(`[Artwork] Issuing certificate for ${artworkId}`);
      const cert = await certificateService.issueCertificate({
        artworkId,
        userId,
        txHash: chainResult.txHash,
        blockHeight: chainResult.blockHeight,
      });

      await ArtworkModel.findByIdAndUpdate(artworkId, {
        certificateId: cert._id,
      });

      // ── Step 5: 扣减配额 ─────────────────────────────
      await UserModel.findByIdAndUpdate(userId, { $inc: { usageCount: 1 } });

      // ── Step 6: 清理临时文件 ─────────────────────────
      fs.unlink(filePath, (err) => {
        if (err) logger.warn(`[Artwork] Failed to delete temp file: ${filePath}`);
      });

      logger.info(`[Artwork] Process completed for ${artworkId}, certNo: ${cert.certNo}`);
    } catch (error) {
      logger.error(`[Artwork] Process failed for ${artworkId}:`, error);
      await ArtworkModel.findByIdAndUpdate(artworkId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : '未知错误',
      });
    }
  }

  async getArtworksByUser(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      ArtworkModel.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      ArtworkModel.countDocuments({ userId }),
    ]);
    return { data, total, page, pageSize };
  }

  async getArtworkById(artworkId: string, userId: string) {
    return ArtworkModel.findOne({ _id: artworkId, userId }).lean();
  }
}

export const artworkService = new ArtworkService();

