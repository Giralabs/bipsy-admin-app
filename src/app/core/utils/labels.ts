/**
 * Traducción de los enums del backend a texto, tono e icono. Todo en un sitio:
 * antes cada pantalla pintaba "IN_PROGRESS" o "CANCELLATION_FEE" tal cual.
 */

export type Tone = 'mint' | 'success' | 'warn' | 'danger' | 'info' | 'neutral';

export interface Meta {
  label: string;
  tone: Tone;
  icon?: string;
}

const fallback = (value: string | null | undefined): Meta => ({ label: value ?? '—', tone: 'neutral' });

function lookup(table: Record<string, Meta>) {
  return (value: string | null | undefined): Meta => (value && table[value]) || fallback(value);
}

export const ticketStatus = lookup({
  OPEN: { label: 'Abierto', tone: 'warn', icon: 'mark_email_unread' },
  IN_PROGRESS: { label: 'En curso', tone: 'info', icon: 'progress_activity' },
  RESOLVED: { label: 'Resuelto', tone: 'success', icon: 'check_circle' },
  CLOSED: { label: 'Cerrado', tone: 'neutral', icon: 'lock' },
});

export const ticketPriority = lookup({
  LOW: { label: 'Baja', tone: 'neutral' },
  MEDIUM: { label: 'Media', tone: 'info' },
  HIGH: { label: 'Alta', tone: 'warn' },
  URGENT: { label: 'Urgente', tone: 'danger', icon: 'priority_high' },
});

export const ticketKind = lookup({
  SUPPORT: { label: 'Soporte', tone: 'neutral', icon: 'support_agent' },
  IMPROVEMENT: { label: 'Mejora', tone: 'mint', icon: 'auto_awesome' },
});

export const bookingStatus = lookup({
  PENDING: { label: 'Pendientes', tone: 'warn' },
  CONFIRMED: { label: 'Confirmadas', tone: 'success' },
  CANCELED: { label: 'Canceladas', tone: 'danger' },
  NO_SHOW: { label: 'No acudieron', tone: 'danger' },
});

export const reputation = lookup({
  GREEN: { label: 'Sin incidencias', tone: 'success', icon: 'verified' },
  ORANGE: { label: 'Atención', tone: 'warn', icon: 'error' },
  RED: { label: 'Riesgo', tone: 'danger', icon: 'gpp_maybe' },
});

export const subscriptionStatus = lookup({
  ACTIVE: { label: 'Activa', tone: 'success' },
  PAST_DUE: { label: 'Pago pendiente', tone: 'warn' },
  EXPIRED: { label: 'Caducada', tone: 'neutral' },
  CANCELED: { label: 'Cancelada', tone: 'neutral' },
});

export const subscriptionSource = lookup({
  ADMIN: { label: 'Panel de admin', tone: 'neutral' },
  CHECKOUT: { label: 'Tarjeta (Stripe)', tone: 'neutral' },
  STORE: { label: 'App Store / Google Play', tone: 'neutral' },
  WELCOME: { label: 'Bienvenida', tone: 'neutral' },
});

/** BusinessAccessState: lo que decide si la app del negocio se abre. */
export const accessState = lookup({
  WELCOME_TRIAL: { label: 'Cortesía de bienvenida', tone: 'info', icon: 'celebration' },
  TRIAL: { label: 'En prueba', tone: 'info', icon: 'hourglass_top' },
  ACTIVE: { label: 'Con acceso', tone: 'success', icon: 'lock_open' },
  PAST_DUE: { label: 'Pago pendiente', tone: 'warn', icon: 'credit_card_off' },
  CANCELED: { label: 'Bloqueado · canceló', tone: 'danger', icon: 'lock' },
  EXPIRED: { label: 'Bloqueado · sin plan', tone: 'danger', icon: 'lock' },
});

export const billingInterval = lookup({
  MONTHLY: { label: '/mes', tone: 'neutral' },
  ONE_TIME: { label: 'pago único', tone: 'neutral' },
});

export const chargeKind = lookup({
  CANCELLATION_FEE: { label: 'Cancelación', tone: 'neutral' },
  RESCHEDULE_FEE: { label: 'Cambio de hora', tone: 'neutral' },
  NO_SHOW_FEE: { label: 'No acudió', tone: 'neutral' },
  BOOKING_PAYMENT: { label: 'Pago de cita', tone: 'neutral' },
});

export const chargeStatus = lookup({
  PENDING: { label: 'Pendiente', tone: 'warn' },
  AUTHORIZED: { label: 'Autorizado', tone: 'info' },
  SUCCEEDED: { label: 'Cobrado', tone: 'success' },
  REQUIRES_ACTION: { label: 'Requiere acción', tone: 'warn' },
  FAILED: { label: 'Fallido', tone: 'danger' },
  PARTIALLY_REFUNDED: { label: 'Devuelto en parte', tone: 'info' },
  REFUNDED: { label: 'Devuelto', tone: 'neutral' },
});

export const reportStatus = lookup({
  PENDING: { label: 'Pendiente', tone: 'warn', icon: 'flag' },
  REVIEWED: { label: 'Revisado', tone: 'success', icon: 'task_alt' },
  DISMISSED: { label: 'Descartado', tone: 'neutral', icon: 'do_not_disturb_on' },
});

export const reportReason = lookup({
  NO_SHOW: { label: 'No se presentó', tone: 'neutral' },
  INAPPROPRIATE_BEHAVIOR: { label: 'Comportamiento inapropiado', tone: 'neutral' },
  FRAUD: { label: 'Fraude', tone: 'danger' },
  SPAM: { label: 'Spam', tone: 'neutral' },
  FAKE_REVIEW: { label: 'Reseña falsa', tone: 'neutral' },
  OTHER: { label: 'Otro motivo', tone: 'neutral' },
});

export const authProvider = lookup({
  LOCAL: { label: 'Email y contraseña', tone: 'neutral' },
  GOOGLE: { label: 'Google', tone: 'neutral' },
});

export const adminScope = lookup({
  FULL: { label: 'Acceso completo', tone: 'mint' },
  SUPPORT: { label: 'Soporte', tone: 'info' },
  READONLY: { label: 'Solo lectura', tone: 'warn' },
});

export const auditAction = lookup({
  BAN: { label: 'Baneó', tone: 'danger', icon: 'block' },
  UNBAN: { label: 'Quitó el baneo a', tone: 'success', icon: 'lock_open' },
  RESET_ACCOUNT: { label: 'Restableció la cuenta de', tone: 'warn', icon: 'restart_alt' },
  SANCTION: { label: 'Sancionó a', tone: 'danger', icon: 'gavel' },
  LIFT_SANCTION: { label: 'Levantó la sanción de', tone: 'success', icon: 'undo' },
  TICKET_STATUS: { label: 'Cambió el estado de', tone: 'info', icon: 'swap_horiz' },
  TICKET_PRIORITY: { label: 'Cambió la prioridad de', tone: 'info', icon: 'low_priority' },
  TICKET_REPLY: { label: 'Respondió a', tone: 'mint', icon: 'reply' },
  CREATE_SUBSCRIPTION: { label: 'Asignó un plan a', tone: 'mint', icon: 'workspace_premium' },
  CANCEL_SUBSCRIPTION: { label: 'Canceló la suscripción de', tone: 'warn', icon: 'cancel' },
  CREATE_GRANT: { label: 'Concedió una oferta a', tone: 'mint', icon: 'redeem' },
  REVOKE_GRANT: { label: 'Revocó una oferta de', tone: 'warn', icon: 'remove_circle' },
  CREATE_CATEGORY: { label: 'Creó la categoría', tone: 'mint', icon: 'add_circle' },
  UPDATE_CATEGORY: { label: 'Editó la categoría', tone: 'info', icon: 'edit' },
  DEACTIVATE_CATEGORY: { label: 'Desactivó la categoría', tone: 'warn', icon: 'visibility_off' },
  UPDATE_DISCOVERY_SETTINGS: { label: 'Cambió los ajustes de Explorar', tone: 'info', icon: 'tune' },
  REPORT_STATUS: { label: 'Resolvió', tone: 'info', icon: 'flag' },
  UPDATE_SUBSCRIPTION_END: { label: 'Cambió la fecha de fin del plan de', tone: 'info', icon: 'event' },
  REVOKE_ACCESS: { label: 'Quitó el acceso gratis a', tone: 'danger', icon: 'lock' },
  DELETE_PORTFOLIO_IMAGE: { label: 'Retiró una foto del portfolio de', tone: 'warn', icon: 'hide_image' },
  DELETE_REVIEW: { label: 'Retiró una reseña de', tone: 'warn', icon: 'comments_disabled' },
  CANCEL_BOOKING: { label: 'Canceló una cita de', tone: 'danger', icon: 'event_busy' },
  SEND_NOTIFICATION: { label: 'Envió un aviso a', tone: 'mint', icon: 'notifications' },
  ADMIN_CREATE: { label: 'Dio de alta en el panel a', tone: 'mint', icon: 'person_add' },
  ADMIN_SCOPE: { label: 'Cambió los permisos de', tone: 'info', icon: 'admin_panel_settings' },
  ADMIN_PASSWORD: { label: 'Cambió la contraseña de', tone: 'warn', icon: 'password' },
  ADMIN_ENABLE: { label: 'Reactivó la cuenta del panel de', tone: 'success', icon: 'person_check' },
  ADMIN_DISABLE: { label: 'Desactivó la cuenta del panel de', tone: 'danger', icon: 'person_off' },
  GRANT_SUPER_ACCESS: { label: 'Dio acceso permanente a', tone: 'mint', icon: 'verified' },
  REVOKE_SUPER_ACCESS: { label: 'Quitó el acceso permanente a', tone: 'warn', icon: 'remove_moderator' },
  PAYMENT_REFUND: { label: 'Devolvió con Stripe un', tone: 'info', icon: 'currency_exchange' },
  PAYMENT_REFUND_MANUAL: { label: 'Registró la devolución de un', tone: 'info', icon: 'currency_exchange' },
  PAYMENT_REFUND_FAILED: { label: 'Intentó devolver un', tone: 'danger', icon: 'money_off' },
  PAYMENT_CHARGE: { label: 'Cobró con tarjeta un', tone: 'mint', icon: 'credit_card' },
  PAYMENT_CHARGE_MANUAL: { label: 'Registró a mano un', tone: 'mint', icon: 'point_of_sale' },
  PAYMENT_RETRY: { label: 'Reintentó un', tone: 'warn', icon: 'replay' },
  ONBOARDING_CALL: { label: 'Registró una llamada de bienvenida a', tone: 'mint', icon: 'call' },
});

export const onboardingStage = lookup({
  WELCOME: { label: 'Cortesía de bienvenida', tone: 'mint', icon: 'celebration' },
  TRIAL: { label: 'Prueba gratis', tone: 'info', icon: 'hourglass_top' },
  PAYING: { label: 'Ya paga', tone: 'success', icon: 'check_circle' },
  FREE: { label: 'Plan regalado', tone: 'neutral', icon: 'redeem' },
  PAST_DUE: { label: 'Pago pendiente', tone: 'warn', icon: 'credit_card_off' },
  NO_PLAN: { label: 'Se le acabó sin pagar', tone: 'danger', icon: 'lock' },
});

export const callOutcome = lookup({
  CALLED: { label: 'Hablado', tone: 'success', icon: 'call' },
  NO_ANSWER: { label: 'No contesta', tone: 'warn', icon: 'phone_missed' },
  CALL_BACK: { label: 'Volver a llamar', tone: 'info', icon: 'phone_callback' },
  WILL_PAY: { label: 'Va a contratar', tone: 'mint', icon: 'thumb_up' },
  NOT_INTERESTED: { label: 'No le interesa', tone: 'danger', icon: 'thumb_down' },
  NOTE: { label: 'Nota', tone: 'neutral', icon: 'sticky_note_2' },
});

export const refundStatus = lookup({
  PENDING: { label: 'En curso', tone: 'warn', icon: 'hourglass_top' },
  SUCCEEDED: { label: 'Devuelto', tone: 'success', icon: 'check_circle' },
  FAILED: { label: 'Fallida', tone: 'danger', icon: 'error' },
});

export const refundMethod = lookup({
  STRIPE: { label: 'A la tarjeta', tone: 'neutral', icon: 'credit_card' },
  MANUAL: { label: 'Fuera de la app', tone: 'neutral', icon: 'handshake' },
});

export const entityType = lookup({
  CUSTOMER: { label: 'cliente', tone: 'neutral' },
  BUSINESS: { label: 'negocio', tone: 'neutral' },
  TICKET: { label: 'ticket', tone: 'neutral' },
  CATEGORY: { label: 'categoría', tone: 'neutral' },
  REPORT: { label: 'reporte', tone: 'neutral' },
  ADMIN: { label: 'admin', tone: 'neutral' },
  ACTOR: { label: 'cuenta', tone: 'neutral' },
  PAYMENT: { label: 'cobro', tone: 'neutral' },
});

/** Estado de UNA cita (bookingStatus va en plural para los gráficos). */
export const bookingState = lookup({
  PENDING: { label: 'Pendiente', tone: 'warn', icon: 'hourglass_top' },
  CONFIRMED: { label: 'Confirmada', tone: 'success', icon: 'check_circle' },
  CANCELED: { label: 'Cancelada', tone: 'neutral', icon: 'cancel' },
  NO_SHOW: { label: 'No acudió', tone: 'danger', icon: 'do_not_disturb_on' },
});

export const weekday: Record<string, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

export const WEEK_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

/** Estado visible de un negocio: el baneo manda sobre el alta a medias. */
export function businessState(b: { banned: boolean; setupComplete: boolean }): Meta {
  if (b.banned) return { label: 'Baneado', tone: 'danger', icon: 'block' };
  if (!b.setupComplete) return { label: 'Alta sin terminar', tone: 'warn', icon: 'pending' };
  return { label: 'Activo', tone: 'success', icon: 'check_circle' };
}

/** Una oferta está en vigor si está activa y hoy cae dentro de su ventana. */
export function grantState(g: { active: boolean; validFrom: string; validUntil: string | null }): Meta {
  if (!g.active) return { label: 'Revocada', tone: 'neutral' };
  const now = Date.now();
  if (new Date(g.validFrom).getTime() > now) return { label: 'Programada', tone: 'info' };
  if (g.validUntil && new Date(g.validUntil).getTime() < now) return { label: 'Caducada', tone: 'neutral' };
  return { label: 'En vigor', tone: 'success' };
}

/** Ruta del panel para una entidad del log, si tiene ficha. */
export function entityRoute(type: string, id: number | null): string[] | null {
  if (id == null) return null;
  switch (type) {
    case 'CUSTOMER':
      return ['/users', String(id)];
    case 'BUSINESS':
      return ['/businesses', String(id)];
    case 'TICKET':
      return ['/tickets', String(id)];
    case 'ADMIN':
      return ['/team'];
    case 'PAYMENT':
      return ['/payments', String(id)];
    default:
      return null;
  }
}
