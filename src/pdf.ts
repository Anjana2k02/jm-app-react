import { jsPDF } from 'jspdf';
import type { Doc, Op, Session } from './model';

type Segment = { text?: string; image?: string; attrs: Record<string, unknown> };
type Line = { segments: Segment[]; attrs: Record<string, unknown> };

// Quill deltas store one op per styled run; the trailing "\n" op carries line styles.
function toLines(ops: Op[]): Line[] {
  const lines: Line[] = [];
  let current: Segment[] = [];
  for (const op of ops) {
    if (op.insert && typeof op.insert === 'object') {
      const image = (op.insert as Record<string, unknown>).image;
      if (typeof image === 'string') current.push({ image, attrs: op.attributes ?? {} });
      continue;
    }
    const parts = String(op.insert ?? '').split('\n');
    parts.forEach((part, i) => {
      if (part) current.push({ text: part, attrs: op.attributes ?? {} });
      if (i < parts.length - 1) {
        lines.push({ segments: current, attrs: op.attributes ?? {} });
        current = [];
      }
    });
  }
  if (current.length) lines.push({ segments: current, attrs: {} });
  return lines;
}

async function loadImage(src: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = src;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    return { data: canvas.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight };
  } catch {
    return null;
  }
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export async function exportSessionPdf(session: Session, songs: Doc[]) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth(),
    pageH = pdf.internal.pageSize.getHeight(),
    margin = 48,
    width = pageW - margin * 2;
  let y = margin;
  const ensure = (needed: number) => {
    if (y + needed > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(35);
  pdf.text(session.name || 'Session', margin, y + 20);
  y += 38;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(120);
  const meta = [
    session.session_date ? formatDate(session.session_date) : null,
    `${songs.length} ${songs.length === 1 ? 'song' : 'songs'}`,
  ]
    .filter(Boolean)
    .join('   ·   ');
  pdf.text(meta, margin, y);
  y += 16;
  if (session.notes) {
    const notes = pdf.splitTextToSize(session.notes, width) as string[];
    pdf.text(notes, margin, y);
    y += notes.length * 13;
  }
  y += 6;
  pdf.setDrawColor(215);
  pdf.line(margin, y, pageW - margin, y);
  y += 30;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(35);
  pdf.text('Setlist', margin, y);
  y += 20;
  songs.forEach((song, i) => {
    ensure(17);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(70);
    pdf.text(
      `${String(i + 1).padStart(2, '0')}   ${song.title || 'Untitled'}${song.artist ? `   —   ${song.artist}` : ''}`,
      margin,
      y,
    );
    y += 17;
  });

  for (const [index, song] of songs.entries()) {
    // Every song starts on a fresh page; the first page stays as the cover.
    pdf.addPage();
    y = margin;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.setTextColor(35);
    pdf.text(`${String(index + 1).padStart(2, '0')}   ${song.title || 'Untitled'}`, margin, y + 8);
    y += 30;
    if (song.artist) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(120);
      pdf.text(song.artist, margin, y);
      y += 16;
    }
    pdf.setDrawColor(225);
    pdf.line(margin, y, pageW - margin, y);
    y += 22;

    for (const line of toLines(song.content)) {
      const images = line.segments.filter((s) => s.image);
      for (const segment of images) {
        const image = await loadImage(segment.image!);
        if (!image) {
          ensure(14);
          pdf.setFont('helvetica', 'italic');
          pdf.setFontSize(10);
          pdf.setTextColor(150);
          pdf.text('[image could not be embedded]', margin, y);
          y += 14;
          continue;
        }
        const scale = Math.min(width / image.w, 280 / image.h, 0.75);
        const w = image.w * scale,
          h = image.h * scale;
        ensure(h + 8);
        pdf.addImage(image.data, 'PNG', margin, y, w, h);
        y += h + 8;
      }

      let text = line.segments.map((s) => s.text ?? '').join('');
      if (!text.trim()) {
        if (!images.length) y += 7;
        continue;
      }
      if (line.attrs.list) text = `•  ${text}`;
      const header = Number(line.attrs.header) || 0;
      const mono = line.segments.some((s) =>
        /courier|mono/i.test(String((s.attrs as { font?: unknown }).font ?? '')),
      );
      const bold =
        header > 0 || line.segments.every((s) => (s.attrs as { bold?: unknown }).bold === true);
      const italic = line.segments.every((s) => (s.attrs as { italic?: unknown }).italic === true);
      const sizeAttr = String((line.segments[0]?.attrs as { size?: unknown })?.size ?? '');
      const px = /^(\d+(?:\.\d+)?)px$/.exec(sizeAttr);
      const size = header === 1 ? 15 : header === 2 ? 13 : px ? Number(px[1]) * 0.75 : 10.5;
      pdf.setFont(
        mono ? 'courier' : 'helvetica',
        bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal',
      );
      pdf.setFontSize(size);
      pdf.setTextColor(mono ? 80 : 50);
      const lineHeight = size * 1.45;
      for (const wrapped of pdf.splitTextToSize(text, width) as string[]) {
        ensure(lineHeight);
        pdf.text(wrapped, margin, y);
        y += lineHeight;
      }
    }
  }

  const total = pdf.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(160);
    pdf.text(session.name || 'Session', margin, pageH - 24);
    pdf.text(`${page} / ${total}`, pageW - margin, pageH - 24, { align: 'right' });
  }

  const filename = (session.name || 'session').replace(/[\\/:*?"<>|]+/g, '').trim() || 'session';
  pdf.save(`${filename}.pdf`);
}
