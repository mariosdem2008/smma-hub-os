import { Outlet, Link } from "react-router-dom";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ClientDetailLayout() {
  return (
    <div className="min-h-screen w-full bg-background">
      <a href="#client-detail-main" className="skip-to-content">
        Skip to content
      </a>
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b glass-header px-4 shadow-lg">
        <Button variant="ghost" size="sm" className="gap-2" asChild>
          <Link to="/clients">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Back to Clients</span>
            <span className="sm:hidden">Clients</span>
          </Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">SMMAHUB</h2>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <NotificationCenter />
        </div>
      </header>
      <main id="client-detail-main" className="flex-1" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
