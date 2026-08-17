export interface AuditLogEntry {
  id: number;
  adminName: string;
  action: string;
  entityType: string;
  entityId: number | null;
  details: string | null;
  createdAt: string;
}
