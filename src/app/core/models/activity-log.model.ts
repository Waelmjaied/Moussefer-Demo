export interface ActivityLog {
  id: string; // was: number — backend uses UUID string
  adminId: string; // was: userEmail — backend field is adminId
  action: string; // e.g., "USER_SUSPENDED", "DEACTIVATE_USER", "ASSIGN_ADMIN_ROLE"
  targetType: string; // was: entityType — e.g., "USER", "TRAJET", "RESERVATION"
  targetId: string; // was: entityId
  details: string;
  ipAddress: string;
  createdAt: string; // was: timestamp — backend returns LocalDateTime serialized as ISO string
}
