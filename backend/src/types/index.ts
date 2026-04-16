export interface User {
  id: number;
  username: string;
  password_hash: string;
  full_name: string;
  role: 'admin' | 'user';
  active: number;
  created_at: string;
}

export interface Company {
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

export interface IssuerCompanyProfile {
  name: string;
  address: string;
  tax_id: string;
  phone: string;
  email: string;
}

export type TrailerType = 'Kurtyna' | 'Box' | 'Izoterma' | 'Chłodnia' | 'Kurtyna MEGA' | 'TANDEM' | 'Double Deck';

export interface Trailer {
  id: number;
  registration_number: string;
  vin: string;
  brand: string;
  production_date: string;
  type: TrailerType;
}

export type HandoverStatus = 'active' | 'returned';

export interface Handover {
  id: number;
  company_id: number | null;
  trailer_id: number;
  created_by: number;
  company_name: string;
  company_address_line1: string;
  company_address_line2: string;
  company_postal_code: string;
  company_tax_id: string;
  company_phone: string;
  company_email: string;
  company_contact: string;
  issuer_name: string;
  issuer_address: string;
  issuer_tax_id: string;
  issuer_phone: string;
  issuer_email: string;
  prepared_by_name: string;
  handover_date: string;
  handover_time: string;
  equipment_notes: string;
  has_documents: number;
  beams_count: number;
  straps_count: number;
  status: HandoverStatus;
  created_at: string;
}

export type PhotoPosition =
  | 'front'
  | 'rear'
  | 'left-side'
  | 'right-side'
  | 'top'
  | 'interior'
  | 'front-left'
  | 'front-right'
  | 'rear-left'
  | 'rear-right';

export interface HandoverPhoto {
  id: number;
  handover_id: number;
  file_path: string;
  position_on_template: PhotoPosition;
  description: string;
  has_issue: number;
  issue_description: string;
  created_at: string;
}

export interface Return {
  id: number;
  handover_id: number;
  created_by: number;
  company_name: string;
  company_address_line1: string;
  company_address_line2: string;
  company_postal_code: string;
  company_tax_id: string;
  company_phone: string;
  company_email: string;
  company_contact: string;
  issuer_name: string;
  issuer_address: string;
  issuer_tax_id: string;
  issuer_phone: string;
  issuer_email: string;
  prepared_by_name: string;
  return_date: string;
  return_time: string;
  notes: string;
  return_has_documents: number;
  return_beams_count: number;
  return_straps_count: number;
  created_at: string;
}

export interface ReturnPhoto {
  id: number;
  return_id: number;
  file_path: string;
  position_on_template: PhotoPosition;
  description: string;
  has_issue: number;
  issue_description: string;
  new_issue_description: string;
  created_at: string;
}

export interface JwtPayload {
  userId: number;
  username: string;
  role: 'admin' | 'user';
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
