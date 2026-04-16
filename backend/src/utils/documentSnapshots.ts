import Database from 'better-sqlite3';

export interface CompanySnapshot {
  company_name: string;
  company_address_line1: string;
  company_address_line2: string;
  company_postal_code: string;
  company_tax_id: string;
  company_phone: string;
  company_email: string;
  company_contact: string;
}

export interface IssuerSnapshot {
  issuer_name: string;
  issuer_address: string;
  issuer_tax_id: string;
  issuer_phone: string;
  issuer_email: string;
}

export interface CompanyCatalogRecord {
  id: number;
  name: string;
  address: string;
  address_line1: string;
  address_line2: string;
  postal_code: string;
  tax_id: string;
  phone: string;
  email: string;
  contact_person: string;
}

export function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

export function buildLegacyCompanyAddress(company: CompanySnapshot): string {
  return [
    company.company_address_line1,
    company.company_address_line2,
    company.company_postal_code,
  ].filter(Boolean).join(', ');
}

export function getCompanySnapshotFromBody(body: Record<string, unknown>): CompanySnapshot {
  return {
    company_name: normalizeText(body.company_name),
    company_address_line1: normalizeText(body.company_address_line1),
    company_address_line2: normalizeText(body.company_address_line2),
    company_postal_code: normalizeText(body.company_postal_code),
    company_tax_id: normalizeText(body.company_tax_id),
    company_phone: normalizeText(body.company_phone),
    company_email: normalizeText(body.company_email),
    company_contact: normalizeText(body.company_contact),
  };
}

export function getCompanySnapshotFromRecord(record: Partial<CompanyCatalogRecord>): CompanySnapshot {
  return {
    company_name: normalizeText(record.name),
    company_address_line1: normalizeText(record.address_line1 || record.address),
    company_address_line2: normalizeText(record.address_line2),
    company_postal_code: normalizeText(record.postal_code),
    company_tax_id: normalizeText(record.tax_id),
    company_phone: normalizeText(record.phone),
    company_email: normalizeText(record.email),
    company_contact: normalizeText(record.contact_person),
  };
}

export function getIssuerSnapshot(db: Database.Database): IssuerSnapshot {
  const profile = db.prepare(
    'SELECT name, address, tax_id, phone, email FROM issuer_company_profile WHERE id = 1'
  ).get() as
    | { name: string; address: string; tax_id: string; phone: string; email: string }
    | undefined;

  return {
    issuer_name: normalizeText(profile?.name),
    issuer_address: normalizeText(profile?.address),
    issuer_tax_id: normalizeText(profile?.tax_id),
    issuer_phone: normalizeText(profile?.phone),
    issuer_email: normalizeText(profile?.email),
  };
}

export function getPreparedByName(db: Database.Database, userId: number): string {
  const user = db.prepare('SELECT full_name FROM users WHERE id = ?').get(userId) as
    | { full_name: string }
    | undefined;

  return normalizeText(user?.full_name);
}

export function getCompanyCatalogRecord(
  db: Database.Database,
  companyId: number
): CompanyCatalogRecord | undefined {
  return db.prepare(
    `SELECT id, name, address, address_line1, address_line2, postal_code, tax_id, phone, email, contact_person
     FROM companies
     WHERE id = ?`
  ).get(companyId) as CompanyCatalogRecord | undefined;
}

export function upsertCompanyCatalogRecord(
  db: Database.Database,
  company: CompanySnapshot,
  existingCompanyId?: number | null
): number {
  const legacyAddress = buildLegacyCompanyAddress(company);

  if (existingCompanyId) {
    db.prepare(
      `UPDATE companies
       SET name = ?,
           address = ?,
           address_line1 = ?,
           address_line2 = ?,
           postal_code = ?,
           tax_id = ?,
           phone = ?,
           email = ?,
           contact_person = ?
       WHERE id = ?`
    ).run(
      company.company_name,
      legacyAddress,
      company.company_address_line1,
      company.company_address_line2,
      company.company_postal_code,
      company.company_tax_id,
      company.company_phone,
      company.company_email,
      company.company_contact,
      existingCompanyId
    );

    return existingCompanyId;
  }

  const result = db.prepare(
    `INSERT INTO companies (
      name, address, address_line1, address_line2, postal_code, tax_id, phone, email, contact_person
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    company.company_name,
    legacyAddress,
    company.company_address_line1,
    company.company_address_line2,
    company.company_postal_code,
    company.company_tax_id,
    company.company_phone,
    company.company_email,
    company.company_contact
  );

  return Number(result.lastInsertRowid);
}
