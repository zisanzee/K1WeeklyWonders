import { useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'react-qr-code';
import { toPng } from 'html-to-image';

const SITE_URL = 'https://k1weekly.netlify.app';

// Generates the badge as a PNG blob and triggers a download.
async function downloadBadge(element, filename) {
  if (!element) return;
  try {
    const dataUrl = await toPng(element, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    });
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('Failed to generate badge image', err);
  }
}

export default function StudentBadge({ student, classInfo, onClose }) {
  const badgeRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  const code = student.code || student.studentId?.slice(0, 8) || '------';
  const loginUrl = `${SITE_URL}/p/${code}`;
  const displayName = student.nickname || student.fullName || 'Student';

  const handleDownload = useCallback(async () => {
    if (downloading || !badgeRef.current) return;
    setDownloading(true);
    await downloadBadge(badgeRef.current, `badge-${displayName.replace(/\s+/g, '-')}.png`);
    setDownloading(false);
  }, [downloading, displayName]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="flex w-full max-w-sm flex-col items-center gap-4 rounded-[2rem] bg-white p-6 shadow-[0_24px_70px_rgba(0,0,0,0.3)]"
        >
          {/* The badge itself — this is what gets captured as PNG */}
          <div
            ref={badgeRef}
            className="flex w-full flex-col items-center gap-3 rounded-2xl bg-gradient-to-b from-sky-50 to-white p-5"
          >
            {/* Header: game logo + name */}
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-xl shadow-sm">
                🎈
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-600">
                  K1 Weekly Wonders
                </p>
                <p className="text-xs font-bold text-slate-500">Learning Games</p>
              </div>
            </div>

            {/* Student nickname */}
            <p className="text-xl font-black text-slate-800">{displayName}</p>

            {/* QR Code */}
            <div className="rounded-2xl border-4 border-sky-200 bg-white p-3 shadow-sm">
              <QRCode
                value={loginUrl}
                size={160}
                bgColor="#ffffff"
                fgColor="#1e293b"
                level="M"
              />
            </div>

            {/* Code */}
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Code
              </p>
              <p className="mt-0.5 font-mono text-lg font-black tracking-[0.15em] text-slate-700">
                {code}
              </p>
            </div>

            {/* Group badge */}
            {student.group && (
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-black text-indigo-700">
                {student.group}
              </span>
            )}
          </div>

          {/* Actions outside the captured area */}
          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                  Saving…
                </>
              ) : (
                '📥 Download badge'
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-200"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
