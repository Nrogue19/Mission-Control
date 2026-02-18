import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Error Boundary Component - Catches JavaScript errors in child components
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`Error in ${this.props.componentName || 'component'}:`, error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h3>⚠️ Something went wrong</h3>
            <p>{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button 
              onClick={() => this.setState({ hasError: false, error: null })}
              className="error-boundary-retry"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Error Boundary CSS styles
export const errorBoundaryStyles = `
.error-boundary {
  padding: 20px;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  margin: 10px;
}

body.dark-mode .error-boundary {
  background: #3f1f26;
  border-color: #7f1d1d;
}

.error-boundary-content {
  text-align: center;
}

.error-boundary h3 {
  color: #991b1b;
  margin-bottom: 8px;
}

body.dark-mode .error-boundary h3 {
  color: #fca5a5;
}

.error-boundary p {
  color: #7f1d1b;
  font-size: 14px;
}

body.dark-mode .error-boundary p {
  color: #fca5a5;
}

.error-boundary-retry {
  margin-top: 12px;
  padding: 8px 16px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.error-boundary-retry:hover {
  background: #dc2626;
}
`;

export default ErrorBoundary;
