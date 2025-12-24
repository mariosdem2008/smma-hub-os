import { Outlet, Link } from "react-router-dom";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ClientDetailLayout() {
  return (
    <div className="min-h-screen w-full bg-background">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b glass-header px-4 shadow-lg">
        <Link to="/clients">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Clients</span>
          </Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">SMMAHUB</h2>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <NotificationCenter />
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
