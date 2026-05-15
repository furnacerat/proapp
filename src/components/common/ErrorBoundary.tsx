import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Route error boundary caught an error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="page-content">
          <div className="empty-state">
            <h3>Something went wrong</h3>
            <p>This page hit an unexpected error. Your workspace shell is still running.</p>
            <button className="btn btn-primary" type="button" onClick={() => this.setState({ hasError: false, error: undefined })}>
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
