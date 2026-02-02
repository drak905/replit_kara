import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackClassName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className={`min-h-screen flex items-center justify-center ${this.props.fallbackClassName || 'bg-black'}`}>
          <Card className="p-8 max-w-md w-full mx-4 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-yellow-500" />
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-muted-foreground mb-6">
              The app encountered an error. Please refresh to continue.
            </p>
            <Button onClick={this.handleReload} className="w-full" data-testid="button-reload">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Page
            </Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
