export type Reputation = 'GREEN' | 'ORANGE' | 'RED';
export type SanctionType = 'SUSPENSION' | 'BAN';

export interface CustomerListItem {
  id: number;
  name: string;
  email: string;
  username: string;
  city: string | null;
  province: string | null;
  reputation: Reputation;
  noShowCount: number;
}

export interface BusinessInteraction {
  businessId: number;
  businessName: string;
  visits: number;
  servicesChosen: string[];
  vetoed: boolean;
  vetoReason: string | null;
}

export interface Sanction {
  id: number;
  type: SanctionType;
  reason: string | null;
  createdAt: string;
  endsAt: string | null;
  liftedAt: string | null;
  active: boolean;
  bannedIps: string[];
  createdByName: string;
  liftedByName: string | null;
}

export interface Charge {
  id: number;
  kind: 'CANCELLATION_FEE' | 'RESCHEDULE_FEE' | 'NO_SHOW_FEE';
  status: 'PENDING' | 'SUCCEEDED' | 'REQUIRES_ACTION' | 'FAILED' | 'REFUNDED';
  amountCents: number;
  currency: string;
  description: string | null;
  businessId: number | null;
  businessName: string | null;
  bookingId: number | null;
  failureReason: string | null;
  createdAt: string;
}

export interface PaymentMethod {
  id: number;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export interface CustomerDetail {
  id: number;
  name: string;
  email: string;
  username: string;
  phone: string;
  profileImageUrl: string | null;
  city: string | null;
  province: string | null;
  authProvider: string;
  emailVerified: boolean;
  banned: boolean;
  deleted: boolean;
  createdAt: string;
  reputation: Reputation;
  noShowCount: number;
  totalBookings: number;
  interactions: BusinessInteraction[];
  sanctions: Sanction[];
  charges: Charge[];
  paymentMethods: PaymentMethod[];
}

export interface SanctionRequest {
  type: SanctionType;
  reason: string | null;
  endsAt: string | null;
  extraIps: string[] | null;
}
