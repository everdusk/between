import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { PDF_NIGHT, type Rgb, type WeekPdfModel, type WeekPdfTheme } from "./week-pdf-model";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const BOTTOM = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

type Kind = "display" | "text" | "strong";

type Face = {
  pdf: PDFFont;
  covers: (text: string) => boolean;
};

export type WeekPdfFonts = {
  display: Uint8Array;
  text: Uint8Array;
  strong: Uint8Array;
  arabic: Uint8Array;
  devanagari: Uint8Array;
};

const FONT_URLS: Record<keyof WeekPdfFonts, string> = {
  display: "/fonts/Unbounded-SemiBold.ttf",
  text: "/fonts/Manrope-Regular.ttf",
  strong: "/fonts/Manrope-SemiBold.ttf",
  arabic: "/fonts/NotoSansArabic-Regular.ttf",
  devanagari: "/fonts/NotoSansDevanagari-Regular.ttf",
};

let fontCache: Promise<WeekPdfFonts> | null = null;

function paint(color: Rgb) {
  return rgb(clamp(color.r), clamp(color.g), clamp(color.b));
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function rounded(w: number, h: number, r: number): string {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  return [
    `M ${radius} 0`,
    `H ${w - radius}`,
    `A ${radius} ${radius} 0 0 1 ${w} ${radius}`,
    `V ${h - radius}`,
    `A ${radius} ${radius} 0 0 1 ${w - radius} ${h}`,
    `H ${radius}`,
    `A ${radius} ${radius} 0 0 1 0 ${h - radius}`,
    `V ${radius}`,
    `A ${radius} ${radius} 0 0 1 ${radius} 0`,
    "Z",
  ].join(" ");
}

function glyphCovers(font: { glyphForCodePoint: (code: number) => { id: number } }, text: string): boolean {
  for (const char of text) {
    if (char === "\n" || char.trim() === "") continue;
    const code = char.codePointAt(0);
    if (code == null) return false;
    const glyph = font.glyphForCodePoint(code);
    if (!glyph || glyph.id === 0) return false;
  }
  return true;
}

export async function renderWeekPdf(model: WeekPdfModel, fonts: WeekPdfFonts): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(model.range || "Between");
  doc.setAuthor("Between");
  const opened = {
    display: fontkit.create(fonts.display),
    text: fontkit.create(fonts.text),
    strong: fontkit.create(fonts.strong),
    arabic: fontkit.create(fonts.arabic),
    devanagari: fontkit.create(fonts.devanagari),
  };
  const embedded = {
    display: await doc.embedFont(fonts.display, { subset: true }),
    text: await doc.embedFont(fonts.text, { subset: true }),
    strong: await doc.embedFont(fonts.strong, { subset: true }),
    arabic: await doc.embedFont(fonts.arabic, { subset: true }),
    devanagari: await doc.embedFont(fonts.devanagari, { subset: true }),
  };
  const faces: Record<Kind | "arabic" | "devanagari", Face> = {
    display: { pdf: embedded.display, covers: (text) => glyphCovers(opened.display, text) },
    text: { pdf: embedded.text, covers: (text) => glyphCovers(opened.text, text) },
    strong: { pdf: embedded.strong, covers: (text) => glyphCovers(opened.strong, text) },
    arabic: { pdf: embedded.arabic, covers: (text) => glyphCovers(opened.arabic, text) },
    devanagari: { pdf: embedded.devanagari, covers: (text) => glyphCovers(opened.devanagari, text) },
  };
  const order: Face[] = [faces.display, faces.text, faces.strong, faces.arabic, faces.devanagari];

  const sheet = new Sheet(doc);
  drawMast(sheet, faces.display, order, model.range);
  drawSpectrum(sheet, faces, order, model);
  drawBacklog(sheet, faces, order, model);
  const pages = doc.getPages();
  pages.forEach((page, index) => {
    const label = String(index + 1);
    const size = 8;
    const width = faces.text.pdf.widthOfTextAtSize(label, size);
    page.drawText(label, {
      x: PAGE_W - MARGIN - width,
      y: 24,
      size,
      font: faces.text.pdf,
      color: paint(PDF_NIGHT.muted),
    });
  });
  return doc.save();
}

class Sheet {
  page: PDFPage;
  top = MARGIN;

  constructor(private doc: PDFDocument) {
    this.page = this.fresh();
  }

  fresh(): PDFPage {
    const page = this.doc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_W,
      height: PAGE_H,
      color: paint(PDF_NIGHT.ground),
    });
    this.page = page;
    this.top = MARGIN;
    return page;
  }

  room(): number {
    return PAGE_H - BOTTOM - this.top;
  }

  ensure(height: number) {
    if (this.top > MARGIN && height > this.room()) this.fresh();
  }

  y(fromTop: number): number {
    return PAGE_H - fromTop;
  }
}

function faceFor(text: string, prefer: Face, order: Face[]): Face {
  if (prefer.covers(text)) return prefer;
  return order.find((face) => face.covers(text)) ?? prefer;
}

function keepVisible(text: string, order: Face[]): string {
  let out = "";
  for (const char of text) {
    if (char === "\n" || char.trim() === "" || order.some((face) => face.covers(char))) out += char;
  }
  return out;
}

function wrap(text: string, size: number, width: number, prefer: Face, order: Face[]): string[] {
  const lines: string[] = [];
  for (const para of keepVisible(text, order).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    const widthOf = (value: string) => faceFor(value, prefer, order).pdf.widthOfTextAtSize(value, size);
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (widthOf(next) <= width) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      if (widthOf(word) <= width) {
        line = word;
        continue;
      }
      let chunk = "";
      for (const char of word) {
        const trial = chunk + char;
        if (widthOf(trial) <= width) chunk = trial;
        else {
          if (chunk) lines.push(chunk);
          chunk = char;
        }
      }
      line = chunk;
    }
    if (line) lines.push(line);
  }
  return lines.length > 0 ? lines : [""];
}

function drawLines(
  sheet: Sheet,
  lines: string[],
  x: number,
  size: number,
  lead: number,
  prefer: Face,
  order: Face[],
  color: Rgb,
) {
  for (const line of lines) {
    if (!line) {
      sheet.top += lead;
      continue;
    }
    const face = faceFor(line, prefer, order);
    sheet.page.drawText(line, {
      x,
      y: sheet.y(sheet.top + size),
      size,
      font: face.pdf,
      color: paint(color),
    });
    sheet.top += lead;
  }
}

const HAIRLINE = { color: PDF_NIGHT.line, width: 0.7, opacity: 0.16 };

function drawEyebrow(sheet: Sheet, text: string, x: number, prefer: Face, order: Face[], color: Rgb = PDF_NIGHT.muted) {
  const label = keepVisible(text, order).toLocaleUpperCase();
  const size = 8;
  const tracking = 1.28;
  let cursor = x;
  for (const char of label) {
    const face = faceFor(char, prefer, order);
    sheet.page.drawText(char, {
      x: cursor,
      y: sheet.y(sheet.top + size),
      size,
      font: face.pdf,
      color: paint(color),
    });
    cursor += face.pdf.widthOfTextAtSize(char, size) + tracking;
  }
  sheet.top += 14;
}

function roundRect(
  page: PDFPage,
  x: number,
  bottom: number,
  w: number,
  h: number,
  radius: number,
  fill?: Rgb,
  border?: { color: Rgb; width: number; dash?: number[]; opacity?: number },
  opacity?: number,
) {
  // pdf-lib flips the SVG Y axis, so this point is the top edge and the path grows downward.
  page.drawSvgPath(rounded(w, h, radius), {
    x,
    y: bottom + h,
    color: fill ? paint(fill) : undefined,
    opacity,
    borderColor: border ? paint(border.color) : undefined,
    borderWidth: border?.width,
    borderDashArray: border?.dash,
    borderOpacity: border?.opacity ?? 1,
  });
}

function drawMast(sheet: Sheet, display: Face, order: Face[], range: string) {
  drawEyebrow(sheet, "Between", MARGIN, display, order, PDF_NIGHT.mint);
  sheet.top += 4;
  const lines = wrap(range, 22, CONTENT_W, display, order);
  drawLines(sheet, lines, MARGIN, 22, 26, display, order, PDF_NIGHT.ink);
  sheet.top += 16;
}

function legendRows(model: WeekPdfModel, width: number, text: Face): number {
  let rows = 1;
  let cursor = 0;
  for (const share of model.shares) {
    const labelW = text.pdf.widthOfTextAtSize(`${share.label} ${share.count}`, 8) + 16;
    if (cursor > 0 && cursor + labelW > width) {
      rows += 1;
      cursor = labelW;
    } else cursor += labelW;
  }
  return rows;
}

function drawSpectrum(
  sheet: Sheet,
  faces: Record<Kind, Face>,
  order: Face[],
  model: WeekPdfModel,
) {
  const pad = 16;
  const inner = CONTENT_W - pad * 2;
  const title = wrap(model.spectrumTitle, 18, inner, faces.display, order);
  const lead =
    model.spectrumLead && model.spectrumLead !== model.spectrumTitle
      ? wrap(model.spectrumLead, 10, inner, faces.text, order)
      : [];
  const pattern = wrap(model.patternText, 10.5, inner - 24, faces.text, order);
  const shareDelta = model.shares.length
    ? 12 + 16 + (legendRows(model, inner, faces.text) - 1) * 14 + 12 + (model.axis ? 12 : 0)
    : 0;
  const dayDelta = model.days.length ? 12 + 108 : 0;
  const nestH = 12 + 14 + 2 + pattern.length * 15 + 10;
  const height = 16 + 14 + 4 + title.length * 22 + (lead.length ? 4 + lead.length * 14 : 0) + shareDelta + dayDelta + 12 + nestH + 16;
  sheet.ensure(Math.min(height, PAGE_H - MARGIN - BOTTOM));
  const top = sheet.top;
  const x = MARGIN + pad;
  roundRect(sheet.page, MARGIN, sheet.y(top + height), CONTENT_W, height, 22, PDF_NIGHT.strong, HAIRLINE);
  sheet.top = top + 16;
  drawEyebrow(sheet, model.spectrumLabel, x, faces.display, order);
  sheet.top += 4;
  drawLines(sheet, title, x, 18, 22, faces.display, order, PDF_NIGHT.ink);
  if (lead.length) {
    sheet.top += 4;
    drawLines(sheet, lead, x, 10, 14, faces.text, order, PDF_NIGHT.muted);
  }
  if (model.shares.length) {
    sheet.top += 12;
    drawShares(sheet, x, inner, model, faces.text, order);
  }
  if (model.days.length) {
    sheet.top += 12;
    drawDays(sheet, x, inner, model, faces.text, order);
  }
  sheet.top += 12;
  const nestTop = sheet.top;
  roundRect(sheet.page, x, sheet.y(nestTop + nestH), inner, nestH, 16, PDF_NIGHT.nest);
  sheet.top = nestTop + 12;
  drawEyebrow(sheet, model.patternTitle, x + 12, faces.display, order);
  sheet.top += 2;
  drawLines(sheet, pattern, x + 12, 10.5, 15, faces.text, order, PDF_NIGHT.ink);
  sheet.top = top + height + 14;
}

function drawShares(sheet: Sheet, x: number, width: number, model: WeekPdfModel, text: Face, order: Face[]) {
  const gap = 3;
  const total = model.shares.reduce((sum, share) => sum + share.count, 0) || 1;
  const spare = width - gap * Math.max(0, model.shares.length - 1);
  const raw = model.shares.map((share) => Math.max(6, (spare * share.count) / total));
  const rawSum = raw.reduce((sum, bar) => sum + bar, 0) || 1;
  let cursor = x;
  model.shares.forEach((share, index) => {
    const bar = raw[index] * (spare / rawSum);
    roundRect(sheet.page, cursor, sheet.y(sheet.top + 8), bar, 8, 4, share.color);
    cursor += bar + (index === model.shares.length - 1 ? 0 : gap);
  });
  sheet.top += 16;
  let legendX = x;
  let legendY = sheet.top;
  for (const share of model.shares) {
    const label = `${share.label} ${share.count}`;
    const labelW = text.pdf.widthOfTextAtSize(label, 8) + 16;
    if (legendX > x && legendX + labelW > x + width) {
      legendX = x;
      legendY += 14;
    }
    sheet.page.drawCircle({
      x: legendX + 3,
      y: sheet.y(legendY + 6),
      size: 3,
      color: paint(share.color),
    });
    const legendFace = faceFor(label, text, order);
    sheet.page.drawText(label, {
      x: legendX + 10,
      y: sheet.y(legendY + 9),
      size: 8,
      font: legendFace.pdf,
      color: paint(PDF_NIGHT.ink),
    });
    legendX += labelW;
  }
  sheet.top = legendY + 12;
  if (model.axis) {
    const axisFace = faceFor(model.axis, text, order);
    sheet.page.drawText(model.axis, {
      x,
      y: sheet.y(sheet.top + 8),
      size: 8,
      font: axisFace.pdf,
      color: paint(PDF_NIGHT.muted),
    });
    sheet.top += 12;
  }
}

function drawDays(sheet: Sheet, x: number, width: number, model: WeekPdfModel, text: Face, order: Face[]) {
  const count = model.days.length;
  const gap = 6;
  const slot = count > 7 ? (width - gap * (count - 1)) / count : (width - gap * 6) / 7;
  model.days.forEach((day, index) => {
    const left = x + index * (slot + gap);
    const body = 64;
    const faded = day.future && day.slices.length === 0;
    if (day.slices.length === 0) {
      roundRect(
        sheet.page,
        left,
        sheet.y(sheet.top + body),
        slot,
        body,
        10,
        undefined,
        { color: day.today ? PDF_NIGHT.mint : PDF_NIGHT.muted, width: day.today ? 1.4 : 0.8, dash: [2, 2], opacity: faded ? 0.35 : day.today ? 1 : 0.55 },
        faded ? 0.4 : 1,
      );
    } else {
      roundRect(
        sheet.page,
        left,
        sheet.y(sheet.top + body),
        slot,
        body,
        10,
        PDF_NIGHT.nest,
        day.today ? { color: PDF_NIGHT.mint, width: 1.2 } : HAIRLINE,
      );
      const pad = 4;
      const innerH = body - pad * 2;
      const gapY = 2;
      const sliceH = (innerH - gapY * (day.slices.length - 1)) / day.slices.length;
      day.slices.forEach((slice, sliceIndex) => {
        const sliceTop = sheet.top + pad + sliceIndex * (sliceH + gapY);
        const piece = slice.length > 0 ? slot - pad * 2 : 0;
        slice.forEach((color, colorIndex) => {
          const pieceW = piece / slice.length;
          roundRect(
            sheet.page,
            left + pad + colorIndex * pieceW,
            sheet.y(sliceTop + sliceH),
            pieceW + (colorIndex === slice.length - 1 ? 0 : 0.4),
            sliceH,
            3,
            color,
          );
        });
      });
    }
    const weekdayFace = faceFor(day.weekday, text, order);
    const weekdayW = weekdayFace.pdf.widthOfTextAtSize(day.weekday, 8);
    sheet.page.drawText(day.weekday, {
      x: left + (slot - weekdayW) / 2,
      y: sheet.y(sheet.top + body + 14),
      size: 8,
      font: weekdayFace.pdf,
      color: paint(day.today ? PDF_NIGHT.ink : PDF_NIGHT.muted),
    });
    const numberFace = faceFor(day.day, text, order);
    const numberW = numberFace.pdf.widthOfTextAtSize(day.day, 8);
    sheet.page.drawText(day.day, {
      x: left + (slot - numberW) / 2,
      y: sheet.y(sheet.top + body + 26),
      size: 8,
      font: numberFace.pdf,
      color: paint(PDF_NIGHT.muted),
    });
  });
  sheet.top += 108;
}

function drawBacklog(
  sheet: Sheet,
  faces: Record<Kind, Face>,
  order: Face[],
  model: WeekPdfModel,
) {
  sheet.ensure(64);
  const heading = wrap(model.backlogTitle, 18, CONTENT_W, faces.display, order);
  drawLines(sheet, heading, MARGIN, 18, 22, faces.display, order, PDF_NIGHT.ink);
  sheet.top += 4;
  const lead = wrap(model.backlogLead, 10, CONTENT_W, faces.text, order);
  drawLines(sheet, lead, MARGIN, 10, 14, faces.text, order, PDF_NIGHT.muted);
  sheet.top += 10;
  if (model.emptyBacklog) {
    const lines = wrap(model.emptyBacklog, 10.5, CONTENT_W - 32, faces.text, order);
    const height = 20 + lines.length * 15;
    sheet.ensure(height);
    const top = sheet.top;
    roundRect(
      sheet.page,
      MARGIN,
      sheet.y(top + height),
      CONTENT_W,
      height,
      14,
      undefined,
      { color: PDF_NIGHT.muted, width: 0.8, dash: [2, 2], opacity: 0.8 },
    );
    sheet.top = top + 12;
    drawLines(sheet, lines, MARGIN + 16, 10.5, 15, faces.text, order, PDF_NIGHT.muted);
    sheet.top = top + height;
    return;
  }
  for (const theme of model.themes) drawTheme(sheet, faces, order, theme);
}

function drawTheme(sheet: Sheet, faces: Record<Kind, Face>, order: Face[], theme: WeekPdfTheme) {
  const title = wrap(theme.title, 13, CONTENT_W, faces.display, order);
  const block = 8 + title.length * 17 + 16;
  sheet.ensure(block + 28);
  sheet.top += 8;
  drawLines(sheet, title, MARGIN, 13, 17, faces.display, order, PDF_NIGHT.ink);
  sheet.top += 2;
  sheet.page.drawText(theme.meta, {
    x: MARGIN,
    y: sheet.y(sheet.top + 9),
    size: 8.5,
    font: faceFor(theme.meta, faces.text, order).pdf,
    color: paint(PDF_NIGHT.muted),
  });
  sheet.top += 16;
  if (theme.empty) {
    drawLines(sheet, [theme.empty], MARGIN, 10, 14, faces.text, order, PDF_NIGHT.muted);
    return;
  }
  for (const note of theme.notes) {
    const body = note.body ? wrap(note.body, 10.5, CONTENT_W - 32, faces.text, order) : [];
    const head = note.feelings.length ? `${note.when} · ${note.feelings.map((item) => item.label).join(", ")}` : note.when;
    const all = [head, ...body];
    const whole = 16 + all.reduce((sum, _, line) => sum + (line === 0 ? 15 : 14), 0) + 4;
    if (whole + 8 <= PAGE_H - MARGIN - BOTTOM && whole > sheet.room()) sheet.fresh();
    let index = 0;
    while (index < all.length) {
      const lead = index === 0 ? 15 : 14;
      const room = Math.max(lead + 14, sheet.room() - 24);
      let take = 0;
      let used = 16;
      while (index + take < all.length) {
        const step = index + take === 0 ? 15 : 14;
        if (take > 0 && used + step > room) break;
        used += step;
        take += 1;
        if (sheet.top === MARGIN && used > PAGE_H - MARGIN - BOTTOM - 24) break;
      }
      if (take === 0) {
        sheet.fresh();
        continue;
      }
      const chunk = all.slice(index, index + take);
      const height = 16 + chunk.reduce((sum, _, line) => sum + (index + line === 0 ? 15 : 14), 0) + 4;
      sheet.ensure(height);
      const top = sheet.top;
      roundRect(sheet.page, MARGIN, sheet.y(top + height), CONTENT_W, height, 14, PDF_NIGHT.card, HAIRLINE);
      sheet.top = top + 10;
      chunk.forEach((line, lineIndex) => {
        const first = index + lineIndex === 0;
        if (first && note.feelings.length) {
          let cursor = MARGIN + 12;
          note.feelings.forEach((item) => {
            sheet.page.drawCircle({
              x: cursor + 3,
              y: sheet.y(sheet.top + 6),
              size: 3,
              color: paint(item.color),
            });
            cursor += 10;
          });
          sheet.page.drawText(head, {
            x: cursor + 2,
            y: sheet.y(sheet.top + 9),
            size: 8.5,
            font: faceFor(head, faces.text, order).pdf,
            color: paint(PDF_NIGHT.muted),
          });
          sheet.top += 15;
        } else {
          drawLines(sheet, [line], MARGIN + 12, first ? 8.5 : 10.5, first ? 15 : 14, faces.text, order, first ? PDF_NIGHT.muted : PDF_NIGHT.ink);
        }
      });
      sheet.top = top + height + 8;
      index += take;
    }
  }
}

async function loadFonts(): Promise<WeekPdfFonts> {
  if (!fontCache) {
    fontCache = (async () => {
      const pairs = await Promise.all(
        (Object.keys(FONT_URLS) as (keyof WeekPdfFonts)[]).map(async (key) => {
          const response = await fetch(FONT_URLS[key]);
          if (!response.ok) throw new Error("font");
          return [key, new Uint8Array(await response.arrayBuffer())] as const;
        }),
      );
      return Object.fromEntries(pairs) as WeekPdfFonts;
    })();
  }
  return fontCache;
}

/**
 * Shows the sheet. `preview` must be opened in the click, before the fonts load:
 * a desktop browser will not start a download once that gesture has passed.
 * The tab stays on the blob long enough for the viewer to read it.
 */
export async function downloadWeekPdf(model: WeekPdfModel, preview?: Window | null): Promise<void> {
  const bytes = await renderWeekPdf(model, await loadFonts());
  const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  if (preview && !preview.closed) {
    preview.location.href = url;
    try {
      preview.opener = null;
    } catch {
      /* The viewer does not need the journal. */
    }
    return;
  }
  const link = document.createElement("a");
  link.href = url;
  link.download = model.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
