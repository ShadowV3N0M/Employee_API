import React, { Component } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth";
import { ThemeProvider } from "./theme";
import "./styles.css";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Application encountered an unhandled error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background: "var(--bg-primary, #0f172a)",
          color: "var(--text-primary, #f8fafc)",
          fontFamily: "system-ui, -apple-system, sans-serif"
        }}>
          <div style={{
            maxWidth: "480px",
            background: "var(--card-bg, #1e293b)",
            border: "1px solid var(--border-color, #334155)",
            borderRadius: "12px",
            padding: "2rem",
            textAlign: "center",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)"
          }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "0.75rem", color: "#ef4444" }}>
              Something went wrong
            </h2>
            <p style={{ color: "var(--text-secondary, #94a3b8)", marginBottom: "1.5rem", fontSize: "0.95rem" }}>
              The application encountered an unexpected issue. This may happen if a strict browser extension or shield interrupted resources.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={() => window.location.reload()}
                className="btn btn-primary"
                style={{ padding: "0.6rem 1.25rem", cursor: "pointer" }}
              >
                Reload Page
              </button>
              <button
                onClick={() => {
                  try { localStorage.clear(); } catch (_) {}
                  window.location.href = "/login";
                }}
                className="btn btn-secondary"
                style={{ padding: "0.6rem 1.25rem", cursor: "pointer" }}
              >
                Reset & Go to Login
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

