export type PartnerId = 'partner-1' | 'partner-2';

export interface SmileRecord {
  date: string; // ISO date string YYYY-MM-DD
  count: number;
}

export interface PartnerData {
  id: PartnerId;
  name: string;
  isVisible: boolean;
  smileHistory: Record<string, number>; // date -> count
}

export interface AppState {
  partners: Record<PartnerId, PartnerData>;
}