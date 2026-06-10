import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[SMMAHUB] Unhandled render error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return <>{this.props.fallback}</>;

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <Card className="w-full max-w-md border-destructive/30 bg-card">
            <CardContent className="pt-8 pb-8 text-center space-y-5">
              <div className="flex justify-center">
                <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center border border-destructive/20">
                  <AlertTriangle className="h-7 w-7 text-destructive" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
                <p className="text-sm text-muted-foreground">
                  An unexpected error occurred. Your data is safe — try refreshing or returning to the dashboard.
                </p>
                {this.state.error?.message && (
                  <p className="text-xs font-mono text-muted-foreground bg-muted rounded-md px-3 py-2 text-left break-all">
                    {this.state.error.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh page
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    this.handleReset();
                    window.location.href = "/dashboard";
                  }}
                  className="gap-2"
                >
                  <Home className="h-4 w-4" />
                  Go to dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}

export default ErrorBoundary;
