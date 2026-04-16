import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
const FONT_CANDIDATES = [
  path.join(__dirname, '..', '..', 'assets', 'fonts', 'DejaVuSans.ttf'),
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/local/share/fonts/DejaVuSans.ttf',
];

const COLORS = {
  border: '#1f2937',
  borderLight: '#d1d5db',
  text: '#111827',
  muted: '#4b5563',
  accent: '#0f766e',
  accentFill: '#ecfeff',
  issue: '#b91c1c',
  issueFill: '#fef2f2',
};

const POSITION_LABELS: Record<string, string> = {
  front: 'Przód',
  rear: 'Tył',
  'left-side': 'Lewa strona',
  'right-side': 'Prawa strona',
  top: 'Góra',
  interior: 'Wnętrze',
  'front-left': 'Przód-lewo',
  'front-right': 'Przód-prawo',
  'rear-left': 'Tył-lewo',
  'rear-right': 'Tył-prawo',
};

const POSITION_ORDER = [
  'front',
  'front-left',
  'front-right',
  'left-side',
  'right-side',
  'top',
  'interior',
  'rear-left',
  'rear-right',
  'rear',
] as const;

const ZONE_LAYOUTS: Record<string, { x: number; y: number; width: number; height: number }> = {
  front: { x: 0.31, y: 0.06, width: 0.38, height: 0.075 },
  'front-left': { x: 0.17, y: 0.18, width: 0.14, height: 0.12 },
  'front-right': { x: 0.69, y: 0.18, width: 0.14, height: 0.12 },
  'left-side': { x: 0.14, y: 0.31, width: 0.12, height: 0.36 },
  'right-side': { x: 0.74, y: 0.31, width: 0.12, height: 0.36 },
  top: { x: 0.31, y: 0.18, width: 0.38, height: 0.13 },
  interior: { x: 0.29, y: 0.36, width: 0.42, height: 0.27 },
  'rear-left': { x: 0.17, y: 0.74, width: 0.14, height: 0.12 },
  'rear-right': { x: 0.69, y: 0.74, width: 0.14, height: 0.12 },
  rear: { x: 0.31, y: 0.87, width: 0.38, height: 0.075 },
};

interface HandoverPhoto {
  file_path: string;
  position_on_template: string;
  description: string;
  has_issue: number;
  issue_description: string;
  new_issue_description?: string;
}

interface HandoverData {
  id: number;
  handover_date: string;
  handover_time: string;
  equipment_notes: string;
  has_documents: number;
  beams_count: number;
  straps_count: number;
  status: string;
  company_name: string;
  company_address_line1: string;
  company_address_line2: string;
  company_postal_code: string;
  company_tax_id: string;
  company_phone: string;
  company_email: string;
  company_contact: string;
  registration_number: string;
  vin: string;
  brand: string;
  trailer_type: string;
  production_date: string;
  created_by_name: string;
  photos: HandoverPhoto[];
}

interface ReturnData {
  id: number;
  return_date: string;
  return_time: string;
  notes: string;
  return_has_documents: number;
  return_beams_count: number;
  return_straps_count: number;
  created_by_name: string;
  photos: HandoverPhoto[];
}

interface IssuerCompanyProfile {
  name: string;
  address: string;
  tax_id: string;
  phone: string;
  email: string;
}

interface TextCardOptions {
  x: number;
  y: number;
  width: number;
  title: string;
  lines: string[];
  minHeight?: number;
}

interface KeyValueGridOptions {
  x: number;
  y: number;
  width: number;
  title: string;
  items: Array<{ label: string; value: string }>;
  columns?: number;
}

interface IssueGroup {
  position: string;
  label: string;
  descriptions: string[];
  photos: HandoverPhoto[];
}

interface DamageSchemaSection {
  title: string;
  lines: string[];
}

interface DamageSchemaOptions {
  subtitle?: string;
  sections?: DamageSchemaSection[];
  emptyMessage?: string;
}

interface PhotoGalleryOptions {
  title: string;
  subtitle: string;
  statusLine: (photo: HandoverPhoto) => string;
}

let resolvedFontPath: string | null | undefined;

function resolvePdfFontPath(): string | null {
  if (resolvedFontPath !== undefined) {
    return resolvedFontPath;
  }

  resolvedFontPath = null;
  for (const candidate of FONT_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      resolvedFontPath = candidate;
      break;
    }
  }

  if (!resolvedFontPath) {
    console.warn('[pdf] Unicode font not found, falling back to PDF built-in font.');
  }

  return resolvedFontPath;
}

function createPdfDocument(): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  const fontPath = resolvePdfFontPath();

  if (fontPath) {
    doc.registerFont('main', fontPath);
    doc.font('main');
  }

  return doc;
}

function addPageNumbers(doc: PDFKit.PDFDocument): void {
  const range = doc.bufferedPageRange();
  const totalPages = range.count;

  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc.fontSize(8).fillColor(COLORS.muted).text(
      `Strona ${index - range.start + 1} / ${totalPages}`,
      doc.page.margins.left,
      doc.page.height - doc.page.margins.bottom - 12,
      {
        width: getContentWidth(doc),
        align: 'center',
      }
    );
  }

  if (totalPages > 0) {
    doc.switchToPage(range.start + range.count - 1);
  }
  doc.fillColor(COLORS.text);
}

function getContentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function getBottomLimit(doc: PDFKit.PDFDocument): number {
  return doc.page.height - doc.page.margins.bottom;
}

function ensurePageSpace(doc: PDFKit.PDFDocument, y: number, requiredHeight: number): number {
  if (y + requiredHeight <= getBottomLimit(doc)) {
    return y;
  }
  doc.addPage();
  return doc.page.margins.top;
}

function sanitizeText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  const text = String(value).trim();
  return text || '-';
}

function extractProductionYear(value: string): string {
  const normalized = value.trim();
  if (!normalized) return '-';
  const match = normalized.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : normalized;
}

function getCompanyAddressLines(data: HandoverData): string[] {
  const line1 = data.company_address_line1.trim();
  const line2 = data.company_address_line2.trim();
  const postalCode = data.company_postal_code?.trim() || '';
  const lines = [line1].filter(Boolean);

  if (postalCode && line2) {
    lines.push(`${postalCode} ${line2}`);
  } else if (line2) {
    lines.push(line2);
  } else if (postalCode) {
    lines.push(postalCode);
  }

  return lines;
}

function drawImageOrPlaceholder(
  doc: PDFKit.PDFDocument,
  filePath: string,
  options: {
    width: number;
    height: number;
    x?: number;
    y?: number;
    fit?: boolean;
  }
): void {
  const { width, height, x, y, fit = false } = options;
  const targetX = x ?? doc.x;
  const targetY = y ?? doc.y;

  const drawPlaceholder = (message: string) => {
    doc.save();
    doc.roundedRect(targetX, targetY, width, height, 6).fillAndStroke('#f9fafb', COLORS.borderLight);
    doc.fontSize(8).fillColor(COLORS.muted).text(message, targetX + 8, targetY + height / 2 - 6, {
      width: width - 16,
      align: 'center',
    });
    doc.fillColor(COLORS.text);
    doc.restore();
  };

  if (!fs.existsSync(filePath)) {
    drawPlaceholder('Brak pliku zdjęcia');
    return;
  }

  try {
    if (typeof x === 'number' && typeof y === 'number') {
      if (fit) {
        doc.image(filePath, x, y, { fit: [width, height], align: 'center', valign: 'center' });
      } else {
        doc.image(filePath, x, y, { width, height });
      }
    } else if (fit) {
      doc.image(filePath, { fit: [width, height], align: 'center', valign: 'center' });
    } else {
      doc.image(filePath, { width, height });
    }
  } catch {
    drawPlaceholder('Nie można załadować zdjęcia');
  }
}

function drawSectionHeading(doc: PDFKit.PDFDocument, y: number, title: string, subtitle?: string): number {
  const x = doc.page.margins.left;
  doc.fontSize(14).fillColor(COLORS.accent).text(title, x, y, { width: getContentWidth(doc) });
  let nextY = doc.y + 2;
  if (subtitle) {
    doc.fontSize(8).fillColor(COLORS.muted).text(subtitle, x, nextY, { width: getContentWidth(doc) });
    nextY = doc.y + 8;
  } else {
    nextY += 8;
  }
  doc.fillColor(COLORS.text);
  return nextY;
}

function drawTextCard(doc: PDFKit.PDFDocument, options: TextCardOptions): number {
  const { x, y, width, title, lines, minHeight = 0 } = options;
  const padding = 12;

  doc.fontSize(11);
  const titleHeight = doc.heightOfString(title, { width: width - padding * 2 });

  doc.fontSize(9);
  const linesHeight = lines.reduce((sum, line, index) => {
    const gap = index === lines.length - 1 ? 0 : 4;
    return sum + doc.heightOfString(line, { width: width - padding * 2 }) + gap;
  }, 0);

  const height = Math.max(minHeight, padding + titleHeight + 8 + linesHeight + padding);

  doc.save();
  doc.roundedRect(x, y, width, height, 8).fillAndStroke('white', COLORS.borderLight);
  doc.restore();

  doc.fontSize(11).fillColor(COLORS.accent).text(title, x + padding, y + padding, { width: width - padding * 2 });
  let lineY = y + padding + titleHeight + 8;
  doc.fontSize(9).fillColor(COLORS.text);
  lines.forEach((line) => {
    doc.text(line, x + padding, lineY, { width: width - padding * 2 });
    lineY = doc.y + 4;
  });

  doc.fillColor(COLORS.text);
  return y + height;
}

function drawKeyValueGrid(doc: PDFKit.PDFDocument, options: KeyValueGridOptions): number {
  const { x, y, width, title, items, columns = 2 } = options;
  const padding = 12;
  const headerHeight = 24;
  const cellWidth = width / columns;
  const rows = Math.ceil(items.length / columns);
  const rowHeight = 36;
  const height = padding + headerHeight + rows * rowHeight + padding;

  doc.save();
  doc.roundedRect(x, y, width, height, 8).fillAndStroke('white', COLORS.borderLight);
  doc.restore();

  doc.fontSize(11).fillColor(COLORS.accent).text(title, x + padding, y + padding, { width: width - padding * 2 });

  const tableY = y + padding + headerHeight;
  doc.save();
  for (let row = 0; row <= rows; row += 1) {
    const lineY = tableY + row * rowHeight;
    doc.moveTo(x, lineY).lineTo(x + width, lineY).strokeColor(COLORS.borderLight).lineWidth(1).stroke();
  }
  for (let col = 1; col < columns; col += 1) {
    const lineX = x + col * cellWidth;
    doc.moveTo(lineX, tableY).lineTo(lineX, tableY + rows * rowHeight).strokeColor(COLORS.borderLight).lineWidth(1).stroke();
  }
  doc.restore();

  items.forEach((item, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const cellX = x + col * cellWidth;
    const cellY = tableY + row * rowHeight;

    doc.fontSize(8).fillColor(COLORS.muted).text(item.label, cellX + padding, cellY + 6, { width: cellWidth - padding * 2 });
    doc.fontSize(10).fillColor(COLORS.text).text(item.value, cellX + padding, cellY + 18, {
      width: cellWidth - padding * 2,
      ellipsis: true,
    });
  });

  doc.fillColor(COLORS.text);
  return y + height;
}

function drawMetaRow(doc: PDFKit.PDFDocument, y: number, data: HandoverData): number {
  const x = doc.page.margins.left;
  const width = getContentWidth(doc);
  const colWidth = width / 3;
  const height = 76;
  const padding = 12;

  doc.save();
  doc.roundedRect(x, y, width, height, 8).fillAndStroke('white', COLORS.borderLight);
  doc.restore();

  for (let col = 1; col < 3; col += 1) {
    const lineX = x + col * colWidth;
    doc.moveTo(lineX, y).lineTo(lineX, y + height).strokeColor(COLORS.borderLight).lineWidth(1).stroke();
  }

  const columns = [
    { title: 'Data wydania', value: sanitizeText(data.handover_date) },
    { title: 'Godzina', value: sanitizeText(data.handover_time) },
    { title: 'Przygotował', value: sanitizeText(data.created_by_name) },
  ];

  columns.forEach((column, index) => {
    const colX = x + index * colWidth;
    doc.fontSize(8).fillColor(COLORS.muted).text(column.title, colX + padding, y + 12, { width: colWidth - padding * 2 });
    doc.fontSize(11).fillColor(COLORS.text).text(column.value, colX + padding, y + 28, { width: colWidth - padding * 2 });
  });

  doc.fillColor(COLORS.text);
  return y + height;
}

function drawReturnMetaRow(doc: PDFKit.PDFDocument, y: number, returnData: ReturnData, handoverId: number): number {
  const x = doc.page.margins.left;
  const width = getContentWidth(doc);
  const colWidth = width / 4;
  const height = 76;
  const padding = 12;

  doc.save();
  doc.roundedRect(x, y, width, height, 8).fillAndStroke('white', COLORS.borderLight);
  doc.restore();

  for (let col = 1; col < 4; col += 1) {
    const lineX = x + col * colWidth;
    doc.moveTo(lineX, y).lineTo(lineX, y + height).strokeColor(COLORS.borderLight).lineWidth(1).stroke();
  }

  const columns = [
    { title: 'Numer przekazania', value: sanitizeText(handoverId) },
    { title: 'Data zwrotu', value: sanitizeText(returnData.return_date) },
    { title: 'Godzina', value: sanitizeText(returnData.return_time) },
    { title: 'Przygotował', value: sanitizeText(returnData.created_by_name) },
  ];

  columns.forEach((column, index) => {
    const colX = x + index * colWidth;
    doc.fontSize(8).fillColor(COLORS.muted).text(column.title, colX + padding, y + 12, { width: colWidth - padding * 2 });
    doc.fontSize(10).fillColor(COLORS.text).text(column.value, colX + padding, y + 28, { width: colWidth - padding * 2 });
  });

  doc.fillColor(COLORS.text);
  return y + height;
}

function drawChecklistRow(doc: PDFKit.PDFDocument, y: number, data: HandoverData): number {
  const x = doc.page.margins.left;
  const width = getContentWidth(doc);
  const height = 72;
  const gap = 12;
  const itemWidth = (width - gap * 2) / 3;

  doc.save();
  doc.roundedRect(x, y, width, height, 8).fillAndStroke('white', COLORS.borderLight);
  doc.restore();

  const items = [
    {
      title: 'Dokumenty',
      checked: Boolean(data.has_documents),
      note: Boolean(data.has_documents) ? 'Komplet przekazano' : 'Brak przy wydaniu',
    },
    {
      title: 'Belki',
      checked: data.beams_count > 0,
      note: `${Math.max(data.beams_count, 0)} szt.`,
    },
    {
      title: 'Pasy',
      checked: data.straps_count > 0,
      note: `${Math.max(data.straps_count, 0)} szt.`,
    },
  ];

  items.forEach((item, index) => {
    const itemX = x + 12 + index * (itemWidth + gap);
    const boxY = y + 18;

    doc.rect(itemX, boxY, 12, 12).strokeColor(COLORS.border).lineWidth(1.2).stroke();
    if (item.checked) {
      doc.moveTo(itemX + 2, boxY + 7)
        .lineTo(itemX + 5, boxY + 10)
        .lineTo(itemX + 10, boxY + 2)
        .strokeColor(COLORS.accent)
        .lineWidth(1.4)
        .stroke();
    }

    doc.fontSize(10).fillColor(COLORS.text).text(item.title, itemX + 18, boxY - 1, {
      width: itemWidth - 18,
    });
    doc.fontSize(8).fillColor(COLORS.muted).text(item.note, itemX + 18, boxY + 15, {
      width: itemWidth - 18,
    });
  });

  doc.fillColor(COLORS.text);
  return y + height;
}

function drawReturnEquipmentComparisonRow(
  doc: PDFKit.PDFDocument,
  y: number,
  handoverData: HandoverData,
  returnData: ReturnData
): number {
  const x = doc.page.margins.left;
  const width = getContentWidth(doc);
  const height = 84;
  const gap = 12;
  const itemWidth = (width - gap * 2) / 3;

  doc.save();
  doc.roundedRect(x, y, width, height, 8).fillAndStroke('white', COLORS.borderLight);
  doc.restore();

  const items = [
    {
      title: 'Dokumenty',
      note: `Przekazanie: ${handoverData.has_documents ? 'TAK' : 'NIE'}`,
      result: `Zwrot: ${returnData.return_has_documents ? 'TAK' : 'NIE'}`,
      changed: Boolean(handoverData.has_documents) !== Boolean(returnData.return_has_documents),
    },
    {
      title: 'Belki',
      note: `Przekazanie: ${Math.max(handoverData.beams_count, 0)} szt.`,
      result: `Zwrot: ${Math.max(returnData.return_beams_count, 0)} szt.`,
      changed: Math.max(handoverData.beams_count, 0) !== Math.max(returnData.return_beams_count, 0),
    },
    {
      title: 'Pasy',
      note: `Przekazanie: ${Math.max(handoverData.straps_count, 0)} szt.`,
      result: `Zwrot: ${Math.max(returnData.return_straps_count, 0)} szt.`,
      changed: Math.max(handoverData.straps_count, 0) !== Math.max(returnData.return_straps_count, 0),
    },
  ];

  items.forEach((item, index) => {
    const itemX = x + 12 + index * (itemWidth + gap);
    const itemColor = item.changed ? COLORS.issue : COLORS.text;
    const detailColor = item.changed ? COLORS.issue : COLORS.muted;

    if (item.changed) {
      doc.font('Helvetica-Bold');
    } else if (resolvePdfFontPath()) {
      doc.font('main');
    } else {
      doc.font('Helvetica');
    }

    doc.fontSize(10).fillColor(itemColor).text(item.title, itemX, y + 14, { width: itemWidth });
    doc.fontSize(8).fillColor(detailColor).text(item.note, itemX, y + 34, { width: itemWidth });
    doc.fontSize(8).fillColor(detailColor).text(item.result, itemX, y + 50, { width: itemWidth });
  });

  if (resolvePdfFontPath()) {
    doc.font('main');
  } else {
    doc.font('Helvetica');
  }
  doc.fillColor(COLORS.text);
  return y + height;
}

function groupIssues(photos: HandoverPhoto[]): IssueGroup[] {
  const issues = photos.filter((photo) => photo.has_issue);
  const grouped = new Map<string, IssueGroup>();

  for (const photo of issues) {
    const position = photo.position_on_template;
    const entry = grouped.get(position) ?? {
      position,
      label: POSITION_LABELS[position] || position,
      descriptions: [],
      photos: [],
    };

    const issueDescription = photo.issue_description?.trim() || 'Zaznaczono uszkodzenie';
    if (!entry.descriptions.includes(issueDescription)) {
      entry.descriptions.push(issueDescription);
    }
    entry.photos.push(photo);
    grouped.set(position, entry);
  }

  return POSITION_ORDER
    .map((position) => grouped.get(position))
    .filter((item): item is IssueGroup => Boolean(item));
}

function normalizeIssueText(value?: string): string {
  return value?.trim() || '';
}

function drawTrailerOutline(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number): void {
  const px = (value: number) => x + value * width;
  const py = (value: number) => y + value * height;

  doc.save();
  doc.roundedRect(x, y, width, height, 10).fillAndStroke('white', COLORS.borderLight);
  doc.strokeColor(COLORS.border).lineWidth(2);

  doc.rect(px(0.353), py(0.056), width * 0.293, height * 0.042).stroke();
  doc.rect(px(0.453), py(0.019), width * 0.093, height * 0.023).stroke();
  doc.moveTo(px(0.5), py(0.042)).lineTo(px(0.5), py(0.056)).stroke();

  doc.rect(px(0.233), py(0.121), width * 0.533, height * 0.805).stroke();
  doc.rect(px(0.267), py(0.149), width * 0.467, height * 0.084).stroke();
  doc.rect(px(0.267), py(0.251), width * 0.467, height * 0.177).stroke();
  doc.rect(px(0.267), py(0.447), width * 0.467, height * 0.293).stroke();
  doc.rect(px(0.267), py(0.758), width * 0.467, height * 0.112).stroke();
  doc.lineWidth(1.4);
  doc.moveTo(px(0.32), py(0.121)).lineTo(px(0.32), py(0.926)).stroke();
  doc.moveTo(px(0.68), py(0.121)).lineTo(px(0.68), py(0.926)).stroke();

  [0.744, 0.814, 0.884].forEach((wheelY) => {
    doc.circle(px(0.193), py(wheelY), width * 0.033).stroke();
    doc.circle(px(0.807), py(wheelY), width * 0.033).stroke();
  });

  doc.fontSize(8).fillColor(COLORS.muted).text('PRZÓD', x, y - 16, { width, align: 'center' });
  doc.text('TYŁ', x, y + height + 4, { width, align: 'center' });
  doc.restore();
  doc.fillColor(COLORS.text);
}

function drawDamageSchema(
  doc: PDFKit.PDFDocument,
  y: number,
  issueGroups: IssueGroup[],
  options?: DamageSchemaOptions
): number {
  const sectionX = doc.page.margins.left;
  const sectionWidth = getContentWidth(doc);
  const gap = 16;
  const diagramWidth = 235;
  const listWidth = sectionWidth - diagramWidth - gap;
  const sectionHeight = 320;
  const diagramX = sectionX;
  const diagramHeight = 252;
  const listX = diagramX + diagramWidth + gap;

  y = ensurePageSpace(doc, y, sectionHeight);
  y = drawSectionHeading(
    doc,
    y,
    'Uszkodzenia naczepy',
    options?.subtitle ?? 'Schemat oparty o strefy oznaczone przy wydaniu'
  );

  drawTrailerOutline(doc, diagramX, y + 10, diagramWidth, diagramHeight);

  const issueIndexByPosition = new Map(issueGroups.map((group, index) => [group.position, index + 1]));

  POSITION_ORDER.forEach((position) => {
    const layout = ZONE_LAYOUTS[position];
    if (!layout) return;

    const zoneX = diagramX + layout.x * diagramWidth;
    const zoneY = y + 10 + layout.y * diagramHeight;
    const zoneWidth = layout.width * diagramWidth;
    const zoneHeight = layout.height * diagramHeight;
    const issueNumber = issueIndexByPosition.get(position);

    doc.save();
    doc.roundedRect(zoneX, zoneY, zoneWidth, zoneHeight, 4);
    if (issueNumber) {
      doc.fillAndStroke(COLORS.issueFill, COLORS.issue);
    } else {
      doc.fillAndStroke('white', COLORS.borderLight);
    }
    doc.restore();

    if (issueNumber) {
      const badgeRadius = 10;
      const badgeX = zoneX + zoneWidth / 2;
      const badgeY = zoneY + zoneHeight / 2;
      doc.save();
      doc.circle(badgeX, badgeY, badgeRadius).fill(COLORS.issue);
      doc.fontSize(9).fillColor('white').text(String(issueNumber), badgeX - 5, badgeY - 6, {
        width: 10,
        align: 'center',
      });
      doc.restore();
    }
  });

  doc.save();
  doc.roundedRect(listX, y + 10, listWidth, diagramHeight, 8).fillAndStroke('white', COLORS.borderLight);
  doc.restore();
  doc.fontSize(11).fillColor(COLORS.accent).text('Opis uszkodzeń', listX + 12, y + 22, { width: listWidth - 24 });

  let textY = y + 44;
  if (options?.sections?.length) {
    options.sections.forEach((section, sectionIndex) => {
      doc.fontSize(9).fillColor(COLORS.text).text(section.title, listX + 12, textY, {
        width: listWidth - 24,
      });
      textY = doc.y + 4;

      if (section.lines.length === 0) {
        doc.fontSize(8).fillColor(COLORS.muted).text('brak.', listX + 12, textY, {
          width: listWidth - 24,
        });
        textY = doc.y + 10;
        return;
      }

      section.lines.forEach((line) => {
        doc.fontSize(8.5).fillColor(COLORS.text).text(line, listX + 12, textY, {
          width: listWidth - 24,
        });
        textY = doc.y + 4;
      });

      if (sectionIndex < options.sections!.length - 1) {
        textY += 8;
      }
    });
  } else if (issueGroups.length === 0) {
    doc.fontSize(10).fillColor(COLORS.text).text(options?.emptyMessage ?? 'Brak oznaczonych uszkodzeń w chwili wydania.', listX + 12, textY, {
      width: listWidth - 24,
    });
  } else {
    issueGroups.forEach((group, index) => {
      const line = `${index + 1}. ${group.label}: ${group.descriptions.join('; ')}`;
      doc.fontSize(9).fillColor(COLORS.text).text(line, listX + 12, textY, {
        width: listWidth - 24,
      });
      textY = doc.y + 8;
    });
  }

  doc.fillColor(COLORS.text);
  return y + sectionHeight;
}

function drawSignatureSection(doc: PDFKit.PDFDocument, y: number): number {
  const x = doc.page.margins.left;
  const width = getContentWidth(doc);
  const gap = 20;
  const cardWidth = (width - gap) / 2;
  const cardHeight = 96;

  y = ensurePageSpace(doc, y, cardHeight + 30);
  y = drawSectionHeading(doc, y, 'Podpisy');

  const titles = ['Podpis wydającego', 'Podpis przyjmującego'];
  titles.forEach((title, index) => {
    const cardX = x + index * (cardWidth + gap);
    doc.save();
    doc.roundedRect(cardX, y, cardWidth, cardHeight, 8).fillAndStroke('white', COLORS.borderLight);
    doc.restore();
    doc.fontSize(10).fillColor(COLORS.text).text(title, cardX + 12, y + 12, { width: cardWidth - 24, align: 'center' });
    doc.moveTo(cardX + 18, y + 72).lineTo(cardX + cardWidth - 18, y + 72).strokeColor(COLORS.borderLight).lineWidth(1).stroke();
    doc.fontSize(8).fillColor(COLORS.muted).text('Miejsce na podpis odręczny', cardX + 12, y + 78, {
      width: cardWidth - 24,
      align: 'center',
    });
  });

  doc.fillColor(COLORS.text);
  return y + cardHeight;
}

function drawPhotoGallery(
  doc: PDFKit.PDFDocument,
  y: number,
  photos: HandoverPhoto[],
  options: PhotoGalleryOptions
): number {
  if (photos.length === 0) {
    return y;
  }

  const pageWidth = getContentWidth(doc);
  const gap = 16;
  const cardWidth = (pageWidth - gap) / 2;
  const cardHeight = 230;
  const headingWithFirstRowHeight = 52 + cardHeight + 12;

  y = ensurePageSpace(doc, y, headingWithFirstRowHeight);
  y = drawSectionHeading(doc, y, options.title, options.subtitle);

  photos.forEach((photo, index) => {
    if (index % 2 === 0) {
      y = ensurePageSpace(doc, y, cardHeight + 12);
    }

    const col = index % 2;
    const x = doc.page.margins.left + col * (cardWidth + gap);
    const cardY = y;

    doc.save();
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 8).fillAndStroke('white', COLORS.borderLight);
    doc.restore();

    const label = POSITION_LABELS[photo.position_on_template] || photo.position_on_template;
    doc.fontSize(10).fillColor(COLORS.accent).text(label, x + 12, cardY + 12, { width: cardWidth - 24 });
    const statusLine = options.statusLine(photo);
    doc.fontSize(8).fillColor(COLORS.muted).text(statusLine, x + 12, cardY + 28, {
      width: cardWidth - 24,
      height: 24,
    });

    drawImageOrPlaceholder(doc, path.join(UPLOADS_DIR, photo.file_path), {
      x: x + 12,
      y: cardY + 58,
      width: cardWidth - 24,
      height: 124,
      fit: true,
    });

    if (photo.description?.trim()) {
      doc.fontSize(8).fillColor(COLORS.text).text(`Opis zdjęcia: ${photo.description.trim()}`, x + 12, cardY + 190, {
        width: cardWidth - 24,
        height: 28,
      });
    }

    if (col === 1 || index === photos.length - 1) {
      y += cardHeight + 12;
    }
  });

  doc.fillColor(COLORS.text);
  return y;
}

export function generateHandoverPdf(
  data: HandoverData,
  issuerCompany: IssuerCompanyProfile
): PDFKit.PDFDocument {
  const doc = createPdfDocument();
  const contentWidth = getContentWidth(doc);
  const companyAddressLines = getCompanyAddressLines(data);
  const issueGroups = groupIssues(data.photos || []);
  const titleHeight = 86;

  let y = doc.page.margins.top;

  doc.save();
  doc.roundedRect(doc.page.margins.left, y, contentWidth, titleHeight, 12).fillAndStroke(COLORS.accentFill, COLORS.accent);
  doc.restore();

  doc.fontSize(22).fillColor(COLORS.text).text(`Protokół wydania #${data.id}`, doc.page.margins.left + 18, y + 18, {
    width: contentWidth - 160,
  });
  doc.fontSize(9).fillColor(COLORS.muted).text('Dokument przygotowany do wydruku i podpisu odręcznego', doc.page.margins.left + 18, y + 46, {
    width: contentWidth - 160,
  });
  y += titleHeight + 12;

  y = drawKeyValueGrid(doc, {
    x: doc.page.margins.left,
    y,
    width: contentWidth,
    title: 'Dane naczepy',
    items: [
      { label: 'Numer rejestracyjny', value: sanitizeText(data.registration_number) },
      { label: 'VIN / numer nadwozia', value: sanitizeText(data.vin) },
      { label: 'Rok produkcji', value: extractProductionYear(data.production_date || '') },
      { label: 'Typ naczepy', value: sanitizeText(data.trailer_type) },
    ],
  });

  y += 12;
  y = drawSectionHeading(doc, y, 'Strony');

  const gap = 16;
  const cardWidth = (contentWidth - gap) / 2;
  const issuerLines = [
    `${sanitizeText(issuerCompany.name)}`,
    `${sanitizeText(issuerCompany.address)}`,
    `NIP: ${sanitizeText(issuerCompany.tax_id)}`,
    `Telefon: ${sanitizeText(issuerCompany.phone)}`,
    `E-mail: ${sanitizeText(issuerCompany.email)}`,
  ];
  const clientLines = [`${sanitizeText(data.company_name)}`];
  if (companyAddressLines.length > 0) {
    clientLines.push(`${sanitizeText(companyAddressLines[0])}`);
    companyAddressLines.slice(1).forEach((line) => {
      clientLines.push(sanitizeText(line));
    });
  } else {
    clientLines.push('Adres: -');
  }
  clientLines.push(`NIP: ${sanitizeText(data.company_tax_id)}`);
  clientLines.push(`Telefon: ${sanitizeText(data.company_phone)}`);
  clientLines.push(`E-mail: ${sanitizeText(data.company_email)}`);
  clientLines.push(`Osoba kontaktowa: ${sanitizeText(data.company_contact)}`);

  doc.fontSize(9);
  const issuerMinHeight = 146;
  const clientMinHeight = 146;
  y = ensurePageSpace(doc, y, Math.max(issuerMinHeight, clientMinHeight));
  drawTextCard(doc, { x: doc.page.margins.left, y, width: cardWidth, title: 'Wydający', lines: issuerLines, minHeight: issuerMinHeight });
  const participantsBottom = drawTextCard(doc, {
    x: doc.page.margins.left + cardWidth + gap,
    y,
    width: cardWidth,
    title: 'Przyjmujący',
    lines: clientLines,
    minHeight: clientMinHeight,
  });
  y = participantsBottom + 12;

  y = ensurePageSpace(doc, y, 180);
  y = drawMetaRow(doc, y, data);
  y += 12;
  y = drawChecklistRow(doc, y, data);
  y += 12;

  if (data.equipment_notes?.trim()) {
    y = drawTextCard(doc, {
      x: doc.page.margins.left,
      y,
      width: contentWidth,
      title: 'Uwagi',
      lines: [data.equipment_notes.trim()],
      minHeight: 72,
    });
    y += 12;
  }

  doc.addPage();
  y = doc.page.margins.top;
  y = drawDamageSchema(doc, y, issueGroups);
  y += 12;
  y = drawSignatureSection(doc, y);

  if ((data.photos || []).length > 0) {
    doc.addPage();
    y = doc.page.margins.top;
  } else {
    y += 12;
  }

  drawPhotoGallery(doc, y, data.photos || [], {
    title: 'Zdjęcia z momentu wydania',
    subtitle: 'Pełna dokumentacja fotograficzna wykonana przy przekazaniu',
    statusLine: (photo) => (
      photo.has_issue
        ? `Uszkodzenie: ${photo.issue_description || 'Zaznaczono uszkodzenie'}`
        : 'Stan zdjęcia: bez oznaczonego uszkodzenia'
    ),
  });

  addPageNumbers(doc);
  return doc;
}

export function generateReturnPdf(
  handoverData: HandoverData,
  returnData: ReturnData,
  issuerCompany: IssuerCompanyProfile
): PDFKit.PDFDocument {
  const doc = createPdfDocument();
  const contentWidth = getContentWidth(doc);
  const companyAddressLines = getCompanyAddressLines(handoverData);
  const currentIssueGroups = groupIssues(returnData.photos || []);
  const titleHeight = 86;

  let y = doc.page.margins.top;

  doc.save();
  doc.roundedRect(doc.page.margins.left, y, contentWidth, titleHeight, 12).fillAndStroke(COLORS.accentFill, COLORS.accent);
  doc.restore();

  doc.fontSize(22).fillColor(COLORS.text).text(`Protokół zwrotu #${returnData.id}`, doc.page.margins.left + 18, y + 18, {
    width: contentWidth - 160,
  });
  doc.fontSize(9).fillColor(COLORS.muted).text('Dokument przygotowany do wydruku i potwierdzenia zwrotu', doc.page.margins.left + 18, y + 46, {
    width: contentWidth - 160,
  });
  doc.fontSize(9).fillColor(COLORS.text).text(`Nr przekazania: ${handoverData.id}`, doc.page.margins.left + contentWidth - 138, y + 22, {
    width: 120,
    align: 'right',
  });
  doc.text(`Data zwrotu: ${sanitizeText(returnData.return_date)}`, doc.page.margins.left + contentWidth - 138, y + 38, {
    width: 120,
    align: 'right',
  });

  y += titleHeight + 12;

  y = drawKeyValueGrid(doc, {
    x: doc.page.margins.left,
    y,
    width: contentWidth,
    title: 'Dane naczepy',
    items: [
      { label: 'Numer rejestracyjny', value: sanitizeText(handoverData.registration_number) },
      { label: 'VIN', value: sanitizeText(handoverData.vin) },
      { label: 'Rok produkcji', value: extractProductionYear(handoverData.production_date || '') },
      { label: 'Typ naczepy', value: sanitizeText(handoverData.trailer_type) },
    ],
  });

  y += 12;
  y = drawSectionHeading(doc, y, 'Strony');

  const gap = 16;
  const cardWidth = (contentWidth - gap) / 2;
  const issuerLines = [
    `${sanitizeText(issuerCompany.name)}`,
    `${sanitizeText(issuerCompany.address)}`,
    `NIP: ${sanitizeText(issuerCompany.tax_id)}`,
    `Telefon: ${sanitizeText(issuerCompany.phone)}`,
    `E-mail: ${sanitizeText(issuerCompany.email)}`,
  ];
  const clientLines = [`${sanitizeText(handoverData.company_name)}`];
  if (companyAddressLines.length > 0) {
    clientLines.push(`${sanitizeText(companyAddressLines[0])}`);
    companyAddressLines.slice(1).forEach((line) => {
      clientLines.push(sanitizeText(line));
    });
  } else {
    clientLines.push('-');
  }
  clientLines.push(`NIP: ${sanitizeText(handoverData.company_tax_id)}`);
  clientLines.push(`Telefon: ${sanitizeText(handoverData.company_phone)}`);
  clientLines.push(`E-mail: ${sanitizeText(handoverData.company_email)}`);
  clientLines.push(`Osoba kontaktowa: ${sanitizeText(handoverData.company_contact)}`);

  doc.fontSize(9);
  const issuerMinHeight = 146;
  const clientMinHeight = 146;
  y = ensurePageSpace(doc, y, Math.max(issuerMinHeight, clientMinHeight));
  drawTextCard(doc, { x: doc.page.margins.left, y, width: cardWidth, title: 'Przyjmujący', lines: issuerLines, minHeight: issuerMinHeight });
  const participantsBottom = drawTextCard(doc, {
    x: doc.page.margins.left + cardWidth + gap,
    y,
    width: cardWidth,
    title: 'Zwracający',
    lines: clientLines,
    minHeight: clientMinHeight,
  });
  y = participantsBottom + 12;

  y = ensurePageSpace(doc, y, 180);
  y = drawReturnMetaRow(doc, y, returnData, handoverData.id);
  y += 12;
  y = drawReturnEquipmentComparisonRow(doc, y, handoverData, returnData);
  y += 12;

  if (returnData.notes?.trim()) {
    y = drawTextCard(doc, {
      x: doc.page.margins.left,
      y,
      width: contentWidth,
      title: 'Uwagi do zwrotu',
      lines: [returnData.notes.trim()],
      minHeight: 72,
    });
    y += 12;
  }

  const handoverIssuesByPos = new Map<string, string>();
  for (const p of handoverData.photos) {
    if (p.has_issue) {
      handoverIssuesByPos.set(p.position_on_template, p.issue_description);
    }
  }

  const returnIssuePhotos = returnData.photos.filter((p) => p.has_issue);
  const newIssues = returnIssuePhotos.filter((p) => normalizeIssueText(p.new_issue_description));
  const continuedIssues = returnIssuePhotos.filter((p) => handoverIssuesByPos.has(p.position_on_template));

  doc.addPage();
  y = doc.page.margins.top;
  y = drawDamageSchema(doc, y, currentIssueGroups, {
    subtitle: 'Schemat oparty o strefy oznaczone przy zwrocie',
    sections: [
      {
        title: 'Istniejące uszkodzenia (z przekazania)',
        lines: continuedIssues.map((photo) => {
          const label = POSITION_LABELS[photo.position_on_template] || photo.position_on_template;
          const originalIssue = handoverIssuesByPos.get(photo.position_on_template) || photo.issue_description;
          return `• ${label}: ${originalIssue}`;
        }),
      },
      {
        title: 'Nowe uszkodzenia (w momencie zwrotu)',
        lines: newIssues.map((photo) => {
          const label = POSITION_LABELS[photo.position_on_template] || photo.position_on_template;
          return `• ${label}: ${normalizeIssueText(photo.new_issue_description)}`;
        }),
      },
    ],
  });
  y += 12;
  y = drawSignatureSection(doc, y);

  const allPositions = new Set([
    ...handoverData.photos.map((p) => p.position_on_template),
    ...returnData.photos.map((p) => p.position_on_template),
  ]);

  if (allPositions.size > 0) {
    doc.addPage();
    doc.fontSize(14).fillColor(COLORS.accent).text('Porównanie fotograficzne', doc.page.margins.left, doc.page.margins.top, {
      width: contentWidth,
    });
    doc.fontSize(8).fillColor(COLORS.muted).text('Zestawienie zdjęć z przekazania i zwrotu dla tych samych stref', doc.page.margins.left, doc.y + 2, {
      width: contentWidth,
    });
    doc.fillColor(COLORS.text);
    doc.moveDown(0.8);
  }

  for (const position of allPositions) {
    const label = POSITION_LABELS[position] || position;
    const handoverPhoto = handoverData.photos.find((p) => p.position_on_template === position);
    const returnPhoto = returnData.photos.find((p) => p.position_on_template === position);

    if (doc.y > 500) doc.addPage();

    doc.fontSize(11).text(`Pozycja: ${label}`, { underline: true });
    doc.moveDown(0.3);

    const leftX = 40;
    const rightX = 300;
    const imgW = 220;
    const imgH = 160;
    const startY = doc.y;

    doc.fontSize(8).text('PRZEKAZANIE:', leftX, startY);
    if (handoverPhoto) {
      const fp = path.join(UPLOADS_DIR, handoverPhoto.file_path);
      drawImageOrPlaceholder(doc, fp, { x: leftX, y: startY + 12, width: imgW, height: imgH });
      if (handoverPhoto.has_issue) {
        doc.fontSize(8).fillColor('#b45309')
          .text(`USZKODZENIE: ${handoverPhoto.issue_description}`, leftX, startY + imgH + 14, { width: imgW });
        doc.fillColor('black');
      } else if (handoverPhoto.description) {
        doc.fontSize(7).text(handoverPhoto.description, leftX, startY + imgH + 14, { width: imgW });
      }
    } else {
      doc.fontSize(8).text('Brak zdjęcia', leftX, startY + 12);
    }

    doc.fontSize(8).text('ZWROT:', rightX, startY);
    if (returnPhoto) {
      const fp = path.join(UPLOADS_DIR, returnPhoto.file_path);
      drawImageOrPlaceholder(doc, fp, { x: rightX, y: startY + 12, width: imgW, height: imgH });
      if (returnPhoto.has_issue) {
        const hasOriginalIssue = handoverIssuesByPos.has(returnPhoto.position_on_template);
        const hasNewIssue = Boolean(normalizeIssueText(returnPhoto.new_issue_description));

        if (hasOriginalIssue && !hasNewIssue) {
          doc.fontSize(8).fillColor(COLORS.muted)
            .text('Brak nowych uszkodzeń', rightX, startY + imgH + 14, { width: imgW });
        } else {
          const issueLabel = hasOriginalIssue ? 'USZKODZENIE' : 'NOWE USZKODZENIE';
          doc.fontSize(8).fillColor('red')
            .text(`${issueLabel}: ${returnPhoto.issue_description}`, rightX, startY + imgH + 14, { width: imgW });
        }
        doc.fillColor('black');
      } else if (returnPhoto.description) {
        doc.fontSize(7).text(returnPhoto.description, rightX, startY + imgH + 14, { width: imgW });
      }
    } else {
      doc.fontSize(8).text('Brak zdjęcia', rightX, startY + 12);
    }

    doc.y = startY + imgH + 40;
    doc.moveDown(0.5);
  }

  addPageNumbers(doc);
  return doc;
}
