export interface BusinessSubscription {
  id: number;
  planCode: string;
  planName: string;
  status: string;
  source: string;
  startAt: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface Plan {
  code: string;
  name: string;
  description: string | null;
  price: number;
  priceCents: number;
  billingInterval: string;
  durationDays: number | null;
  trialDays: number | null;
  selectable: boolean;
  displayOrder: number;
  addon: boolean;
  active: boolean;
}
