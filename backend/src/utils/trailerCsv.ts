import { VALID_TRAILER_TYPES } from '../database/schema';

const TYPE_NORMALIZE: Record<string, string> = {
  'BOX': 'Box',
  'Box': 'Box',
  'KURTYNA': 'Kurtyna',
  'Kurtyna': 'Kurtyna',
  'KURTYNA MEGA': 'Kurtyna MEGA',
  'Kurtyna MEGA': 'Kurtyna MEGA',
  'CHŁODNIA': 'Chłodnia',
  'CHLODNIA': 'Chłodnia',
  'Chłodnia': 'Chłodnia',
  'Chlodnia': 'Chłodnia',
  'IZOTERMA': 'Izoterma',
  'Izoterma': 'Izoterma',
  'TANDEM': 'TANDEM',
  'Tandem': 'TANDEM',
  'DOUBLE DECK': 'Double Deck',
  'Double Deck': 'Double Deck',
};

export interface ParsedTrailerRow {
  registration_number: string;
  vin: string;
  brand: string;
  type: string;
  production_date: string;
}

export interface ParseError {
  line: number;
  raw: string;
  reason: string;
}

export interface ParsedCsv {
  rows: ParsedTrailerRow[];
  errors: ParseError[];
}

const HEADER_KEYWORDS = ['numer', 'rejestracyj', 'marka', 'rocznik', 'production'];

function isHeaderLine(line: string): boolean {
  // Real header rows contain at least one Polish/English column-name keyword
  // that would never appear in data fields (registration numbers, VINs, types).
  const lower = line.toLowerCase();
  return HEADER_KEYWORDS.some((kw) => lower.includes(kw));
}

function splitCsvLine(line: string): string[] {
  // Simple CSV splitter that supports double-quoted fields with commas.
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((s) => s.trim());
}

export function parseTrailersCsv(csv: string): ParsedCsv {
  // Strip BOM if present.
  if (csv.charCodeAt(0) === 0xFEFF) {
    csv = csv.slice(1);
  }

  const rawLines = csv.split(/\r?\n/);
  const rows: ParsedTrailerRow[] = [];
  const errors: ParseError[] = [];

  rawLines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line) return;
    if (isHeaderLine(line)) return;

    const parts = splitCsvLine(line);
    if (parts.length < 5) {
      errors.push({
        line: lineNumber,
        raw: line,
        reason: `Expected 5 columns, got ${parts.length}`,
      });
      return;
    }

    const regNum = parts[0];
    const vin = parts[1];
    const productionDate = parts[2] || '';
    const brand = parts[3];
    const rawType = parts.slice(4).join(',').trim();
    const normalizedType = TYPE_NORMALIZE[rawType] || TYPE_NORMALIZE[rawType.toUpperCase()];

    if (!regNum) {
      errors.push({ line: lineNumber, raw: line, reason: 'Missing registration number' });
      return;
    }
    if (!normalizedType || !VALID_TRAILER_TYPES.includes(normalizedType as any)) {
      errors.push({
        line: lineNumber,
        raw: line,
        reason: `Unknown trailer type: "${rawType}"`,
      });
      return;
    }

    rows.push({
      registration_number: regNum,
      vin,
      brand,
      type: normalizedType,
      production_date: productionDate,
    });
  });

  return { rows, errors };
}
