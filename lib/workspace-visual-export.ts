const EXPORT_TARGET_ID = 'workspace-tree-export-target';
const EXPORT_ALL_TARGET_ID = 'workspace-export-all-target';
const EXPORT_DASHBOARD_ID = 'dashboard-export-target';
const GRAPH_CAPTURE_ID = 'workspace-graph-capture-root';

/** Stay under common browser canvas limits (width/height / memory). */
const MAX_CAPTURE_DIM_PX = 4096;

function getExportTarget(): HTMLElement {
  const el = document.getElementById(EXPORT_TARGET_ID);
  if (!el) {
    throw new Error('EXPORT_TARGET_MISSING');
  }
  return el;
}

function getExportAllTarget(): HTMLElement {
  const el = document.getElementById(EXPORT_ALL_TARGET_ID);
  if (!el) {
    throw new Error('EXPORT_ALL_TARGET_MISSING');
  }
  return el;
}

function getDashboardExportTarget(): HTMLElement {
  const el = document.getElementById(EXPORT_DASHBOARD_ID);
  if (!el) {
    throw new Error('EXPORT_DASHBOARD_TARGET_MISSING');
  }
  return el;
}

/** Transformed node+edge layer; bounds cover the whole tree, not the current viewport. */
function getGraphCaptureElement(): HTMLElement {
  const el = document.getElementById(GRAPH_CAPTURE_ID);
  if (!el) {
    throw new Error('GRAPH_CAPTURE_MISSING');
  }
  return el;
}

function buildFileStem(keyword: string): string {
  const safe =
    keyword.replace(/[^\w\s\-.\u0080-\uFFFF]/gi, '_').slice(0, 48) || 'workspace';
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `qx10lol-tree-${safe}-${stamp}`;
}

/**
 * Programmatic downloads often fail if the blob URL is revoked before the browser
 * starts reading it, or if the anchor element is not attached to the document.
 */
function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function pickCaptureScale(rectW: number, rectH: number, maxScale: number): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const scale = Math.min(maxScale, dpr);
  const w = rectW * scale;
  const h = rectH * scale;
  const over = Math.max(w / MAX_CAPTURE_DIM_PX, h / MAX_CAPTURE_DIM_PX, 1);
  return scale / over;
}

function normalizeCaptureScales(rectW: number, rectH: number, maxScale: number): number[] {
  const primary = pickCaptureScale(rectW, rectH, maxScale);
  const candidates = [
    primary,
    Math.min(1, primary),
    primary * 0.8,
    0.75,
    0.55,
    0.4,
  ];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const s of candidates) {
    const v = Math.round(Math.max(0.35, Math.min(s, maxScale)) * 1000) / 1000;
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/**
 * Expanded dashboard / overflow:hidden ancestors can hide or clip the graph in the clone.
 * Walk up from the captured subtree and widen the workspace shell when present.
 */
const NODE_UNION_PAD_PX = 64;
const CROP_MIN_SIZE_PX = 200;

/**
 * Tight crop around node cards in graph-local coordinates (pre-transform).
 * This keeps exports stable regardless of current pan/zoom.
 */
function computeTightCropWithinGraph(graphRoot: HTMLElement): { x: number; y: number; w: number; h: number } {
  const gW = Math.max(1, graphRoot.offsetWidth);
  const gH = Math.max(1, graphRoot.offsetHeight);
  const fallback = () => ({
    x: 0,
    y: 0,
    w: gW,
    h: gH,
  });

  const nodes = graphRoot.querySelectorAll<HTMLElement>('[data-workspace-node]');
  if (nodes.length === 0) return fallback();

  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;

  nodes.forEach((n) => {
    const w = n.offsetWidth;
    const h = n.offsetHeight;
    if (w < 1 && h < 1) return;
    const x = n.offsetLeft;
    const y = n.offsetTop;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + w);
    bottom = Math.max(bottom, y + h);
  });

  if (!Number.isFinite(left)) return fallback();

  left -= NODE_UNION_PAD_PX;
  top -= NODE_UNION_PAD_PX;
  right += NODE_UNION_PAD_PX;
  bottom += NODE_UNION_PAD_PX;

  left = Math.max(0, left);
  top = Math.max(0, top);
  right = Math.min(gW, right);
  bottom = Math.min(gH, bottom);

  let w = right - left;
  let h = bottom - top;
  if (w < 1 || h < 1) return fallback();

  if (w < CROP_MIN_SIZE_PX) {
    const mid = left + w / 2;
    w = CROP_MIN_SIZE_PX;
    left = mid - w / 2;
    if (left < 0) left = 0;
    if (left + w > gW) left = Math.max(0, gW - w);
  }
  if (h < CROP_MIN_SIZE_PX) {
    const mid = top + h / 2;
    h = CROP_MIN_SIZE_PX;
    top = mid - h / 2;
    if (top < 0) top = 0;
    if (top + h > gH) top = Math.max(0, gH - h);
  }

  return {
    x: Math.max(0, left),
    y: Math.max(0, top),
    w: Math.max(1, Math.ceil(w)),
    h: Math.max(1, Math.ceil(h)),
  };
}

function onCloneForCapture(doc: Document, cloned: HTMLElement): void {
  let el: HTMLElement | null = cloned;
  while (el) {
    el.style.opacity = '1';
    el.style.visibility = 'visible';
    el.style.pointerEvents = 'auto';
    el.style.overflow = 'visible';
    el.style.clipPath = 'none';
    if (el.tagName === 'HTML') break;
    el = el.parentElement;
  }

  const shell = doc.getElementById(EXPORT_TARGET_ID);
  if (shell) {
    shell.style.opacity = '1';
    shell.style.visibility = 'visible';
    shell.style.right = '0';
    shell.style.left = '0';
    shell.style.top = '0';
    shell.style.bottom = '0';
    shell.style.width = '100%';
    shell.style.height = '100%';
    shell.style.overflow = 'visible';
  }

  const graph = doc.getElementById(GRAPH_CAPTURE_ID) as HTMLElement | null;
  if (graph) {
    // Export in canonical graph coordinates, not current viewport transform.
    graph.style.transform = 'none';
    graph.style.transformOrigin = 'top left';
  }
}

async function captureTreeToCanvas(
  graphRoot: HTMLElement,
  maxScale: number,
  backgroundColor: string | null
): Promise<HTMLCanvasElement> {
  const graphRect = graphRoot.getBoundingClientRect();
  const crop = computeTightCropWithinGraph(graphRoot);
  const graphW = Math.max(1, graphRect.width);
  const graphH = Math.max(1, graphRect.height);
  const pad = 80;
  const contentW = Math.ceil(graphW + pad * 2);
  const contentH = Math.ceil(graphH + pad * 2);
  const innerW = typeof window !== 'undefined' ? window.innerWidth : contentW;
  const innerH = typeof window !== 'undefined' ? window.innerHeight : contentH;
  const windowWidth = Math.max(innerW, contentW);
  const windowHeight = Math.max(innerH, contentH);

  const html2canvas = (await import('html2canvas')).default;
  const scales = normalizeCaptureScales(crop.w, crop.h, maxScale);
  const scrollX = typeof window !== 'undefined' ? window.pageXOffset : 0;
  const scrollY = typeof window !== 'undefined' ? window.pageYOffset : 0;

  let lastError: unknown;
  for (let i = 0; i < scales.length; i++) {
    const scale = scales[i];
    const foreignObjectRendering = i === scales.length - 1;
    try {
      return await html2canvas(graphRoot, {
        useCORS: true,
        allowTaint: false,
        backgroundColor,
        x: crop.x,
        y: crop.y,
        width: crop.w,
        height: crop.h,
        scrollX,
        scrollY,
        windowWidth,
        windowHeight,
        scale,
        logging: false,
        removeContainer: true,
        foreignObjectRendering,
        onclone: onCloneForCapture,
      });
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function canvasToJpegBytes(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
  });
  if (blob) {
    return new Uint8Array(await blob.arrayBuffer());
  }
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const base64 = dataUrl.split(',')[1];
  if (!base64) {
    throw new Error('CANVAS_ENCODE_JPEG_FAILED');
  }
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });
  if (blob) {
    return new Uint8Array(await blob.arrayBuffer());
  }
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  if (!base64) {
    throw new Error('CANVAS_ENCODE_PNG_FAILED');
  }
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function exportWorkspaceTreePng(keyword: string): Promise<void> {
  getExportTarget();
  const graphRoot = getGraphCaptureElement();
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  const canvas = await captureTreeToCanvas(graphRoot, 1.5, null);
  const pngBytes = await canvasToPngBytes(canvas);
  triggerBrowserDownload(new Blob([pngBytes], { type: 'image/png' }), `${buildFileStem(keyword)}.png`);
}

export async function exportWorkspaceWithDashboardPng(keyword: string): Promise<void> {
  const target = getExportAllTarget();
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  const rect = target.getBoundingClientRect();
  const html2canvas = (await import('html2canvas')).default;
  const scale = pickCaptureScale(rect.width, rect.height, 1.25);
  const canvas = await html2canvas(target, {
    useCORS: true,
    allowTaint: false,
    backgroundColor: null,
    width: Math.max(1, Math.ceil(rect.width)),
    height: Math.max(1, Math.ceil(rect.height)),
    windowWidth: Math.max(typeof window !== 'undefined' ? window.innerWidth : 0, Math.ceil(rect.width)),
    windowHeight: Math.max(typeof window !== 'undefined' ? window.innerHeight : 0, Math.ceil(rect.height)),
    scale,
    logging: false,
    removeContainer: true,
    foreignObjectRendering: false,
    onclone: (doc, cloned) => {
      onCloneForCapture(doc, cloned);
      const root = doc.getElementById(EXPORT_ALL_TARGET_ID);
      if (root) {
        root.style.opacity = '1';
        root.style.visibility = 'visible';
        root.style.overflow = 'visible';
      }
    },
  });
  const pngBytes = await canvasToPngBytes(canvas);
  triggerBrowserDownload(
    new Blob([pngBytes], { type: 'image/png' }),
    `${buildFileStem(keyword)}-with-dashboard.png`
  );
}

export async function exportDashboardOnlyPng(keyword: string): Promise<void> {
  const target = getDashboardExportTarget();
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  const rect = target.getBoundingClientRect();
  const html2canvas = (await import('html2canvas')).default;
  const scale = pickCaptureScale(rect.width, rect.height, 1.25);
  const canvas = await html2canvas(target, {
    useCORS: true,
    allowTaint: false,
    backgroundColor: null,
    width: Math.max(1, Math.ceil(rect.width)),
    height: Math.max(1, Math.ceil(rect.height)),
    windowWidth: Math.max(typeof window !== 'undefined' ? window.innerWidth : 0, Math.ceil(rect.width)),
    windowHeight: Math.max(typeof window !== 'undefined' ? window.innerHeight : 0, Math.ceil(rect.height)),
    scale,
    logging: false,
    removeContainer: true,
    foreignObjectRendering: false,
  });
  const pngBytes = await canvasToPngBytes(canvas);
  triggerBrowserDownload(new Blob([pngBytes], { type: 'image/png' }), `${buildFileStem(keyword)}-dashboard.png`);
}

export async function exportWorkspaceTreePdf(keyword: string): Promise<void> {
  if (typeof window === 'undefined') return;
  getExportTarget();
  const graphRoot = getGraphCaptureElement();
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  const canvas = await captureTreeToCanvas(graphRoot, 1.25, '#080C12');

  if (canvas.width < 2 || canvas.height < 2) {
    throw new Error('CAPTURE_EMPTY');
  }

  const pageLandscape = canvas.width >= canvas.height;
  const pageW = pageLandscape ? 841.89 : 595.28; // A4 pt
  const pageH = pageLandscape ? 595.28 : 841.89;
  const margin = 24;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const fit = Math.min(maxW / canvas.width, maxH / canvas.height);
  const drawW = canvas.width * fit;
  const drawH = canvas.height * fit;
  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;
  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([pageW, pageH]);

  let img;
  try {
    const jpegBytes = await canvasToJpegBytes(canvas, 0.88);
    img = await pdfDoc.embedJpg(jpegBytes);
  } catch {
    const pngBytes = await canvasToPngBytes(canvas);
    img = await pdfDoc.embedPng(pngBytes);
  }

  page.drawImage(img, { x, y, width: drawW, height: drawH });

  const bytes = await pdfDoc.save();
  triggerBrowserDownload(new Blob([bytes], { type: 'application/pdf' }), `${buildFileStem(keyword)}.pdf`);
}

export async function exportWorkspaceWithDashboardPdf(keyword: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const target = getExportAllTarget();
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  const rect = target.getBoundingClientRect();
  const html2canvas = (await import('html2canvas')).default;
  const scale = pickCaptureScale(rect.width, rect.height, 1.1);
  const canvas = await html2canvas(target, {
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#080C12',
    width: Math.max(1, Math.ceil(rect.width)),
    height: Math.max(1, Math.ceil(rect.height)),
    windowWidth: Math.max(typeof window !== 'undefined' ? window.innerWidth : 0, Math.ceil(rect.width)),
    windowHeight: Math.max(typeof window !== 'undefined' ? window.innerHeight : 0, Math.ceil(rect.height)),
    scale,
    logging: false,
    removeContainer: true,
    foreignObjectRendering: false,
    onclone: (doc, cloned) => {
      onCloneForCapture(doc, cloned);
      const root = doc.getElementById(EXPORT_ALL_TARGET_ID);
      if (root) {
        root.style.opacity = '1';
        root.style.visibility = 'visible';
        root.style.overflow = 'visible';
      }
    },
  });

  if (canvas.width < 2 || canvas.height < 2) {
    throw new Error('CAPTURE_EMPTY');
  }

  const pageLandscape = canvas.width >= canvas.height;
  const pageW = pageLandscape ? 841.89 : 595.28; // A4 pt
  const pageH = pageLandscape ? 595.28 : 841.89;
  const margin = 24;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const fit = Math.min(maxW / canvas.width, maxH / canvas.height);
  const drawW = canvas.width * fit;
  const drawH = canvas.height * fit;
  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;
  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([pageW, pageH]);

  let img;
  try {
    const jpegBytes = await canvasToJpegBytes(canvas, 0.88);
    img = await pdfDoc.embedJpg(jpegBytes);
  } catch {
    const pngBytes = await canvasToPngBytes(canvas);
    img = await pdfDoc.embedPng(pngBytes);
  }

  page.drawImage(img, { x, y, width: drawW, height: drawH });

  const bytes = await pdfDoc.save();
  triggerBrowserDownload(
    new Blob([bytes], { type: 'application/pdf' }),
    `${buildFileStem(keyword)}-with-dashboard.pdf`
  );
}

export async function exportDashboardOnlyPdf(keyword: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const target = getDashboardExportTarget();
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  const rect = target.getBoundingClientRect();
  const html2canvas = (await import('html2canvas')).default;
  const scale = pickCaptureScale(rect.width, rect.height, 1.1);
  const canvas = await html2canvas(target, {
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#080C12',
    width: Math.max(1, Math.ceil(rect.width)),
    height: Math.max(1, Math.ceil(rect.height)),
    windowWidth: Math.max(typeof window !== 'undefined' ? window.innerWidth : 0, Math.ceil(rect.width)),
    windowHeight: Math.max(typeof window !== 'undefined' ? window.innerHeight : 0, Math.ceil(rect.height)),
    scale,
    logging: false,
    removeContainer: true,
    foreignObjectRendering: false,
  });

  if (canvas.width < 2 || canvas.height < 2) {
    throw new Error('CAPTURE_EMPTY');
  }

  const pageLandscape = canvas.width >= canvas.height;
  const pageW = pageLandscape ? 841.89 : 595.28;
  const pageH = pageLandscape ? 595.28 : 841.89;
  const margin = 24;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const fit = Math.min(maxW / canvas.width, maxH / canvas.height);
  const drawW = canvas.width * fit;
  const drawH = canvas.height * fit;
  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;

  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([pageW, pageH]);

  let img;
  try {
    const jpegBytes = await canvasToJpegBytes(canvas, 0.88);
    img = await pdfDoc.embedJpg(jpegBytes);
  } catch {
    const pngBytes = await canvasToPngBytes(canvas);
    img = await pdfDoc.embedPng(pngBytes);
  }

  page.drawImage(img, { x, y, width: drawW, height: drawH });
  const bytes = await pdfDoc.save();
  triggerBrowserDownload(
    new Blob([bytes], { type: 'application/pdf' }),
    `${buildFileStem(keyword)}-dashboard.pdf`
  );
}
