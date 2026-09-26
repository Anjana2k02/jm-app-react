import type { jsPDF } from 'jspdf';

const sinhala = /[\u0D80-\u0DFF]/;
const needsBrowserText = /[^\x20-\x7E]/;
let fontsReady: Promise<void> | undefined;

async function loadSinhalaFonts() {
  fontsReady ??= Promise.all(
    ['Regular', 'Bold'].map(async (style) => {
      const face = new FontFace(
        'PDF Sinhala',
        // Version the URL too: cached 2.002 files have broken Sinhala advances
        // with modern shapers (notofonts/sinhala#1).
        `url("${import.meta.env.BASE_URL}fonts/NotoSansSinhala-3.000-${style}.ttf")`,
        { weight: style === 'Bold' ? '700' : '400' },
      );
      document.fonts.add(await face.load());
    }),
  )
    .then(() => undefined)
    .catch((error) => {
      fontsReady = undefined;
      throw new Error('The Sinhala PDF font could not load. Please retry the export.', {
        cause: error,
      });
    });
  await fontsReady;
}

// Standard PDF fonts cannot encode Sinhala, and embedding a font alone does not
// shape its conjuncts and vowel marks. Let the browser shape whole Unicode lines,
// then embed them at 4x resolution. Plain English text remains searchable PDF text.
export async function createPdfText(pdf: jsPDF, texts: string[]) {
  if (texts.some((text) => sinhala.test(text))) await loadSinhalaFonts();
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot render text for PDF export.');
  const ctx = context;
  const graphemes = new Intl.Segmenter('si', { granularity: 'grapheme' });

  function font(text: string) {
    const { fontName, fontStyle } = pdf.getFont();
    // Use the bundled, corrected font for the entire Sinhala shaped run.
    const family = sinhala.test(text)
      ? '"PDF Sinhala"'
      : fontName === 'courier'
        ? '"Courier New"'
        : 'Arial';
    return `${fontStyle.includes('italic') ? 'italic ' : ''}${fontStyle.includes('bold') ? '700' : '400'} ${pdf.getFontSize()}px ${family}, "PDF Sinhala", sans-serif`;
  }

  function wrap(text: string, width: number): string[] {
    if (!needsBrowserText.test(text)) return pdf.splitTextToSize(text, width) as string[];
    ctx.font = font(text);
    const lines: string[] = [];
    for (const paragraph of text.split('\n')) {
      let line = '';
      // Keep spaces within a line so chord/lyric alignment survives export.
      for (const token of paragraph.match(/\s+|\S+/gu) ?? []) {
        if (line && ctx.measureText(line + token).width > width) {
          lines.push(line.trimEnd());
          line = '';
          if (!token.trim()) continue;
        }
        if (ctx.measureText(token).width <= width) {
          line += token;
        } else {
          // Never split a vowel mark or a conjunct from its grapheme cluster.
          for (const { segment } of graphemes.segment(token)) {
            if (line && ctx.measureText(line + segment).width > width) {
              lines.push(line);
              line = '';
            }
            line += segment;
          }
        }
      }
      lines.push(line);
    }
    return lines;
  }

  function draw(text: string, x: number, baseline: number, maxWidth?: number) {
    if (!text) return;
    if (!needsBrowserText.test(text)) {
      if (maxWidth && pdf.getTextWidth(text) > maxWidth) {
        const size = pdf.getFontSize();
        pdf.setFontSize((size * maxWidth) / pdf.getTextWidth(text));
        pdf.text(text, x, baseline);
        pdf.setFontSize(size);
      } else pdf.text(text, x, baseline);
      return;
    }
    const cssFont = font(text);
    ctx.font = cssFont;
    const metrics = ctx.measureText(text);
    const padding = 2;
    const left = Math.max(0, metrics.actualBoundingBoxLeft);
    const ascent = Math.max(pdf.getFontSize(), metrics.actualBoundingBoxAscent);
    const descent = Math.max(pdf.getFontSize() * 0.35, metrics.actualBoundingBoxDescent);
    const w = Math.ceil(
      Math.max(metrics.width, metrics.actualBoundingBoxRight) + left + padding * 2,
    );
    const h = Math.ceil(ascent + descent + padding * 2);
    const resolution = 4;
    canvas.width = w * resolution;
    canvas.height = h * resolution;
    ctx.scale(resolution, resolution);
    ctx.font = cssFont;
    ctx.fillStyle = pdf.getTextColor();
    ctx.fillText(text, left + padding, ascent + padding);
    const scale = maxWidth ? Math.min(1, maxWidth / w) : 1;
    pdf.addImage(
      canvas,
      'PNG',
      x - (left + padding) * scale,
      baseline - (ascent + padding) * scale,
      w * scale,
      h * scale,
      undefined,
      'FAST',
    );
  }

  return { wrap, draw };
}
