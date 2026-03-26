'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileCheck, Award, LogOut, Shield, Plus, Loader2, CheckCircle, Clock, XCircle, RefreshCw } from 'lucide-react';
import { artworkApi, authApi, certificateApi } from '@/lib/api';
import dayjs from 'dayjs';

type ArtworkStatus = 'pending' | 'hashing' | 'submitting' | 'confirmed' | 'failed';

interface Artwork {
  _id: string;
  title: string;
  category: string;
  status: ArtworkStatus;
  sha256Hash: string;
  fileSize: number;
  createdAt: string;
  blockchainTxHash?: string;
}

interface User {
  name: string;
  email: string;
  plan: string;
  usageCount: number;
  usageLimit: number;
}

const STATUS_MAP: Record<ArtworkStatus, { label: string; icon: React.ReactNode; color: string }> = {
  pending:    { label: '等待处理', icon: <Clock className="h-3.5 w-3.5" />,         color: 'text-yellow-500 bg-yellow-50' },
  hashing:    { label: '计算哈希', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: 'text-blue-500 bg-blue-50' },
  submitting: { label: '上链中',   icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: 'text-purple-500 bg-purple-50' },
  confirmed:  { label: '存证完成', icon: <CheckCircle className="h-3.5 w-3.5" />,   color: 'text-green-600 bg-green-50' },
  failed:     { label: '存证失败', icon: <XCircle className="h-3.5 w-3.5" />,       color: 'text-red-500 bg-red-50' },
};

const CATEGORIES = [
  { value: 'illustration', label: '插画' },
  { value: 'photography',  label: '摄影' },
  { value: 'design',       label: '设计' },
  { value: 'video',        label: '视频' },
  { value: 'audio',        label: '音频' },
  { value: 'document',     label: '文档' },
  { value: 'other',        label: '其他' },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [form, setForm] = useState({ title: '', category: 'illustration', description: '' });
  const [file, setFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'artworks' | 'certificates'>('artworks');

  useEffect(() => {
    const token = localStorage.getItem('wc_token');
    if (!token) { router.push('/auth/login'); return; }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [meRes, artRes] = await Promise.all([
        authApi.me(),
        artworkApi.list(),
      ]);
      setUser(meRes.data.data);
      setArtworks(artRes.data.data.data || []);
    } catch {
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setUploadError('请选择文件'); return; }
    setUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', form.title);
      fd.append('category', form.category);
      fd.append('description', form.description);
      await artworkApi.upload(fd);
      setShowUpload(false);
      setForm({ title: '', category: 'illustration', description: '' });
      setFile(null);
      await loadData();
    } catch (err: unknown) {
      setUploadError(
        (err as { response?: { data?: { message?: string } } }).response?.data?.message || '上传失败'
      );
    } finally {
      setUploading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('wc_token');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── 顶栏 ── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-bold">文昌存证</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.name}</span>
            <button onClick={logout} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <LogOut className="h-4 w-4" /> 退出
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* ── 统计卡片 ── */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">本月存证</p>
            <p className="mt-1 text-3xl font-bold">{user?.usageCount ?? 0}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">/ {user?.usageLimit === Infinity ? '无限' : user?.usageLimit} 次</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">作品总数</p>
            <p className="mt-1 text-3xl font-bold">{artworks.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">当前套餐</p>
            <p className="mt-1 text-2xl font-bold capitalize">{user?.plan}</p>
          </div>
        </div>

        {/* ── Tab + 上传按钮 ── */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
            {(['artworks', 'certificates'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'artworks' ? <><Upload className="h-3.5 w-3.5" /> 我的作品</> : <><Award className="h-3.5 w-3.5" /> 确权证书</>}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> 上传作品存证
          </button>
        </div>

        {/* ── 作品列表 ── */}
        {activeTab === 'artworks' && (
          <div className="space-y-3">
            {artworks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 py-20">
                <FileCheck className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-muted-foreground">还没有作品，点击右上角「上传作品存证」开始</p>
              </div>
            ) : (
              artworks.map((a) => {
                const s = STATUS_MAP[a.status];
                return (
                  <div key={a._id} className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 transition-shadow hover:shadow-md">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{a.title}</p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground truncate">
                        {a.sha256Hash !== 'pending' ? a.sha256Hash : '—'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{dayjs(a.createdAt).format('YYYY-MM-DD HH:mm')}</p>
                    </div>
                    <div className={`ml-4 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${s.color}`}>
                      {s.icon} {s.label}
                    </div>
                  </div>
                );
              })
            )}
            {artworks.length > 0 && (
              <button onClick={loadData} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <RefreshCw className="h-3.5 w-3.5" /> 刷新状态
              </button>
            )}
          </div>
        )}

        {/* ── 证书列表（占位） ── */}
        {activeTab === 'certificates' && (
          <CertificatesTab />
        )}
      </main>

      {/* ── 上传弹窗 ── */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowUpload(false)}>
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-5 text-lg font-bold">上传作品存证</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">作品标题 *</label>
                <input
                  required value={form.title}
                  onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring"
                  placeholder="我的设计作品"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">作品类型 *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">选择文件 *</label>
                <input
                  type="file" required
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary"
                />
              </div>
              {uploadError && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{uploadError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowUpload(false)}
                  className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors">取消</button>
                <button type="submit" disabled={uploading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {uploading ? '上传中...' : '确认存证'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CertificatesTab() {
  const [certs, setCerts] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    certificateApi.list()
      .then(res => setCerts(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (id: string, certNo: string) => {
    setDownloading(id);
    try {
      const res = await certificateApi.download(id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${certNo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('证书下载失败，请稍后重试');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (certs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 py-20">
        <Award className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="text-muted-foreground">完成存证后证书将在此显示</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {(certs as Record<string, string>[]).map((c) => (
        <div key={c._id} className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 hover:shadow-md transition-shadow">
          <div>
            <p className="font-medium">{c.artworkTitle}</p>
            <p className="mt-0.5 text-sm text-muted-foreground font-mono">{c.certNo}</p>
            <p className="mt-1 text-xs text-muted-foreground">{dayjs(c.issuedAt).format('YYYY-MM-DD HH:mm')}</p>
          </div>
          <button
            onClick={() => handleDownload(c._id, c.certNo)}
            disabled={downloading === c._id}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-60"
          >
            {downloading === c._id
              ? <><Loader2 className="h-4 w-4 animate-spin" /> 下载中...</>
              : <><FileCheck className="h-4 w-4" /> 下载证书</>
            }
          </button>
        </div>
      ))}
    </div>
  );
}
