export interface BusinessListItem {
  id: number;
  name: string;
  email: string;
  city: string | null;
  province: string | null;
  autonomous: boolean;
  setupComplete: boolean;
  banned: boolean;
  createdAt: string;
  categories: string[];
  referralCode: string | null;
  referredCount: number;
}

export interface BusinessDetail {
  id: number;
  name: string;
  email: string;
  phone: string;
  cif: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  autonomous: boolean;
  setupComplete: boolean;
  banned: boolean;
  createdAt: string;
  categories: string[];
  referralCode: string | null;
  referredCount: number;
}
