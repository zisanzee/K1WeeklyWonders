import { Component } from 'react';
import { isChunkLoadError, recoverFromStaleChunk } from '@/pwa/staleChunkRecovery';

// React error boundaries must be class components — there is still no hook
// equivalent. This one exists because every game route is lazy()-loaded: a
// chunk that fails to fetch (stale deploy, flaky school wifi, or a genuinely
// broken module) previously unmounted the whole tree and left a BLANK page
// with only a console error. A blank screen is the worst possible failure
// mode here — the audience is young children and teachers who cannot act on
// a console message.
//
// Recovery is deliberately offered as a full reload rather than a state
// reset. The realistic causes are a stale chunk hash or a dropped
// connection, and re-mounting the same broken module just re-throws; a
// reload re-fetches the current deploy.

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the console report — it is the only diagnostic signal we have, and
    // it is what made the original lazy-import fault findable.
    console.error('ErrorBoundary caught:', error, info?.componentStack);
  }

  handleReload = async () => {
    const { error } = this.state;

    // Only a stale-chunk failure benefits from the promote-the-new-worker path
    // in recoverFromStaleChunk (it waits for a new worker to take over before
    // reloading, so the reload fetches the CURRENT build). An ordinary render
    // error should not pay for that wait, and must never touch the worker —
    // it and its caches are what make a repeat play instant on school wifi.
    if (isChunkLoadError(error)) {
      // Rate-limited internally, so a genuinely missing chunk cannot put the
      // browser into a reload loop. If recovery was refused (already tried
      // recently) fall through to a plain reload, which is still better than
      // a dead button.
      const recovered = await recoverFromStaleChunk();
      if (recovered) return;
    }

    window.location.reload();
  };

  handleDismiss = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // A failed dynamic import is worth its own copy: telling a teacher to
    // "reload" only makes sense when reloading can actually help.
    const isChunkError = isChunkLoadError(error);

    return (
      <div className="aura-page relative flex min-h-[100dvh] w-full flex-col items-center justify-center gap-4 px-4 py-10 text-center">
        <span aria-hidden="true" className="text-6xl sm:text-7xl">
          {isChunkError ? '📡' : '😕'}
        </span>

        <h1 className="font-heading max-w-md text-xl font-black leading-tight text-white sm:text-2xl">
          {isChunkError ? "This part didn't load" : 'Something went wrong'}
        </h1>

        <p className="max-w-sm text-sm font-semibold leading-relaxed aura-soft sm:text-base">
          {isChunkError
            ? 'Your connection may have dropped. Refresh the page to try again — your progress is saved.'
            : 'An unexpected error interrupted the app. Reloading usually fixes it.'}
        </p>

        <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={this.handleReload}
            className="aura-btn aura-btn-violet min-h-11 px-6 text-sm font-black"
          >
            ↻ Reload page
          </button>

          {/* "Back home" is only offered when it would actually go somewhere
              different — inside the top-level boundary a re-render is the
              only other option, and on the home route there is nowhere to
              go. Both handlers are provided by the parent. */}
          {this.props.onDismiss && (
            <button
              type="button"
              onClick={this.handleDismiss}
              className="aura-ghost min-h-11 px-6 text-sm font-black"
            >
              Try again
            </button>
          )}

          {this.props.homeHref && (
            <a href={this.props.homeHref} className="aura-ghost min-h-11 px-6 text-sm font-black">
              🏠 Back home
            </a>
          )}
        </div>

        {/* Collapsed by default so it never dominates the screen for a child,
            but available for a teacher to copy when reporting a problem. */}
        <details className="mt-3 w-full max-w-md text-left">
          <summary className="cursor-pointer rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black aura-muted">
            Technical details
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-black/25 px-3 py-2 text-[10px] leading-snug text-white/70">
            {String(error?.stack || error?.message || error)}
          </pre>
        </details>
      </div>
    );
  }
}
