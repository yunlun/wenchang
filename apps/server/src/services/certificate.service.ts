import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { CERT_PREFIX, WENCHANG_NETWORK } from '@wenchang/shared';
import { CertificateModel, ICertificate } from '../models/Certificate.model';
import { ArtworkModel } from '../models/Artwork.model';
import { UserModel } from '../models/User.model';
import { logger } from '../config/logger';

export interface IssueCertInput {
  artworkId: string;
  userId: string;
  txHash: string;
  blockHeight?: number;
}

export class CertificateService {
  /**
   * 生成证书编号: WC-YYYYMMDD-XXXXXX
   */
  private generateCertNo(): string {
    const date = dayjs().format('YYYYMMDD');
    const random = uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase();
    return `${CERT_PREFIX}-${date}-${random}`;
  }

  /**
   * 颁发确权证书并生成 PDF
   */
  async issueCertificate(input: IssueCertInput): Promise<ICertificate> {
    const [artwork, user] = await Promise.all([
      ArtworkModel.findById(input.artworkId).lean(),
      UserModel.findById(input.userId).lean(),
    ]);

    if (!artwork) throw new Error('作品不存在');
    if (!user) throw new Error('用户不存在');

    const certNo = this.generateCertNo();
    const issuedAt = new Date();
    const verifyUrl = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/verify/${certNo}`;

    // 创建证书记录
    const cert = await CertificateModel.create({
      artworkId: artwork._id,
      userId: user._id,
      certNo,
      ownerName: user.name,
      studioName: user.studioName,
      artworkTitle: artwork.title,
      artworkHash: artwork.sha256Hash,
      blockchainNetwork: process.env.NODE_ENV === 'production'
        ? WENCHANG_NETWORK.MAINNET
        : WENCHANG_NETWORK.TESTNET,
      txHash: input.txHash,
      blockHeight: input.blockHeight,
      issuedAt,
      verifyUrl,
    });

    // 异步生成 PDF（不阻塞响应）
    this.generatePDF(cert).catch((err) =>
      logger.error(`[Certificate] PDF generation failed for ${certNo}:`, err)
    );

    return cert;
  }

  /**
   * 生成确权证书 PDF
   */
  async generatePDF(cert: ICertificate): Promise<string> {
    const certsDir = path.join(process.cwd(), 'certificates');
    if (!fs.existsSync(certsDir)) fs.mkdirSync(certsDir, { recursive: true });

    const filePath = path.join(certsDir, `${cert.certNo}.pdf`);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 60 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // ── 页面装饰 ──────────────────────────────────
      doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).stroke('#C9A84C');

      // ── Header ─────────────────────────────────────
      doc
        .font('Helvetica-Bold')
        .fontSize(28)
        .fillColor('#1a1a2e')
        .text('DIGITAL COPYRIGHT CERTIFICATE', { align: 'center' })
        .moveDown(0.6);

      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#666')
        .text('Issued by Wenchang Copyright Preservation Platform', { align: 'center' })
        .moveDown(1.6);

      // ── Certificate fields (ASCII-only, avoid CJK font encoding issues) ──
      const fields: [string, string][] = [
        ['Certificate No', cert.certNo],
        ['Owner', cert.ownerName],
        ['Studio', cert.studioName || '-'],
        ['Artwork Title', cert.artworkTitle],
        ['File Hash (SHA-256)', cert.artworkHash],
        ['Blockchain Network', cert.blockchainNetwork],
        ['Transaction Hash', cert.txHash],
        ['Issued At', dayjs(cert.issuedAt).format('YYYY-MM-DD HH:mm:ss')],
        ['Verification URL', cert.verifyUrl],
      ];

      fields.forEach(([label, value]) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#333')
          .text(`${label}:`)
          .font('Helvetica')
          .fillColor('#555')
          .text(value, {
            width: doc.page.width - 120,
          });
        doc.moveDown(0.45);
      });

      doc.end();

      stream.on('finish', () => {
        logger.info(`[Certificate] PDF generated: ${filePath}`);
        // 更新 pdfKey
        CertificateModel.findByIdAndUpdate(cert._id, { pdfKey: filePath }).exec();
        resolve(filePath);
      });
      stream.on('error', reject);
    });
  }

  /**
   * 公开核验证书
   */
  async verifyCertificate(certNo: string) {
    const cert = await CertificateModel.findOne({ certNo }).lean();
    if (!cert) return { valid: false };
    return { valid: true, certificate: cert };
  }
}

export const certificateService = new CertificateService();

