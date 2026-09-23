import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Global error boundary — catches runtime crashes anywhere in the tree and
 * shows a simple recovery screen instead of a blank white/dark page.
 * On mobile this is the difference between "the app froze" and "tap to reload".
 */
export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || "Erreur inconnue" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("AppErrorBoundary caught:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, message: "" });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center bg-background">
          <div className="text-5xl">⚠️</div>
          <div className="space-y-2 max-w-sm">
            <h1 className="text-xl font-bold text-foreground">Une erreur est survenue</h1>
            <p className="text-sm text-muted-foreground">
              L'application a rencontré un problème inattendu.
            </p>
            {this.state.message && (
              <p className="text-xs text-muted-foreground/60 font-mono bg-muted rounded px-2 py-1 mt-2 break-all">
                {this.state.message}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={this.handleReload}
              className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Recharger la page
            </button>
            <button
              onClick={this.handleGoHome}
              className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Accueil
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
