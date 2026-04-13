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
  phone: string;
  email: string;
  contact_person: string;
}

export type TrailerType = 'Kurtyna' | 'Box' | 'Izoterma' | 'Chłodnia';

export interface Trailer {
  id: number;
  registration_number: string;
  vin: string;
  brand: string;
  type: TrailerType;
}

export type HandoverStatus = 'active' | 'returned';

export interface Handover {
  id: number;
  company_id: number;
  trailer_id: number;
  created_by: number;
  handover_date: string;
  handover_time: string;
  equipment_notes: string;
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
  created_at: string;
}

export interface Return {
  id: number;
  handover_id: number;
  created_by: number;
  return_date: string;
  return_time: string;
  notes: string;
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
