import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { create } from 'zustand';

// A single, app-wide confirmation dialog. Callers just `await confirmDialog({…})`
// and get back true/false — no per-component modal state to wire up, and it
// replaces the ugly, blocking window.confirm().
const useConfirmStore = create((set, get) => ({
  state: null,
  open: (options) =>
    new Promise((resolve) => {
      set({
        state: {
          title: 'Are you sure?',
          message: '',
          confirmLabel: 'Confirm',
          cancelLabel: 'Cancel',
          danger: false,
          icon: '❓',
          ...options,
          resolve,
        },
      });
    }),
  close: (result) => {
    const current = get().state;
    if (current?.resolve) current.resolve(result);
    set({ state: null });
  },
}));

export function confirmDialog(options) {
  return useConfirmStore.getState().open(options);
}

// Mounted once near the app root. Renders nothing until a dialog is requested.
export function ConfirmHost() {
  const state = useConfirmStore((s) => s.state);
  const close = useConfirmStore((s) => s.close);

  useEffect(() => {
    if (!state) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, close]);

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 px-4 py-6 backdrop-blur-sm"
          onClick={() => close(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={state.title}
            initial={{ opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 18 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={(event) => event.stopPropagation()}
            className="aura-panel relative w-full max-w-sm overflow-hidden rounded-[1.75rem] p-6 text-center shadow-2xl"
          >
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl"
              style={{
                background: state.danger
                  ? 'rgba(244,63,94,0.35)'
                  : 'rgba(139,92,246,0.35)',
              }}
            />

            <div
              className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-lg"
              style={{
                background: state.danger
                  ? 'linear-gradient(135deg, #fda4af 0%, #f43f5e 100%)'
                  : 'linear-gradient(135deg, #c4b5fd 0%, #8b5cf6 100%)',
              }}
            >
              {state.icon}
            </div>

            <h3 className="relative mt-4 text-xl font-black aura-text">
              {state.title}
            </h3>
            {state.message && (
              <p className="relative mt-2 text-sm font-semibold aura-soft">
                {state.message}
              </p>
            )}

            <div className="relative mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => close(false)}
                className="aura-ghost flex-1 rounded-2xl px-4 py-3 text-sm font-black"
              >
                {state.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className="flex-1 rounded-2xl px-4 py-3 text-sm font-black text-white shadow-[0_5px_0_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
                style={{
                  background: state.danger
                    ? 'linear-gradient(135deg, #fb7185 0%, #e11d48 100%)'
                    : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                }}
              >
                {state.confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
