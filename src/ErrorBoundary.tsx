import React, { Component, ErrorInfo, ReactNode } from "react";

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
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: "40px", 
          backgroundColor: "#fff0f0", 
          color: "#d00000", 
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          border: "10px solid #d00000"
        }}>
          <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>⚠️ Applicatie Fout</h1>
          <p>Er is een onverwachte fout opgetreden. Neem een screenshot van onderstaande tekst en stuur deze naar de ontwikkelaar.</p>
          <pre style={{ 
            whiteSpace: "pre-wrap", 
            backgroundColor: "#fff",
            padding: "1rem",
            border: "1px solid #ffcccc",
            marginTop: "1rem",
            fontSize: "14px",
            overflowX: "auto"
          }}>
            {this.state.error?.toString()}
          </pre>
          <pre style={{ 
            whiteSpace: "pre-wrap", 
            backgroundColor: "#fff",
            padding: "1rem",
            border: "1px solid #ffcccc",
            marginTop: "1rem",
            fontSize: "12px",
            overflowX: "auto"
          }}>
            {this.state.error?.stack}
          </pre>
          <button 
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            style={{
              marginTop: "20px",
              padding: "10px 20px",
              backgroundColor: "#d00000",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            Reset Applicatie & Herlaad
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
