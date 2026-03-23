const EXPORT_TARGET_ID = 'workspace-tree-export-target';

function getExportTarget(): HTMLElement {
  const el = document.getElementById(EXPORT_TARGET_ID);
  if (!el) {
    throw new Error('EXPORT_TARGET_MISSING');
  }
  return el;
}

function buildFileStem(keyword: string): string {
  const safe =
    keyword.replace(/[^\w\s\-.\\u0080-\\uFFFF]/gi, '_').slice(0, 48) || 'workspace';
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `qx10lol-tree-${safe}-${stamp}`;
}

export async function exportWorkspaceTreePng(keyword: string): Promise<void> {
  const target = getExportTarget();
  const rect = target.getBoundingClientRect();
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(target, {
    useCORS: true,
    backgroundColor: null,
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height)),
    scrollX: 0,
    scrollY: 0,
    scale: Math.min(1.5, window.devicePixelRatio || 1),
    logging: false,
  });

  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `${buildFileStem(keyword)}.png`;
  a.click();
}

export async function exportWorkspaceTreePdf(keyword: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const target = getExportTarget();
  const rect = target.getBoundingClientRect();
  const html2canvas = (await import('html2canvas')).default;
  const [{ PDFDocument }] = await Promise.all([import('pdf-lib')]);
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

  const canvas = await html2canvas(target, {
    useCORS: true,
    backgroundColor: '#080C12',
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height)),
    scrollX: 0,
    scrollY: 0,
    scale: Math.min(1.25, window.devicePixelRatio || 1),
    logging: false,
  });

  const pageLandscape = canvas.width >= canvas.height;
  const pageW = pageLandscape ? 841.89 : 595.28; // A4 pt
  const pageH = pageLandscape ? 595.28 : 841.89;
  const margin = 24;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const scale = Math.min(maxW / canvas.width, maxH / canvas.height);
  const drawW = canvas.width * scale;
  const drawH = canvas.height * scale;
  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([pageW, pageH]);
  const imgDataUrl = canvas.toDataURL('image/jpeg', 0.88);
  const img = await pdfDoc.embedJpg(imgDataUrl);
  page.drawImage(img, { x, y, width: drawW, height: drawH });

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${buildFileStem(keyword)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

