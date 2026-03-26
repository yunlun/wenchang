import Link from 'next/link';
import { Shield, Zap, Award, ArrowRight, Lock, FileCheck } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      {/* ── Nav ───────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg tracking-tight">文昌存证</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              登录
            </Link>
            <Link
              href="/auth/register"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              免费注册
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-20">
        {/* background orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-accent/8 blur-[100px]" />
        </div>

        <div className="relative z-10 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary">
            <Zap className="h-3.5 w-3.5" />
            <span>基于文昌链的可信存证</span>
          </div>
          <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            让每一件设计<br />
            <span className="text-primary">都有链上存证</span>
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-lg text-muted-foreground">
            上传作品 → 自动计算 SHA-256 → 文昌链存证 → 生成确权证书。
            全程不超过 30 秒，版权保护从未如此简单。
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all hover:shadow-primary/40 hover:-translate-y-0.5"
            >
              立即开始存证 <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/verify"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-8 py-3.5 font-medium hover:bg-muted transition-colors"
            >
              <FileCheck className="h-4 w-4" /> 核验证书
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: Lock,
              title: '防篡改哈希',
              desc: '使用 SHA-256 算法对文件生成唯一指纹，任何改动均可被检测',
            },
            {
              icon: Shield,
              title: '文昌链存证',
              desc: '哈希值上链后永久不可篡改，符合电子数据存证相关法律要求',
            },
            {
              icon: Award,
              title: '确权证书',
              desc: '自动生成含区块链交易哈希的 PDF 证书，可随时在线核验',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card p-8 transition-shadow hover:shadow-lg"
            >
              <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

