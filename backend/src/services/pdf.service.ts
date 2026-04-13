import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
const FONT_CANDIDATES = [
  path.join(__dirname, '..', '..', 'assets', 'fonts', 'DejaVuSans.ttf'),
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/local/share/fonts/DejaVuSans.ttf',
];

const POSITION_LABELS: Record<string, string> = {
  'front': 'Przód',
  'rear': 'Tył',
  'left-side': 'Lewa strona',
  'right-side': 'Prawa strona',
  'top': 'Góra',
  'interior': 'Wnętrze',
  'front-left': 'Przód-lewo',
  'front-right': 'Przód-prawo',
  'rear-left': 'Tył-lewo',
  'rear-right': 'Tył-prawo',
};

interface HandoverData {
  id: number;
  handover_date: string;
  handover_time: string;
  equipment_notes: string;
  status: string;
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_contact: string;
  registration_number: string;
  vin: string;
  brand: string;
  trailer_type: string;
  production_date: string;
  created_by_name: string;
  photos: Array<{
    file_path: string;
    position_on_template: string;
    description: string;
  }>;
}

interface ReturnData {
  id: number;
  return_date: string;
  return_time: string;
  notes: string;
  created_by_name: string;
  photos: Array<{
    file_path: string;
    position_on_template: string;
    description: string;
    has_issue: number;
    issue_description: string;
  }>;
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
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const fontPath = resolvePdfFontPath();

  if (fontPath) {
    doc.registerFont('main', fontPath);
    doc.font('main');
  }

  return doc;
}

function drawImageOrPlaceholder(
  doc: PDFKit.PDFDocument,
  filePath: string,
  options: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  }
): void {
  const { width, height, x, y } = options;
  const targetX = x ?? doc.x;
  const targetY = y ?? doc.y;

  const drawPlaceholder = (message: string) => {
    doc.save();
    doc.rect(targetX, targetY, width, height).strokeColor('#9ca3af').lineWidth(1).stroke();
    doc.fontSize(8).fillColor('#6b7280').text(message, targetX + 8, targetY + height / 2 - 6, {
      width: width - 16,
      align: 'center',
    });
    doc.fillColor('black');
    doc.restore();
  };

  if (!fs.existsSync(filePath)) {
    drawPlaceholder('Brak pliku zdjęcia');
    return;
  }

  try {
    if (typeof x === 'number' && typeof y === 'number') {
      doc.image(filePath, x, y, { width, height });
    } else {
      doc.image(filePath, { width, height });
    }
  } catch {
    drawPlaceholder('Nie można załadować zdjęcia');
  }
}

export function generateHandoverPdf(data: HandoverData): PDFKit.PDFDocument {
  const doc = createPdfDocument();

  doc.fontSize(20).text('Protokół przekazania naczepy', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Nr: ${data.id}`, { align: 'center' });
  doc.moveDown(1);

  doc.fontSize(12).text('Dane przekazania', { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10);
  doc.text(`Data: ${data.handover_date}`);
  doc.text(`Godzina: ${data.handover_time}`);
  doc.text(`Sporządził: ${data.created_by_name}`);
  doc.text(`Status: ${data.status === 'active' ? 'Aktywne' : 'Zwrócone'}`);
  doc.moveDown(0.8);

  doc.fontSize(12).text('Firma', { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10);
  doc.text(`Nazwa: ${data.company_name}`);
  doc.text(`Adres: ${data.company_address}`);
  doc.text(`Telefon: ${data.company_phone}`);
  doc.text(`E-mail: ${data.company_email}`);
  doc.text(`Osoba kontaktowa: ${data.company_contact}`);
  doc.moveDown(0.8);

  doc.fontSize(12).text('Naczepa', { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10);
  doc.text(`Nr rejestracyjny: ${data.registration_number}`);
  doc.text(`VIN: ${data.vin}`);
  doc.text(`Marka: ${data.brand}`);
  doc.text(`Typ: ${data.trailer_type}`);
  if (data.production_date) {
    doc.text(`Data produkcji: ${data.production_date}`);
  }
  doc.moveDown(0.8);

  if (data.equipment_notes) {
    doc.fontSize(12).text('Wyposażenie', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).text(data.equipment_notes);
    doc.moveDown(0.8);
  }

  if (data.photos.length > 0) {
    doc.addPage();
    doc.fontSize(12).text('Dokumentacja fotograficzna', { underline: true });
    doc.moveDown(0.5);

    for (const photo of data.photos) {
      const label = POSITION_LABELS[photo.position_on_template] || photo.position_on_template;
      const filePath = path.join(UPLOADS_DIR, photo.file_path);

      if (doc.y > 600) doc.addPage();

      doc.fontSize(10).text(`Pozycja: ${label}`, { continued: false });
      if (photo.description) {
        doc.text(`Opis: ${photo.description}`);
      }

      drawImageOrPlaceholder(doc, filePath, { width: 250, height: 180 });
      doc.moveDown(0.8);
    }
  }

  return doc;
}

export function generateReturnPdf(handoverData: HandoverData, returnData: ReturnData): PDFKit.PDFDocument {
  const doc = createPdfDocument();

  doc.fontSize(20).text('Protokół zwrotu naczepy', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Nr przekazania: ${handoverData.id} | Nr zwrotu: ${returnData.id}`, { align: 'center' });
  doc.moveDown(1);

  doc.fontSize(12).text('Dane zwrotu', { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10);
  doc.text(`Data zwrotu: ${returnData.return_date}`);
  doc.text(`Godzina zwrotu: ${returnData.return_time}`);
  doc.text(`Sporządził: ${returnData.created_by_name}`);
  doc.moveDown(0.8);

  doc.fontSize(12).text('Dane przekazania', { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10);
  doc.text(`Data przekazania: ${handoverData.handover_date}`);
  doc.text(`Firma: ${handoverData.company_name}`);
  doc.text(`Naczepa: ${handoverData.registration_number} (${handoverData.trailer_type})`);
  doc.moveDown(0.8);

  if (returnData.notes) {
    doc.fontSize(12).text('Uwagi do zwrotu', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).text(returnData.notes);
    doc.moveDown(0.8);
  }

  const issuePhotos = returnData.photos.filter(p => p.has_issue);
  if (issuePhotos.length > 0) {
    doc.fontSize(12).fillColor('red').text('STWIERDZONE NIEPRAWIDŁOWOŚCI', { underline: true });
    doc.fillColor('black').moveDown(0.3);
    doc.fontSize(10);
    for (const photo of issuePhotos) {
      const label = POSITION_LABELS[photo.position_on_template] || photo.position_on_template;
      doc.text(`• ${label}: ${photo.issue_description}`);
    }
    doc.moveDown(0.8);
  } else {
    doc.fontSize(12).text('Brak stwierdzonych nieprawidłowości.', { align: 'center' });
    doc.moveDown(0.8);
  }

  doc.addPage();
  doc.fontSize(12).text('Porównanie fotograficzne', { underline: true });
  doc.moveDown(0.5);

  const allPositions = new Set([
    ...handoverData.photos.map(p => p.position_on_template),
    ...returnData.photos.map(p => p.position_on_template),
  ]);

  for (const position of allPositions) {
    const label = POSITION_LABELS[position] || position;
    const handoverPhoto = handoverData.photos.find(p => p.position_on_template === position);
    const returnPhoto = returnData.photos.find(p => p.position_on_template === position);

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
      if (handoverPhoto.description) {
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
        doc.fontSize(8).fillColor('red')
          .text(`NIEPRAWIDŁOWOŚĆ: ${returnPhoto.issue_description}`, rightX, startY + imgH + 14, { width: imgW });
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

  return doc;
}
