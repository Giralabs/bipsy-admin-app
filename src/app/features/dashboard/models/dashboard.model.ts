export interface CustomerStats {
  total: number;
  newLast30Days: number;
  referred: number;
}

export interface BusinessStats {
  total: number;
  banned: number;
  setupIncomplete: number;
  newLast30Days: number;
  withReferralCode: number;
}

export interface BookingStats {
  total: number;
  last30Days: number;
  byStatus: Record<string, number>;
}

export interface TicketStats {
  total: number;
  byStatus: Record<string, number>;
}

export interface SubscriptionStats {
  active: number;
  estimatedMrr: number;
}

export interface DashboardStats {
  customers: CustomerStats;
  businesses: BusinessStats;
  bookings: BookingStats;
  tickets: TicketStats;
  subscriptions: SubscriptionStats;
}
