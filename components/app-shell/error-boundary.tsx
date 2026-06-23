"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[AppErrorBoundary] unhandled error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Something went wrong. Try reloading the page.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-[10px] px-4 py-2 text-sm font-medium"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
