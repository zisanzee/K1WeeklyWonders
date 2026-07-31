import { useEffect, useRef, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'react-qr-code';
import { toCanvas, toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { useStudentStore } from './students';
import { usePlayerStore } from './playerStore';

const SITE_URL = 'https://k1weekly.netlify.app';
const LOGO_SRC = '/android-chrome-512x512.png';

// Single-badge print target is 4.1in × 5.8in. The badge is captured at
// 410×580 CSS px with pixelRatio 3 → 1230×1740 px, i.e. 300 DPI.
const PRINT_WIDTH = 410;
const PRINT_HEIGHT = 580;
const PRINT_PIXEL_RATIO = 3;

// All-badges PDF: three cards fill the A4 width (small side margins + thin
// gaps between cards) — bigger than a half-size card but not full-size. The
// card keeps the 4.1:5.8 ratio, and a 3×3 grid puts 9 badges per page with any
// remainder spilling onto extra pages.
const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const SIDE_MARGIN_MM = 5;
const GAP_MM = 4; // thin white gutter between cards
const GRID_COLS = 3;
const GRID_ROWS = 3;
const CARD_W_MM = (PAGE_W_MM - 2 * SIDE_MARGIN_MM - (GRID_COLS - 1) * GAP_MM) / GRID_COLS; // 64
const CARD_H_MM = CARD_W_MM * (5.8 / 4.1); // 90.54 — same 4.1:5.8 ratio
const PER_PAGE = GRID_COLS * GRID_ROWS;
const MARGIN_X_MM = SIDE_MARGIN_MM;
const MARGIN_Y_MM = (PAGE_H_MM - (GRID_ROWS * CARD_H_MM + (GRID_ROWS - 1) * GAP_MM)) / 2;
// Cards are rasterized at the exact size of the on-screen single badge
// (PRINT_WIDTH×PRINT_HEIGHT) so the PDF and the PNG share the same
// font-size-to-card ratio. pixelRatio 2 keeps print sharp (~325 DPI at 64mm).
const BADGE_W_PX = PRINT_WIDTH;
const BADGE_H_PX = PRINT_HEIGHT;
const BADGE_PIXEL_RATIO = 2;

function sanitizeFileName(name) {
  return name.replace(/\s+/g, '-').toLowerCase();
}

// Badge markup shared by the on-screen preview and the PDF renderer. It fills
// its parent, so each context controls the physical size it is drawn at. The
// PDF renders this same component at the same pixel size as the preview, which
// keeps the font-size-to-card ratio identical between the two outputs.
function BadgeCard({ student, classInfo, qrSize = 160 }) {
  const code = student.code || student.studentId?.slice(0, 8) || '------';
  const loginUrl = `${SITE_URL}/p/${code}`;
  const displayName = student.nickname || student.fullName || 'Student';

  return (
    <div className="relative flex h-full w-full flex-col items-center overflow-hidden rounded-3xl bg-gradient-to-b from-sky-50 via-white to-indigo-100 text-slate-800">
      {/* Decorative background blobs (captured in the PNG too) */}
      <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-sky-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-14 top-28 h-48 w-48 rounded-full bg-violet-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -right-10 h-56 w-56 rounded-full bg-indigo-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-amber-200/50 blur-3xl" />

      {/* Header: colorful brand band */}
      <div className="relative flex w-full items-center gap-3 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-5 py-5">
        <img
          src={LOGO_SRC}
          alt=""
          draggable={false}
          className="h-12 w-12 shrink-0 rounded-2xl bg-white p-1 shadow-sm"
        />
        <div className="min-w-0">
          <p className="truncate text-base font-black uppercase leading-tight tracking-[0.12em] text-white">
            K1 Weekly Wonders
          </p>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/80">Game Pass</p>
        </div>
        {student.group && (
          <span className="ml-auto shrink-0 rounded-full bg-white/20 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white">
            {student.group}
          </span>
        )}
      </div>

      {/* Student name */}
      <div className="relative flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
          This pass belongs to
        </p>
        <p className="break-words text-4xl font-black leading-tight text-indigo-700">{displayName}</p>
        {classInfo?.className && (
          <p className="text-sm font-bold text-sky-600">{classInfo.className}</p>
        )}
        {classInfo?.teacherName && (
          <p className="text-xs font-semibold text-slate-500">
            Issued by: {classInfo.teacherName}
          </p>
        )}
      </div>

      {/* QR code */}
      <div className="relative rounded-3xl border-2 border-dashed border-indigo-300 bg-white p-3.5 shadow-sm">
        <QRCode value={loginUrl} size={qrSize} bgColor="#ffffff" fgColor="#4338ca" level="M" />
        <p className="mt-2 text-center text-[11px] font-black uppercase tracking-[0.2em] text-indigo-400">
          Scan to play
        </p>
      </div>

      {/* Code */}
      <div className="relative flex flex-col items-center gap-1.5 pb-6 pt-4">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Your code</p>
        <p className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-2.5 font-mono text-2xl font-black tracking-[0.18em] text-white shadow-sm">
          {code}
        </p>
      </div>
    </div>
  );
}

// Traces a rounded-rectangle path (avoids the newer ctx.roundRect() API for
// broader browser support) used to punch true alpha corners into the PNG.
function traceRoundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

// Renders the badge off-screen at exactly PRINT_WIDTH×PRINT_HEIGHT and returns
// a PNG data URL whose corners are true alpha. Rendering off-screen (instead of
// capturing the live modal element) also means the download never depends on
// how the preview is scaled, so it is pixel-identical on every device.
async function renderBadgePngTransparent(student, classInfo) {
  await ensureLogoLoaded();
  await document.fonts.ready;

  // Same off-screen holder technique as the PDF renderer — parked at the
  // document origin (hidden behind the modal) so the capture is deterministic.
  const holder = document.createElement('div');
  holder.style.cssText = `position:fixed;left:0;top:0;z-index:-9999;width:${PRINT_WIDTH}px;height:${PRINT_HEIGHT}px;`;
  document.body.appendChild(holder);

  const root = createRoot(holder);
  root.render(<BadgeCard student={student} classInfo={classInfo} qrSize={160} />);

  // Let React commit and the browser finish layout before snapshotting.
  await new Promise((resolve) => setTimeout(resolve, 50));

  try {
    const canvas = await toCanvas(holder, {
      pixelRatio: PRINT_PIXEL_RATIO,
      cacheBust: true,
    });

    // Mask the canvas to the rounded card shape so the corners are transparent
    // regardless of how html-to-image clips (or fails to clip) them.
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d');
    ctx.drawImage(canvas, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    traceRoundRect(ctx, 0, 0, out.width, out.height, Math.round(24 * PRINT_PIXEL_RATIO));
    ctx.fill();
    return out.toDataURL('image/png');
  } finally {
    root.unmount();
    document.body.removeChild(holder);
  }
}

// Generates a single badge as a true transparent PNG and triggers a download.
async function downloadBadge(student, classInfo, filename) {
  const dataUrl = await renderBadgePngTransparent(student, classInfo);
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

// navigator.clipboard requires a secure context; fall back to execCommand.
async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}

// Warm the logo once so every badge capture inlines it from the cache.
let logoPreload = null;
async function ensureLogoLoaded() {
  if (!logoPreload) {
    logoPreload = new Promise((resolve) => {
      const img = new Image();
      img.onload = img.onerror = () => resolve();
      img.src = LOGO_SRC;
    });
  }
  return logoPreload;
}

// Renders one badge off-screen and returns a JPEG data URL. JPEG is far
// smaller than PNG for this gradient-heavy card, which keeps multi-class PDFs
// from ballooning. The PDF page is white, so the JPEG's lossy (square) corners
// are invisible there and the card still reads as the rounded design.
async function renderBadgeToJpeg(student, classInfo, widthPx, heightPx) {
  await ensureLogoLoaded();
  await document.fonts.ready;

  // Parked at the document origin (hidden behind the modal) instead of far off
  // screen: html-to-image clones the node with its live inline styles, so a
  // badge parked at left:-10000px was rendered 10000px outside the captured
  // foreignObject — every PDF page came out blank because of exactly that.
  // A 0,0 origin keeps the clone laid out inside the capture while the
  // negative z-index keeps it out of sight.
  const holder = document.createElement('div');
  holder.style.cssText = `position:fixed;left:0;top:0;z-index:-9999;width:${widthPx}px;height:${heightPx}px;`;
  document.body.appendChild(holder);

  const root = createRoot(holder);
  root.render(
    // Same BadgeCard and pixel size as the single-badge preview, so the PDF
    // cards are proportionally identical to the PNG output.
    <BadgeCard
      student={student}
      classInfo={classInfo}
      qrSize={Math.round((widthPx / PRINT_WIDTH) * 160)}
    />
  );

  // Let React commit and the browser finish layout before snapshotting.
  await new Promise((resolve) => setTimeout(resolve, 50));

  try {
    // The logo is pre-warmed above, so skip cache-busting: it would otherwise
    // re-fetch the asset with a fresh query string for every badge in the class.
    return await toJpeg(holder, {
      pixelRatio: BADGE_PIXEL_RATIO,
      backgroundColor: '#ffffff',
      quality: 0.85,
    });
  } finally {
    root.unmount();
    document.body.removeChild(holder);
  }
}

// Builds an A4 PDF with a 3×3 grid of badges, adding pages as needed.
async function buildBadgesPdf(students, classInfo, filename, onProgress) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  for (let i = 0; i < students.length; i++) {
    if (i > 0 && i % PER_PAGE === 0) doc.addPage();

    onProgress?.(i + 1, students.length);
    const dataUrl = await renderBadgeToJpeg(students[i], classInfo, BADGE_W_PX, BADGE_H_PX);

    const slot = i % PER_PAGE;
    const col = slot % GRID_COLS;
    const row = Math.floor(slot / GRID_COLS);
    // Step each card by (size + gap) so the gutter stays uniform across the grid.
    doc.addImage(
      dataUrl,
      'JPEG',
      MARGIN_X_MM + col * (CARD_W_MM + GAP_MM),
      MARGIN_Y_MM + row * (CARD_H_MM + GAP_MM),
      CARD_W_MM,
      CARD_H_MM
    );
  }

  doc.save(filename);
}

// Print-all control used on the students tab (not the badge modal). It fetches
// the full roster, renders every badge into a multi-page PDF, and shows a
// full-screen progress overlay while that runs.
export function PrintAllBadgesButton({ className }) {
  const storeClassName = usePlayerStore((state) => state.className);
  const teacherName = usePlayerStore((state) => state.playerName);
  const [printingAll, setPrintingAll] = useState(false);
  const [printProgress, setPrintProgress] = useState('');
  const [printPercent, setPrintPercent] = useState(0);

  const displayClassName = className || storeClassName || 'Class';

  const handlePrintAll = useCallback(async () => {
    if (printingAll) return;
    // Fetch the roster and bail out on trivial cases BEFORE showing the
    // loading overlay, so it never flashes for an empty class or a failed fetch.
    const store = useStudentStore.getState();
    if (!store.loaded) {
      await store.fetchStudents();
    }
    const fresh = useStudentStore.getState();
    const students = fresh.students;
    if (!students.length) {
      alert(fresh.error || 'No students in this class yet. Add students first.');
      return;
    }
    setPrintingAll(true);
    try {
      await buildBadgesPdf(
        students,
        { className: displayClassName, teacherName },
        `badges-${sanitizeFileName(displayClassName)}.pdf`,
        (done, total) => {
          setPrintPercent(Math.round((done / total) * 100));
          setPrintProgress(`Rendering badge ${done} of ${total}…`);
        }
      );
    } catch (err) {
      console.error('Failed to build badges PDF', err);
      alert('Could not generate the PDF. Please try again.');
    } finally {
      setPrintingAll(false);
      setPrintProgress('');
      setPrintPercent(0);
    }
  }, [printingAll, displayClassName]);

  return (
    <>
      <button
        type="button"
        onClick={handlePrintAll}
        disabled={printingAll}
        title="Download a PDF with a badge for every student in this class"
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-indigo-200 bg-white px-4 py-3 text-sm font-black text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {printingAll ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            {printProgress || 'Preparing PDF…'}
          </>
        ) : (
          <>
            🖨️ Print all badges
            <span className="hidden font-bold text-slate-400 sm:inline">— one PDF for the whole class</span>
          </>
        )}
      </button>

      {/* Full-screen loading overlay while the badge PDF is being built */}
      {printingAll && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 px-6 backdrop-blur-sm"
        >
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-[2rem] bg-white p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.4)]">
            <div className="h-11 w-11 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            <div>
              <p className="text-lg font-black text-slate-800">Printing badges…</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{printProgress}</p>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-200"
                style={{ width: `${printPercent}%` }}
              />
            </div>
            <p className="text-xs font-bold text-slate-400">{printPercent}%</p>
            <p className="text-[11px] font-medium text-slate-400">
              Please keep this window open — the download starts automatically.
            </p>
          </div>
        </motion.div>
      )}
    </>
  );
}

export default function StudentBadge({ student, classInfo, onClose }) {
  const previewContainerRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [badgeScale, setBadgeScale] = useState(1);

  // The badge always lays out at PRINT_WIDTH×PRINT_HEIGHT and is scaled down as
  // a whole on narrow screens, so the preview is proportionally identical on
  // every device instead of the fixed-px elements growing out of place.
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const update = () => setBadgeScale(Math.min(1, el.clientWidth / PRINT_WIDTH));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const code = student.code || student.studentId?.slice(0, 8) || '------';
  const loginUrl = `${SITE_URL}/p/${code}`;
  const displayName = student.nickname || student.fullName || 'Student';

  const handleDownload = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadBadge(student, classInfo, `badge-${sanitizeFileName(displayName)}.png`);
    } finally {
      setDownloading(false);
    }
  }, [downloading, displayName, student, classInfo]);

  const handleCopy = useCallback(async () => {
    try {
      await copyText(loginUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy login link', err);
    }
  }, [loginUrl]);

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
          className="flex w-full max-w-lg flex-col items-center gap-4 rounded-[2rem] bg-white p-4 shadow-[0_24px_70px_rgba(0,0,0,0.3)] sm:p-6"
        >
          {/* The badge itself — always laid out at print size, scaled down as a
              whole on small screens so it looks identical on every device. */}
          <div ref={previewContainerRef} className="flex w-full justify-center">
            <div
              style={{
                position: 'relative',
                width: Math.round(PRINT_WIDTH * badgeScale),
                height: Math.round(PRINT_HEIGHT * badgeScale),
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: PRINT_WIDTH,
                  height: PRINT_HEIGHT,
                  transform: `scale(${badgeScale})`,
                  transformOrigin: 'top left',
                }}
                className="relative overflow-hidden rounded-3xl shadow-sm"
              >
                <BadgeCard student={student} classInfo={classInfo} qrSize={160} />
              </div>
            </div>
          </div>

          {/* Link box with copy button */}
          <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2 pl-4">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Login link
                </p>
                <p className="truncate font-mono text-xs text-slate-600">{loginUrl}</p>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-sky-700 active:scale-95"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:gap-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
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
              className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-200 active:scale-[0.99]"
            >
              Close
            </button>
          </div>

        </motion.div>
      </motion.div>

    </AnimatePresence>
  );
}
