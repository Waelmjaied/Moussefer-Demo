import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { OrganizerSidebarComponent } from '../organizer-sidebar/organizer-sidebar.component';
import { VoyageService } from '../../../core/services/voyage.service';
import {
  BookingSource,
  ReservationVoyageResponse,
} from '../../../core/models/voyage.model';

interface ClientRow {
  passengerId: string;
  displayId: string;
  name: string;
  phone: string;
  bookings: number;
  voyagesCount: number;
  totalSpent: number;
  lastBooking: string;
  source: string;
  sourceLabel: string;
  clientStatus: string;
  clientStatusLabel: string;
}

/**
 * "Clients" page.
 *
 * Backend mapping: a single call to
 * GET /api/v1/voyages/organizer/reservations  returns every reservation
 * across every voyage of the current organizer. We group them by passenger
 * (manual phone if "Hors Moussefer", else passengerId) to derive the
 * client list shown in the dashboard.
 *
 * The previous implementation looped over each voyage (N+1) — fixed.
 */
@Component({
  selector: 'app-organizer-clients',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterLink, OrganizerSidebarComponent],
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.css'],
})
export class OrganizerClientsComponent implements OnInit {
  loading = true;
  clients: ClientRow[] = [];
  filtered: ClientRow[] = [];
  search = '';
  currentDate = '';
  agencyName = 'Bonjour Tunisia Tours';

  constructor(private voyageService: VoyageService) {}

  ngOnInit(): void {
    this.setCurrentDate();
    this.loadClients();
  }

  private setCurrentDate(): void {
    this.currentDate = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  loadClients(): void {
    this.loading = true;
    // Pull up to 500 reservations — paginate if/when the volume requires it.
    this.voyageService.getAllOrganizerReservations(undefined, 0, 500).subscribe({
      next: (page) => {
        const all = (page.content ?? []).filter((r) => r.status !== 'CANCELLED');
        this.clients = this.groupByClient(all);
        this.filtered = [...this.clients];
        this.loading = false;
      },
      error: () => {
        this.clients = [];
        this.filtered = [];
        this.loading = false;
      },
    });
  }

  /**
   * Group reservations by client. For platform bookings the key is the
   * passengerId; for manual bookings (Hors Moussefer) we key on the phone
   * number (the same person may not have a Moussefer account).
   */
  private groupByClient(reservations: ReservationVoyageResponse[]): ClientRow[] {
    const buckets = new Map<string, ReservationVoyageResponse[]>();
    for (const r of reservations) {
      const key =
        r.manualBooking && r.manualPassengerPhone
          ? 'm:' + r.manualPassengerPhone
          : 'p:' + r.passengerId;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(r);
    }

    return Array.from(buckets.entries())
      .map(([key, group]) => {
        const sorted = [...group].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        const confirmed = group.filter((r) => r.status === 'CONFIRMED');
        const uniqueVoyages = new Set(group.map((r) => r.voyageId)).size;
        const first = sorted[0];

        const source = this.deriveSource(group);
        const status = this.deriveStatus(group.length, confirmed.length);

        return {
          passengerId: key.slice(2),
          displayId: (key.slice(2).slice(-4) || '0000').toUpperCase(),
          name: this.getPassengerName(first),
          phone: this.getPassengerPhone(first),
          bookings: group.length,
          voyagesCount: uniqueVoyages,
          totalSpent: confirmed.reduce((s, r) => s + (r.totalPrice ?? 0), 0),
          lastBooking: first.createdAt,
          source: source.type,
          sourceLabel: source.label,
          clientStatus: status.type,
          clientStatusLabel: status.label,
        };
      })
      .sort((a, b) => b.bookings - a.bookings);
  }

  private getPassengerName(r: ReservationVoyageResponse): string {
    if (r.manualPassengerName) return r.manualPassengerName;
    return 'Passager #' + (r.passengerId || '').slice(-4);
  }

  private getPassengerPhone(r: ReservationVoyageResponse): string {
    return r.manualPassengerPhone || '—';
  }

  /**
   * Use the most "recent" non-PLATFORM source if any, falling back to
   * Moussefer. The mapping matches the backend BookingSource enum.
   */
  private deriveSource(reservations: ReservationVoyageResponse[]): {
    type: string;
    label: string;
  } {
    for (const r of reservations) {
      switch (r.bookingSource) {
        case BookingSource.PHONE:
          return { type: 'telephone', label: 'Téléphone' };
        case BookingSource.AGENCY:
          return { type: 'agence', label: 'Agence' };
        case BookingSource.DIRECT:
          return { type: 'direct', label: 'Direct' };
      }
    }
    return { type: 'moussefer', label: 'Moussefer' };
  }

  private deriveStatus(
    totalBookings: number,
    confirmedBookings: number,
  ): { type: string; label: string } {
    if (confirmedBookings >= 4) return { type: 'fidele', label: 'Fidèle' };
    if (confirmedBookings >= 2) return { type: 'regulier', label: 'Régulier' };
    return { type: 'nouveau', label: 'Nouveau' };
  }

  onSearch(): void {
    const q = this.search.toLowerCase().trim();
    if (!q) {
      this.filtered = [...this.clients];
      return;
    }
    this.filtered = this.clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.passengerId.toLowerCase().includes(q) ||
        c.displayId.toLowerCase().includes(q),
    );
  }
}
