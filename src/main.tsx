import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught App Error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#171717', color: '#ffffff', fontFamily: 'sans-serif', padding: '20px' }}>
          <div style={{ maxWidth: '500px', backgroundColor: '#262626', padding: '30px', borderRadius: '16px', border: '1px solid #404040', textAlign: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b', marginBottom: '10px' }}>Kaldas Salon App</h2>
            <p style={{ fontSize: '14px', color: '#d4d4d4', marginBottom: '20px' }}>An initialization issue occurred. Please reload the application.</p>
            <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', backgroundColor: '#f59e0b', color: '#000000', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
