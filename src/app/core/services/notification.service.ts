import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  Subscription,
  combineLatest,
  interval,
  of,
  startWith,
  switchMap,
  map,
  catchError,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AlertSubscribeRequest,
  AlertSubscription,
  Notification,
} from '../models/notification.model';

/**
 * Front-end client for {@code notification-service}.
 *
 * Backend endpoints (NotificationController.java):
 *   GET    /api/v1/notifications                 → list (paginated, X-User-Id)
 *   GET    /api/v1/notifications/unread-count    → count of my unread (V2, new)
 *   POST   /api/v1/notifications/read-all        → mark every notif read
 *   POST   /api/v1/notifications/{id}/read       → mark one read
 *   DELETE /api/v1/notifications/{id}            → delete one
 *   DELETE /api/v1/notifications/all             → delete every notif
 *   POST   /api/v1/notifications/alerts/subscribe  (QUERY PARAMS — not JSON!)
 *   GET    /api/v1/notifications/alerts/my
 *   DELETE /api/v1/notifications/alerts/{alertId}
 *
 * State exposed:
 *   notifications$  — last fetched page (most recent 20 by default)
 *   unreadCount$    — authoritative unread count from the server
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private apiUrl = environment.apiUrl;

  private readonly notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public readonly notifications$ = this.notificationsSubject.asObservable();

  private readonly unreadCountSubject = new BehaviorSubject<number>(0);
  public readonly unreadCount$ = this.unreadCountSubject.asObservable();

  private pollingSub: Subscription | null = null;

  constructor(private http: HttpClient) {}

  // ────────────────────────────────────────────────────────────────────
  //  Polling
  // ────────────────────────────────────────────────────────────────────

  /**
   * Start polling notifications + unread count.
   *
   * Safe to call multiple times — only one timer ever runs. Call
   * {@link stopPolling} on logout to free the timer (the service lives
   * as a singleton via providedIn: 'root', so it survives component
   * teardown and would otherwise hammer the API forever).
   */
  startPolling(intervalMs = 30_000): void {
    if (this.pollingSub) return;

    this.pollingSub = interval(intervalMs)
      .pipe(
        startWith(0),
        switchMap(() =>
          combineLatest({
            list: this.fetchNotifications().pipe(catchError(() => of([] as Notification[]))),
            unread: this.fetchUnreadCount().pipe(catchError(() => of(0))),
          }),
        ),
      )
      .subscribe(({ list, unread }) => {
        this.notificationsSubject.next(list);
        this.unreadCountSubject.next(unread);
      });
  }

  stopPolling(): void {
    this.pollingSub?.unsubscribe();
    this.pollingSub = null;
    // Reset state so a future startPolling() doesn't replay stale data.
    this.notificationsSubject.next([]);
    this.unreadCountSubject.next(0);
  }

  // ────────────────────────────────────────────────────────────────────
  //  Listing
  // ────────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/notifications
   *
   * Backend returns a flat {@code List<Notification>} (NOT a Spring Data
   * Page envelope), so we keep the same shape here.
   */
  fetchNotifications(page = 0, size = 20): Observable<Notification[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Notification[]>(`${this.apiUrl}/api/v1/notifications`, { params });
  }

  /**
   * GET /api/v1/notifications/unread-count
   *
   * Authoritative count, not constrained by the page size. Falls back to
   * counting the local cache if the endpoint isn't deployed yet (so the
   * frontend keeps working against an older backend).
   */
  fetchUnreadCount(): Observable<number> {
    return this.http
      .get<{ unread: number } | number>(`${this.apiUrl}/api/v1/notifications/unread-count`)
      .pipe(
        map((res) => (typeof res === 'number' ? res : (res?.unread ?? 0))),
        catchError(() => of(this.notificationsSubject.value.filter((n) => !n.read).length)),
      );
  }

  // ────────────────────────────────────────────────────────────────────
  //  Mutations — every one re-publishes through the subjects so other
  //  subscribers (notification bell, badge, headers) stay in sync.
  // ────────────────────────────────────────────────────────────────────

  markAsRead(id: string): Observable<void> {
    return new Observable<void>((observer) => {
      this.http.post<void>(`${this.apiUrl}/api/v1/notifications/${id}/read`, {}).subscribe({
        next: () => {
          this.patchLocal((n) => (n.id === id ? { ...n, read: true } : n));
          this.decrementUnread();
          observer.next();
          observer.complete();
        },
        error: (err) => observer.error(err),
      });
    });
  }

  markAllAsRead(): Observable<void> {
    return new Observable<void>((observer) => {
      this.http.post<void>(`${this.apiUrl}/api/v1/notifications/read-all`, {}).subscribe({
        next: () => {
          this.patchLocal((n) => ({ ...n, read: true }));
          this.unreadCountSubject.next(0);
          observer.next();
          observer.complete();
        },
        error: (err) => observer.error(err),
      });
    });
  }

  deleteNotification(id: string): Observable<void> {
    return new Observable<void>((observer) => {
      this.http.delete<void>(`${this.apiUrl}/api/v1/notifications/${id}`).subscribe({
        next: () => {
          const removed = this.notificationsSubject.value.find((n) => n.id === id);
          this.notificationsSubject.next(
            this.notificationsSubject.value.filter((n) => n.id !== id),
          );
          if (removed && !removed.read) this.decrementUnread();
          observer.next();
          observer.complete();
        },
        error: (err) => observer.error(err),
      });
    });
  }

  deleteAllNotifications(): Observable<void> {
    return new Observable<void>((observer) => {
      this.http.delete<void>(`${this.apiUrl}/api/v1/notifications/all`).subscribe({
        next: () => {
          this.notificationsSubject.next([]);
          this.unreadCountSubject.next(0);
          observer.next();
          observer.complete();
        },
        error: (err) => observer.error(err),
      });
    });
  }

  private patchLocal(fn: (n: Notification) => Notification): void {
    this.notificationsSubject.next(this.notificationsSubject.value.map(fn));
  }

  private decrementUnread(): void {
    this.unreadCountSubject.next(Math.max(0, this.unreadCountSubject.value - 1));
  }

  // ────────────────────────────────────────────────────────────────────
  //  Trajet availability alerts
  // ────────────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/notifications/alerts/subscribe
   *
   * The backend reads every field via {@code @RequestParam} — sending a
   * JSON body returns 400 "Required parameter is missing". We translate
   * the criteria object to URL query parameters here, and rename
   * {@code date} → {@code desiredDate} to match the backend signature.
   */
  subscribeToAlert(criteria: AlertSubscribeRequest): Observable<AlertSubscription> {
    let params = new HttpParams()
      .set('departureCity', criteria.departureCity)
      .set('arrivalCity', criteria.arrivalCity);
    if (criteria.date) params = params.set('desiredDate', criteria.date);
    if (criteria.minSeats != null) params = params.set('minSeats', criteria.minSeats);

    return this.http.post<AlertSubscription>(
      `${this.apiUrl}/api/v1/notifications/alerts/subscribe`,
      null,
      { params },
    );
  }

  getMyAlerts(): Observable<AlertSubscription[]> {
    return this.http.get<AlertSubscription[]>(`${this.apiUrl}/api/v1/notifications/alerts/my`);
  }

  deleteAlert(alertId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/v1/notifications/alerts/${alertId}`);
  }

  // ────────────────────────────────────────────────────────────────────
  //  Deep-linking helper — returns the front-end route to navigate to
  //  when a notification is clicked, based on its referenceType.
  //  Returns null if no deep-link is applicable (display only).
  // ────────────────────────────────────────────────────────────────────

  deepLinkFor(notif: Notification): string[] | null {
    if (!notif.referenceId) return null;
    switch (notif.referenceType) {
      case 'RESERVATION':
        return ['/passenger/reservation', notif.referenceId];
      case 'VOYAGE_RESERVATION':
        return ['/passenger/my-reservations'];
      case 'TRAJET':
        return ['/passenger/trajets', notif.referenceId];
      case 'VOYAGE':
        return ['/passenger/voyages', notif.referenceId];
      case 'PAYMENT':
        return ['/passenger/payments'];
      case 'DISPUTE':
        return ['/passenger/disputes'];
      case 'CHAT':
        return ['/passenger/messages'];
      default:
        return null;
    }
  }
}
