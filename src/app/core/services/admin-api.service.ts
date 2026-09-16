import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminInvoice,
  AdminPayment,
  AdminPaymentDetail,
  AdminRefund,
  ChargeRequest,
  OnboardingContact,
  OnboardingResponse,
  PaymentFilters,
  PaymentSummary,
  RefundRequest,
  AdminReview,
  AdminScope,
  AuditLogEntry,
  Booking,
  BusinessClient,
  BusinessOverview,
  Charge,
  Invitation,
  OfferedService,
  PortfolioImage,
  ScheduleEntry,
  TeamMember,
  Worker,
  BusinessAccess,
  BusinessDetail,
  BusinessListItem,
  BusinessSubscription,
  Category,
  CreateGrantRequest,
  CustomerDetail,
  CustomerListItem,
  DashboardStats,
  DiscoverySettings,
  Feature,
  Grant,
  PageResponse,
  Plan,
  ReferralStat,
  Report,
  ReportStatus,
  Reputation,
  Sanction,
  SanctionRequest,
  SearchResults,
  SubscriptionOverview,
  Ticket,
  TicketKind,
  TicketPriority,
  TicketStatus,
} from '../models/admin.models';

type Params = Record<string, string | number | boolean | null | undefined>;

// Drops empty filters: the backend treats `?banned=` differently from not sending it.
function params(values: Params): HttpParams {
  let p = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== '') p = p.set(key, String(value));
  }
  return p;
}

function query(values: Params): string {
  const qs = params(values).toString();
  return qs ? `?${qs}` : '';
}

/**
 * All panel calls to the backend, one per endpoint. The routes are those of
 * the Admin* controllers (and the few public ones the panel uses:
 * /categories, /plans, /support/tickets/{id}/attachments).
 */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  // ----- DASHBOARD AND SEARCH --------------------

  dashboard() {
    return this.http.get<DashboardStats>(`${this.api}/admin/dashboard`);
  }

  search(q: string) {
    return this.http.get<SearchResults>(`${this.api}/admin/search`, { params: params({ q }) });
  }

  // ----- CLIENTS --------------------

  customers(f: { search?: string; reputation?: Reputation | ''; page: number; size?: number }) {
    return this.http.get<PageResponse<CustomerListItem>>(`${this.api}/admin/customers`, {
      params: params({ search: f.search, reputation: f.reputation, page: f.page, size: f.size ?? 20 }),
    });
  }

  customersExportUrl(f: { search?: string; reputation?: Reputation | '' }) {
    return `${this.api}/admin/customers/export${query({ search: f.search, reputation: f.reputation })}`;
  }

  customer(id: number) {
    return this.http.get<CustomerDetail>(`${this.api}/admin/customers/${id}`);
  }

  resetCustomer(id: number) {
    return this.http.post<void>(`${this.api}/admin/customers/${id}/reset`, {});
  }

  sanctionCustomer(id: number, req: SanctionRequest) {
    return this.http.post<Sanction>(`${this.api}/admin/customers/${id}/sanctions`, req);
  }

  liftSanction(customerId: number, sanctionId: number) {
    return this.http.delete<void>(`${this.api}/admin/customers/${customerId}/sanctions/${sanctionId}`);
  }

  // ----- BUSINESSES --------------------

  businesses(f: { search?: string; banned?: boolean | null; page: number; size?: number }) {
    return this.http.get<PageResponse<BusinessListItem>>(`${this.api}/admin/businesses`, {
      params: params({ search: f.search, banned: f.banned, page: f.page, size: f.size ?? 20 }),
    });
  }

  businessesExportUrl(f: { search?: string; banned?: boolean | null }) {
    return `${this.api}/admin/businesses/export${query({ search: f.search, banned: f.banned })}`;
  }

  business(id: number) {
    return this.http.get<BusinessDetail>(`${this.api}/admin/businesses/${id}`);
  }

  banBusiness(id: number) {
    return this.http.post<void>(`${this.api}/admin/businesses/${id}/ban`, {});
  }

  unbanBusiness(id: number) {
    return this.http.post<void>(`${this.api}/admin/businesses/${id}/unban`, {});
  }

  businessSubscriptions(id: number) {
    return this.http.get<BusinessSubscription[]>(`${this.api}/admin/businesses/${id}/subscriptions`);
  }

  // ----- SUBSCRIPTIONS, PLANS AND OFFERS --------------------

  plans() {
    return this.http.get<Plan[]>(`${this.api}/plans`);
  }

  assignPlan(businessId: number, planCode: string, currentPeriodEnd: string | null) {
    return this.http.post<{ id: number }>(`${this.api}/admin/subscriptions`, { businessId, planCode, currentPeriodEnd });
  }

  cancelSubscription(id: number) {
    return this.http.delete<void>(`${this.api}/admin/subscriptions/${id}`);
  }

  // ----- BUSINESS ACCESS (AdminAccessController) --------------------

  /** What the business app sees: status, current plan, days left. */
  businessAccess(businessId: number) {
    return this.http.get<BusinessAccess>(`${this.api}/admin/businesses/${businessId}/access`);
  }

  /** Gifts a plan until `until` (null = no end). Replaces the current gift. */
  grantFreePlan(businessId: number, planCode: string, until: string | null) {
    return this.http.post<BusinessAccess>(`${this.api}/admin/businesses/${businessId}/free-plan`, { planCode, until });
  }

  /** Cancels what was gifted (panel plan and welcome period). If it pays nothing, it hits the paywall. */
  revokeFreeAccess(businessId: number) {
    return this.http.post<{ canceled: number; access: BusinessAccess }>(
      `${this.api}/admin/businesses/${businessId}/revoke-access`,
      {},
    );
  }

  setSuperAccess(businessId: number, enabled: boolean) {
    return this.http.put<BusinessAccess>(`${this.api}/admin/businesses/${businessId}/super-access`, { enabled });
  }

  /** Extends or shortens a gifted plan (null = no end). */
  updateSubscriptionEnd(subscriptionId: number, currentPeriodEnd: string | null) {
    return this.http.put<BusinessAccess>(`${this.api}/admin/subscriptions/${subscriptionId}/period-end`, { currentPeriodEnd });
  }

  subscriptionsOverview(f: { source?: string; status?: string } = {}) {
    return this.http.get<SubscriptionOverview[]>(`${this.api}/admin/subscriptions`, { params: params(f) });
  }

  /** Requires the GET /admin/grants added in this backend version. */
  grants(businessId?: number | null) {
    return this.http.get<Grant[]>(`${this.api}/admin/grants`, { params: params({ businessId }) });
  }

  createGrant(req: CreateGrantRequest) {
    return this.http.post<{ id: number }>(`${this.api}/admin/grants`, req);
  }

  revokeGrant(id: number) {
    return this.http.delete<void>(`${this.api}/admin/grants/${id}`);
  }

  /** Requires the GET /admin/features added in this backend version. */
  features() {
    return this.http.get<Feature[]>(`${this.api}/admin/features`);
  }

  // ----- SUPPORT --------------------

  /**
   * Ticket inbox. With `kind` (SUPPORT or IMPROVEMENT) it uses the by-type
   * listing added for the panel: the original one mixes support and improvements.
   */
  tickets(f: { status?: TicketStatus | ''; kind?: TicketKind | ''; businessId?: number | null; page: number; size?: number }) {
    const url = f.kind ? `${this.api}/admin/support/tickets/by-kind` : `${this.api}/admin/support/tickets`;
    return this.http.get<PageResponse<Ticket>>(url, {
      params: params({ status: f.status, kind: f.kind, businessId: f.businessId, page: f.page, size: f.size ?? 20 }),
    });
  }

  ticketsExportUrl(f: { status?: TicketStatus | ''; businessId?: number | null }) {
    return `${this.api}/admin/support/tickets/export${query({ status: f.status, businessId: f.businessId })}`;
  }

  ticket(id: number) {
    return this.http.get<Ticket>(`${this.api}/admin/support/tickets/${id}`);
  }

  replyTicket(id: number, body: string) {
    return this.http.post<Ticket>(`${this.api}/admin/support/tickets/${id}/replies`, { body });
  }

  /** The backend saves adminNotes together with the status: send the current notes so they are not erased. */
  updateTicketStatus(id: number, status: TicketStatus, adminNotes: string | null) {
    return this.http.put<Ticket>(`${this.api}/admin/support/tickets/${id}/status`, { status, adminNotes });
  }

  updateTicketPriority(id: number, priority: TicketPriority) {
    return this.http.put<Ticket>(`${this.api}/admin/support/tickets/${id}/priority`, { priority });
  }

  /**
   * Attachments are served from /support/tickets (which allows Admin), not from
   * /admin/support: that route does not exist and attachments never loaded.
   */
  ticketAttachment(ticketId: number, attachmentId: number) {
    return this.http.get(`${this.api}/support/tickets/${ticketId}/attachments/${attachmentId}`, { responseType: 'blob' });
  }

  // ----- REPORTS --------------------

  /**
   * GET /admin/reports is new; if the deployed backend does not have it yet,
   * it falls back to the original GET /reports (also Admin only).
   */
  reports(f: { status?: ReportStatus | ''; page: number; size?: number }): Observable<PageResponse<Report>> {
    const p = params({ status: f.status, page: f.page, size: f.size ?? 20 });
    return this.http.get<PageResponse<Report>>(`${this.api}/admin/reports`, { params: p }).pipe(
      catchError((err: unknown) =>
        err instanceof HttpErrorResponse && err.status === 404
          ? this.http.get<PageResponse<Report>>(`${this.api}/reports`, { params: p })
          : throwError(() => err),
      ),
    );
  }

  updateReportStatus(id: number, status: ReportStatus) {
    return this.http.put<Report>(`${this.api}/admin/reports/${id}/status`, { status });
  }

  // ----- CATALOG AND SETTINGS --------------------

  categories() {
    return this.http.get<Category[]>(`${this.api}/categories`, { params: params({ activeOnly: false }) });
  }

  createCategory(req: { code: string; name: string; description: string | null }) {
    return this.http.post<Category>(`${this.api}/categories`, req);
  }

  updateCategory(id: number, req: { name: string; description: string | null; active: boolean | null }) {
    return this.http.put<Category>(`${this.api}/categories/${id}`, req);
  }

  discoverySettings() {
    return this.http.get<DiscoverySettings>(`${this.api}/admin/discovery-settings`);
  }

  updateDiscoverySettings(req: DiscoverySettings) {
    return this.http.put<DiscoverySettings>(`${this.api}/admin/discovery-settings`, req);
  }

  referrals() {
    return this.http.get<ReferralStat[]>(`${this.api}/admin/referrals`);
  }

  // ----- BUSINESS INTERNALS (AdminOpsController) --------------------

  businessOverview(id: number) {
    return this.http.get<BusinessOverview>(`${this.api}/admin/businesses/${id}/overview`);
  }

  businessClients(id: number) {
    return this.http.get<BusinessClient[]>(`${this.api}/admin/businesses/${id}/customers`);
  }

  businessWorkers(id: number) {
    return this.http.get<Worker[]>(`${this.api}/admin/businesses/${id}/workers`);
  }

  businessInvitations(id: number) {
    return this.http.get<Invitation[]>(`${this.api}/admin/businesses/${id}/invitations`);
  }

  businessServices(id: number) {
    return this.http.get<OfferedService[]>(`${this.api}/admin/businesses/${id}/services`);
  }

  businessSchedule(id: number) {
    return this.http.get<ScheduleEntry[]>(`${this.api}/admin/businesses/${id}/schedule`);
  }

  businessPortfolio(id: number) {
    return this.http.get<PortfolioImage[]>(`${this.api}/admin/businesses/${id}/portfolio`);
  }

  deletePortfolioImage(imageId: number, reason: string | null) {
    return this.http.delete<void>(`${this.api}/admin/portfolio/${imageId}`, { params: params({ reason }) });
  }

  businessBookings(id: number, page: number, size = 20) {
    return this.http.get<PageResponse<Booking>>(`${this.api}/admin/businesses/${id}/bookings`, { params: params({ page, size }) });
  }

  // ----- ONBOARDING (CALLS TO NEW BUSINESSES) --------------------

  onboarding(days = 60) {
    return this.http.get<OnboardingResponse>(`${this.api}/admin/support/onboarding`, { params: params({ days }) });
  }

  onboardingContacts(businessId: number) {
    return this.http.get<OnboardingContact[]>(`${this.api}/admin/support/onboarding/${businessId}/contacts`);
  }

  addOnboardingContact(businessId: number, req: { outcome: string; note: string | null; nextCallAt: string | null }) {
    return this.http.post<OnboardingContact>(`${this.api}/admin/support/onboarding/${businessId}/contacts`, req);
  }

  // ----- PAYMENTS (GLOBAL LEDGER) --------------------

  payments(f: PaymentFilters) {
    return this.http.get<PageResponse<AdminPayment>>(`${this.api}/admin/payments`, {
      params: params({ ...f, size: f.size ?? 20 }),
    });
  }

  paymentsSummary() {
    return this.http.get<PaymentSummary>(`${this.api}/admin/payments/summary`);
  }

  payment(id: number) {
    return this.http.get<AdminPaymentDetail>(`${this.api}/admin/payments/${id}`);
  }

  refundPayment(id: number, req: RefundRequest) {
    return this.http.post<AdminPaymentDetail>(`${this.api}/admin/payments/${id}/refund`, req);
  }

  retryPayment(id: number) {
    return this.http.post<AdminPaymentDetail>(`${this.api}/admin/payments/${id}/retry`, {});
  }

  chargeBooking(req: ChargeRequest) {
    return this.http.post<AdminPaymentDetail>(`${this.api}/admin/payments/charge`, req);
  }

  paymentRefunds(page: number, businessId?: number | null, size = 20) {
    return this.http.get<PageResponse<AdminRefund>>(`${this.api}/admin/payments/refunds`, { params: params({ businessId, page, size }) });
  }

  subscriptionInvoices(page: number, businessId?: number | null, size = 20) {
    return this.http.get<PageResponse<AdminInvoice>>(`${this.api}/admin/payments/invoices`, { params: params({ businessId, page, size }) });
  }

  businessPayments(id: number, page: number, size = 20) {
    return this.http.get<PageResponse<Charge>>(`${this.api}/admin/businesses/${id}/payments`, { params: params({ page, size }) });
  }

  // ----- MODERATION --------------------

  reviewsList(f: { businessId?: number | null; customerId?: number | null; page: number; size?: number }) {
    return this.http.get<PageResponse<AdminReview>>(`${this.api}/admin/reviews`, {
      params: params({ businessId: f.businessId, customerId: f.customerId, page: f.page, size: f.size ?? 20 }),
    });
  }

  deleteReview(id: number, reason: string | null) {
    return this.http.delete<void>(`${this.api}/admin/reviews/${id}`, { params: params({ reason }) });
  }

  customerBookings(id: number, page: number, size = 20) {
    return this.http.get<PageResponse<Booking>>(`${this.api}/admin/customers/${id}/bookings`, { params: params({ page, size }) });
  }

  cancelBooking(id: number, reason: string | null) {
    return this.http.post<Booking>(`${this.api}/admin/bookings/${id}/cancel`, { reason });
  }

  /** Push notification to a client's or business's phones. Returns how many devices were attempted. */
  notifyActor(actorId: number, title: string, body: string) {
    return this.http.post<{ devices: number }>(`${this.api}/admin/actors/${actorId}/notify`, { title, body });
  }

  // ----- PANEL TEAM (AdminTeamController) --------------------

  team() {
    return this.http.get<TeamMember[]>(`${this.api}/admin/team`);
  }

  createTeamMember(req: { name: string; email: string; username: string; password: string; scope: AdminScope }) {
    return this.http.post<TeamMember>(`${this.api}/admin/team`, req);
  }

  updateTeamMember(id: number, req: { name: string; scope: AdminScope }) {
    return this.http.put<TeamMember>(`${this.api}/admin/team/${id}`, req);
  }

  resetTeamPassword(id: number, password: string) {
    return this.http.put<void>(`${this.api}/admin/team/${id}/password`, { password });
  }

  setTeamMemberEnabled(id: number, enabled: boolean) {
    return this.http.put<TeamMember>(`${this.api}/admin/team/${id}/enabled`, { enabled });
  }

  // ----- AUDIT LOG --------------------

  auditLog(page: number, size = 30) {
    return this.http.get<PageResponse<AuditLogEntry>>(`${this.api}/admin/audit-log`, { params: params({ page, size }) });
  }

  /** Requires the GET /admin/audit-log/entity added in this backend version. */
  auditLogFor(entityType: string, entityId: number, size = 20) {
    return this.http.get<PageResponse<AuditLogEntry>>(`${this.api}/admin/audit-log/entity`, {
      params: params({ entityType, entityId, page: 0, size }),
    });
  }
}
