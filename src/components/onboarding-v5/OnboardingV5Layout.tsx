import type { ReactNode } from 'react';

interface OnboardingV5LayoutProps {
  header: ReactNode;
  nav: ReactNode;
  preview: ReactNode;
  children: ReactNode;
}

export function OnboardingV5Layout({ header, nav, preview, children }: OnboardingV5LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        {header}
      </div>

      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 md:px-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24">{nav}</div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>

        <aside className="hidden w-80 shrink-0 xl:block">
          <div className="sticky top-24">{preview}</div>
        </aside>
      </div>
    </div>
  );
}