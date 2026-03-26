export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg text-center">
        <h1 className="text-3xl font-bold mb-2">证书核验</h1>
        <p className="text-muted-foreground mb-8">输入证书编号（如 WC-20260325-AB12CD）以核验真伪</p>
        <input
          className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring"
          placeholder="WC-YYYYMMDD-XXXXXX"
        />
        <button className="mt-4 w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          核验
        </button>
      </div>
    </div>
  );
}

