import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  /** Changing this resets the boundary - we pass the active tab, so moving
   * away from a broken page and back gives it a fresh try. */
  resetKey: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  resetKey: string;
}

/**
 * Keeps one page's crash from taking the whole app down.
 *
 * Every tab is a lazily-loaded chunk rendered into the same slot, so before
 * this an uncaught render error anywhere - a malformed template snapshot, a
 * row with an unexpected shape - unmounted the entire tree and left a white
 * screen with no way back except a reload.
 */
export class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  // Derived rather than a componentDidUpdate setState, so switching tabs
  // clears the error in the same render instead of causing a second one.
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-2xl">🧯</p>
          <h2 className="mt-2 text-base font-semibold text-red-800">This tab hit a snag</h2>
          <p className="mt-1 text-sm text-red-700">
            The rest of the app is fine — switch tabs and come back, or try again.
          </p>
          <p className="mt-2 break-words text-xs text-red-500">{this.state.error.message}</p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
