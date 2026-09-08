// Notification domain — aligned 1:1 with notification-service backend DTOs.
// Reference: notification-service/src/main/java/com/moussefer/notification/entity/

/** Backend NotificationType.java — string constants only. */
export type NotificationType = 'IN_APP' | 'EMAIL' | 'PUSH_FCM';

/**
 * Semantic category for the {@code referenceId} field. The backend stores
 * this as a free-form String (length 50); the values below are the ones
 * actually emitted by the Kafka consumers and admin sends today. Listed
 * here so the UI can switch on them for deep-linking.
 */
export type NotificationReferenceType =
  | 'RESERVATION'
  | 'VOYAGE_RESERVATION'
  | 'TRAJET'
  | 'VOYAGE'
  | 'PAYMENT'
  | 'DISPUTE'
  | 'CHAT'
  | 'ADMIN_MANUAL'
  | 'ADMIN_BROADCAST'
  | 'ALERT'
  | string; // open-ended for future categories

/**
 * Aligned with backend Notification.java.
 *
 * NOTE: the entity column is named {@code is_read} but exposed as
 * {@code read} on the JSON wire (JPA + Lombok default getter).
 */
export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  referenceId?: string;
  referenceType?: NotificationReferenceType;
  read: boolean;
  sentAt: string; // ISO LocalDateTime
}

/**
 * Aligned with backend AlertSubscription.java — returned by
 *   POST /api/v1/notifications/alerts/subscribe
 *   GET  /api/v1/notifications/alerts/my
 */
export interface AlertSubscription {
  id: string;
  userId: string;
  departureCity: string;
  arrivalCity: string;
  desiredDate?: string; // ISO LocalDate ("yyyy-MM-dd")
  minSeats: number;
  active: boolean;
  notified: boolean;
  createdAt: string;
}

/**
 * Client-side criteria object for {@code NotificationService.subscribeToAlert}.
 * The service maps these fields onto the backend's expected query parameters:
 *   - {@code date} → {@code desiredDate}
 *   - {@code minSeats} defaults to 1 server-side if omitted
 */
export interface AlertSubscribeRequest {
  departureCity: string;
  arrivalCity: string;
  date?: string;
  minSeats?: number;
}
