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
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(target, {
    useCORS: true,
    backgroundColor: null,
    scale: Math.min(2, window.devicePixelRatio || 1),
    logging: false,
  });

  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `${buildFileStem(keyword)}.png`;
  a.click();
}

export async function exportWorkspaceTreePdf(keyword: string): Promise<void> {
  const target = getExportTarget();
  const html2canvas = (await import('html2canvas')).default;
  const [{ jsPDF }] = await Promise.all([import('jspdf')]);

  const canvas = await html2canvas(target, {
    useCORS: true,
    backgroundColor: '#080C12',
    scale: Math.min(2, window.devicePixelRatio || 1),
    logging: false,
  });

  const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'pt',
    format: 'a4',
    compress: true,
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const scale = Math.min(maxW / canvas.width, maxH / canvas.height);
  const drawW = canvas.width * scale;
  const drawH = canvas.height * scale;
  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;

  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, drawW, drawH, undefined, 'FAST');
  pdf.save(`${buildFileStem(keyword)}.pdf`);
}

