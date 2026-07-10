import React from 'react';
import { ui } from '../config/i18n';

/**
 * Fallback UI shown when an error boundary catches a crash.
 * Uses inline styles so it still renders even if the main CSS fails.
 */
function FallbackUI({ error, onReset }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '2rem',
        fontFamily: 'Inter, system-ui, sans-serif',
        textAlign: 'center',
        color: 'var(--text, #edf4ff)',
      }}
    >
      <div
        style={{
          fontSize: '3rem',
          marginBottom: '1rem',
          opacity: 0.6,
        }}
        aria-hidden="true"
      >
        ⚠️
      </div>
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem' }}>
        {ui.errorTitle}
      </h2>
      <p
        style={{
          margin: '0 0 1.5rem',
          maxWidth: '28rem',
          opacity: 0.7,
          lineHeight: 1.6,
        }}
      >
        {ui.errorMessage}
      </p>
      {process.env.NODE_ENV !== 'production' && error && (
        <pre
          style={{
            maxWidth: '36rem',
            padding: '1rem',
            borderRadius: '0.5rem',
            background: 'rgba(255,80,80,0.08)',
            border: '1px solid rgba(255,80,80,0.2)',
            fontSize: '0.75rem',
            textAlign: 'left',
            overflow: 'auto',
            marginBottom: '1.5rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {error.message || String(error)}
        </pre>
      )}
      <button
        type="button"
        onClick={onReset}
        style={{
          padding: '0.6rem 1.6rem',
          borderRadius: '0.5rem',
          border: 'none',
          background: 'linear-gradient(135deg, #5cf0dc, #8ec2ff)',
          color: '#08101d',
          fontWeight: 600,
          fontSize: '0.95rem',
          cursor: 'pointer',
        }}
      >
        {ui.reload}
      </button>
    </div>
  );
}

/**
 * React class-based Error Boundary.
 * Catches render errors in its subtree and shows a friendly fallback.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <FallbackUI error={this.state.error} onReset={this.handleReset} />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
