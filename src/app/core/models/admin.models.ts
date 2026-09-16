/**
 * Contratos del backend que usa el panel. Cada interfaz refleja un record de
 * com.gipsi.dto.* (el nombre del record va en el comentario) para poder
 * seguirle la pista cuando cambie.
 */

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

// === DASHBOARD (AdminDashboardDtos) ========================================

export interface DashboardStats {
  customers: { total: number; newLast30Days: number; referred: number };
  businesses: { total: number; banned: number; setupIncomplete: number; newLast30Days: number; withReferralCode: number };
  bookings: { total: number; last30Days: number; byStatus: Record<string, number> };
  tickets: { total: number; byStatus: Record<string, number> };
  subscriptions: { active: number; estimatedMrr: number };
}

// === CLIENTES (AdminCustomerDtos) ==========================================

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

/** PaymentDtos.PaymentResponse */
export interface Charge {
  id: number;
  kind: string;
  status: string;
  amountCents: number;
  refundedCents: number;
  currency: string;
  description: string | null;
  businessId: number | null;
  businessName: string | null;
  bookingId: number | null;
  failureReason: string | null;
  createdAt: string;
}

/** AdminOnboardingDtos: negocios nuevos a los que llamar. */
export type OnboardingStage = 'WELCOME' | 'TRIAL' | 'PAYING' | 'FREE' | 'PAST_DUE' | 'NO_PLAN';
export type CallOutcome = 'CALLED' | 'NO_ANSWER' | 'CALL_BACK' | 'WILL_PAY' | 'NOT_INTERESTED' | 'NOTE';

export interface OnboardingItem {
  businessId: number;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  category: string | null;
  createdAt: string;
  setupComplete: boolean;
  accessState: string;
  stage: OnboardingStage;
  planName: string | null;
  priceCents: number;
  endsAt: string | null;
  daysLeft: number | null;
  contactCount: number;
  lastOutcome: CallOutcome | null;
  lastNote: string | null;
  lastContactBy: string | null;
  lastContactAt: string | null;
  nextCallAt: string | null;
  due: boolean;
}

export interface OnboardingResponse {
  summary: {
    total: number;
    welcome: number;
    trial: number;
    endingSoon: number;
    noPlan: number;
    payingNew: number;
    due: number;
    contactedThisWeek: number;
  };
  items: OnboardingItem[];
}

export interface OnboardingContact {
  id: number;
  outcome: CallOutcome;
  note: string | null;
  nextCallAt: string | null;
  adminName: string;
  createdAt: string;
}

/** AdminPaymentDtos.AdminPaymentResponse: un cobro visto desde el registro global. */
export interface AdminPayment {
  id: number;
  kind: string;
  status: string;
  amountCents: number;
  refundedCents: number;
  refundableCents: number;
  applicationFeeCents: number | null;
  currency: string;
  description: string | null;
  failureReason: string | null;
  customerId: number;
  customerName: string;
  customerEmail: string | null;
  businessId: number | null;
  businessName: string | null;
  bookingId: number | null;
  bookingStart: string | null;
  serviceName: string | null;
  stripePaymentIntentId: string | null;
  stripeAccountId: string | null;
  manual: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RefundMethod = 'STRIPE' | 'MANUAL';

export interface AdminRefund {
  id: number;
  paymentId: number;
  amountCents: number;
  status: string;
  method: RefundMethod;
  reason: string | null;
  failureReason: string | null;
  stripeRefundId: string | null;
  createdByName: string | null;
  customerName: string;
  businessName: string | null;
  createdAt: string;
}

export interface AdminPaymentDetail {
  payment: AdminPayment;
  refunds: AdminRefund[];
  card: { brand: string; last4: string; expMonth: number | null; expYear: number | null; isDefault: boolean } | null;
  stripeEnabled: boolean;
  canRefundStripe: boolean;
  stripeRefundBlockedReason: string | null;
  canRefundManual: boolean;
  manualRefundBlockedReason: string | null;
  canRetry: boolean;
  retryBlockedReason: string | null;
}

export interface PaymentSummary {
  count: number;
  collectedCents: number;
  refundedCents: number;
  netCents: number;
  failedCount: number;
  failedCents: number;
  requiresActionCount: number;
  byKind: { kind: string; count: number; collectedCents: number; refundedCents: number }[];
}

export interface AdminInvoice {
  id: number;
  businessId: number | null;
  businessName: string | null;
  planCode: string | null;
  status: string;
  amountCents: number;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  description: string | null;
  failureReason: string | null;
  invoiceUrl: string | null;
  createdAt: string;
}

export interface PaymentFilters {
  kind?: string;
  status?: string;
  businessId?: number | null;
  customerId?: number | null;
  bookingId?: number | null;
  from?: string;
  to?: string;
  q?: string;
  page: number;
  size?: number;
}

export interface RefundRequest {
  amountCents: number | null;
  reason: string;
  method: RefundMethod;
  refundApplicationFee: boolean;
}

export interface ChargeRequest {
  bookingId: number;
  kind: string;
  amountCents: number;
  method: 'CARD' | 'MANUAL';
  note: string | null;
}

/** PaymentDtos.PaymentMethodResponse */
export interface PaymentMethod {
  id: number;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  keepSaved: boolean;
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

// === NEGOCIOS (AdminBusinessDtos) ==========================================

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

export interface BusinessDetail extends BusinessListItem {
  phone: string;
  cif: string | null;
  description: string | null;
  address: string | null;
  postalCode: string | null;
}

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

// === PLANES Y OFERTAS (SubscriptionDtos / AdminGrantDtos) ==================

export interface PlanFeatureRef {
  code: string;
  name: string;
  description: string | null;
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
  features?: PlanFeatureRef[];
}

/** SubscriptionDtos.SubscriptionStatusResponse: lo mismo que recibe la app del negocio. */
export interface SubscriptionStatus {
  state: 'WELCOME_TRIAL' | 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
  blocked: boolean;
  planCode: string | null;
  planName: string | null;
  priceCents: number;
  currency: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  daysLeft: number | null;
  trialAvailable: boolean;
  canChangePlan: boolean;
  endedAccess: 'WELCOME_TRIAL' | 'FREE_PLAN' | 'PAID' | 'NONE' | null;
}

/** AdminAccessDtos.BusinessAccessResponse */
export interface BusinessAccess {
  status: SubscriptionStatus;
  billingEnabled: boolean;
  superAccess: boolean;
}

/** AdminAccessDtos.SubscriptionOverviewItem */
export interface SubscriptionOverview {
  id: number;
  businessId: number;
  businessName: string;
  planCode: string;
  planName: string;
  status: string;
  source: string;
  startAt: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  grantsAccessNow: boolean;
}

export type GrantScope = 'GLOBAL' | 'BUSINESS';
export type GrantTargetType = 'FEATURE' | 'PLAN';

export interface Grant {
  id: number;
  scope: GrantScope;
  businessId: number | null;
  businessName: string | null;
  targetType: GrantTargetType;
  featureCode: string | null;
  featureName: string | null;
  planCode: string | null;
  planName: string | null;
  validFrom: string;
  validUntil: string | null;
  active: boolean;
  note: string | null;
  createdAt: string;
}

export interface CreateGrantRequest {
  scope: GrantScope;
  businessId: number | null;
  targetType: GrantTargetType;
  featureCode: string | null;
  planCode: string | null;
  validFrom: string | null;
  validUntil: string | null;
  note: string | null;
}

export interface Feature {
  code: string;
  name: string;
  description: string | null;
}

// === SOPORTE (SupportDtos) =================================================

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketKind = 'SUPPORT' | 'IMPROVEMENT';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TicketAttachment {
  id: number;
  filename: string;
  contentType: string;
  sizeBytes: number;
  url: string;
}

export interface TicketReply {
  id: number;
  adminName: string;
  body: string;
  createdAt: string;
}

export interface Ticket {
  id: number;
  requesterId: number;
  requesterName: string;
  requesterRole: string;
  businessId: number | null;
  businessName: string | null;
  kind: TicketKind;
  subject: string | null;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  attachments: TicketAttachment[];
  replies: TicketReply[];
}

// === REPORTES (ReportDtos) =================================================

export type ReportStatus = 'PENDING' | 'REVIEWED' | 'DISMISSED';

export interface Report {
  id: number;
  reporterId: number;
  reporterName: string;
  reportedId: number;
  reportedName: string;
  targetType: 'BUSINESS' | 'CUSTOMER';
  reason: string;
  description: string | null;
  autoGenerated: boolean;
  status: ReportStatus;
  createdAt: string;
}

// === CATÁLOGO (CategoryDtos / DiscoveryDtos / ReferralDtos) ================

export interface Category {
  id: number;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface DiscoverySettings {
  minRating: number;
  minReviews: number;
  minReferrals: number;
  newBusinessDays: number;
  featuredBandKm: number;
  featuredMaxDistanceKm: number;
}

export interface ReferralStat {
  businessId: number;
  businessName: string;
  referralCode: string | null;
  referredCount: number;
}

// === NEGOCIO POR DENTRO (AdminOpsDtos y DTOs de cada módulo) ===============

export interface BusinessOverview {
  customers: number;
  workers: number;
  pendingInvitations: number;
  services: number;
  activeServices: number;
  portfolioImages: number;
  averageRating: number | null;
  reviewCount: number;
  bookings: number;
}

export interface BusinessClient {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  source: 'MANUAL' | 'CONTACTS' | null;
  linkedCustomerId: number | null;
  invitedAt: string | null;
  createdAt: string;
  bookingCount: number;
  lastBookingAt: string | null;
}

/** WorkerDtos.WorkerResponse */
export interface Worker {
  id: number;
  name: string;
  email: string;
  username: string;
  phone: string | null;
  businessId: number | null;
  available: boolean;
  autoAccept: boolean;
  allowOvertime: boolean;
  chatEnabled: boolean;
  waitlistManageEnabled: boolean;
  clockInEnabled: boolean;
  profileImageUrl: string | null;
}

export interface Invitation {
  id: number;
  businessId: number;
  businessName: string;
  email: string | null;
  token: string;
  expiresAt: string | null;
  used: boolean;
}

/** ServiceDtos.ServiceResponse */
export interface OfferedService {
  id: number;
  name: string;
  description: string | null;
  price: number;
  duration: number;
  active: boolean;
  imageUrl: string | null;
  workerIds: number[];
  averageRating: number | null;
  reviewCount: number;
}

export interface ScheduleEntry {
  id: number;
  actorId: number;
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  startTime: string;
  endTime: string;
}

export interface PortfolioImage {
  id: number;
  url: string | null;
  caption: string | null;
  serviceId: number | null;
  serviceName: string | null;
  displayOrder: number;
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELED' | 'NO_SHOW';

/** BookingDtos.BookingResponse */
export interface Booking {
  id: number;
  businessId: number;
  businessName: string;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  serviceId: number;
  serviceName: string;
  workerId: number | null;
  workerName: string | null;
  startDateTime: string;
  endDateTime: string;
  status: BookingStatus;
  notes: string | null;
  cancelReason: string | null;
  priceCents: number | null;
}

export interface AdminReview {
  id: number;
  bookingId: number | null;
  customerId: number;
  customerName: string;
  businessId: number;
  businessName: string;
  serviceName: string | null;
  rating: number;
  comment: string | null;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

// === EQUIPO DEL PANEL ======================================================

export type AdminScope = 'FULL' | 'SUPPORT' | 'READONLY';

export interface TeamMember {
  id: number;
  name: string;
  email: string;
  username: string;
  scope: AdminScope;
  enabled: boolean;
  createdAt: string;
  you: boolean;
}

// === AUDITORÍA Y BÚSQUEDA ==================================================

export interface AuditLogEntry {
  id: number;
  adminName: string;
  action: string;
  entityType: string;
  entityId: number | null;
  details: string | null;
  createdAt: string;
}

export interface SearchResults {
  customers: { id: number; name: string; email: string }[];
  businesses: { id: number; name: string; email: string }[];
  tickets: { id: number; subject: string | null; status: string }[];
}
