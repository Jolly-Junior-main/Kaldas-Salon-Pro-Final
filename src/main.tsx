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

  private handleResetCache = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn("Could not clear storage:", e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#171717', color: '#ffffff', fontFamily: 'sans-serif', padding: '20px' }}>
          <div style={{ maxWidth: '540px', width: '100%', backgroundColor: '#262626', padding: '30px', borderRadius: '20px', border: '1px solid #404040', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#f59e0b', marginBottom: '10px' }}>Kaldas Salon Application</h2>
            <p style={{ fontSize: '14px', color: '#d4d4d4', marginBottom: '16px' }}>Initialization issue detected:</p>
            <div style={{ backgroundColor: '#171717', padding: '12px', borderRadius: '8px', border: '1px solid #333333', fontSize: '12px', fontFamily: 'monospace', color: '#ef4444', marginBottom: '20px', wordBreak: 'break-word', textAlign: 'left', maxHeight: '120px', overflowY: 'auto' }}>
              {this.state.error?.message || String(this.state.error)}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => window.location.reload()} style={{ flex: 1, padding: '12px', backgroundColor: '#f59e0b', color: '#000000', fontWeight: 'bold', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
                Reload App
              </button>
              <button onClick={this.handleResetCache} style={{ flex: 1, padding: '12px', backgroundColor: '#333333', color: '#ffffff', fontWeight: 'bold', border: '1px solid #555555', borderRadius: '10px', cursor: 'pointer' }}>
                Reset Cache & Reload
              </button>
            </div>
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
