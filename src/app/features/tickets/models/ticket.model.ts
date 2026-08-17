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

export interface TicketListItem {
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

/** El detalle es la misma forma que el listado; solo replies viene siempre relleno. */
export type TicketDetail = TicketListItem;

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
}
