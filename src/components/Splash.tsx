"use client";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/kit";
import { t } from "@/i18n";

export function Splash({ error }: { error?: string | null }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo height={34} />
      {error ? (
        <>
          <p className="max-w-xs text-ink-2">{error}</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>{t.common.retry}</Button>
        </>
      ) : (
        <span className="h-1 w-24 overflow-hidden rounded-full bg-fill-strong" role="status" aria-label={t.common.loading}>
          <span className="skeleton block h-full w-full" />
        </span>
      )}
    </div>
  );
}
