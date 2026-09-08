// Cible : src/app/modules/admin/litiges/litiges.component.ts
// FIX #2 (admin wiring) :
//   - getLitiges('PENDING') → getLitiges('OPEN') (backend enum n'a pas PENDING)
//   - handleAction branché sur assignLitige / updateLitigeStatus (qui existaient déjà)
//   - console.log retiré

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

interface LitigeAction {
  label: string;
  icon?: string;
  type: string;
  variant?: string;
}

interface LitigeHistory {
  text: string;
  user?: string;
  type: string;
}

interface Litige {
  id: string;
  priority: string;
  title: string;
  timeAgo: string;
  description: string;
  route: string;
  amount: string;
  amountLabel?: string;
  amountColor?: string;
  extraValue: string;
  extraLabel?: string;
  extraColor?: string;
  status: string;
  statusLabel?: string;
  statusColor?: string;
  history: LitigeHistory[];
  actions: {
    primary: LitigeAction[];
    secondary: LitigeAction[];
    ghost: LitigeAction[];
  };
}

@Component({
  selector: 'app-litiges',
  standalone: true,
  imports: [CommonModule, AdminSidebarComponent],
  templateUrl: './litiges.component.html',
  styleUrls: ['./litiges.component.css'],
})
export class LitigesComponent implements OnInit {
  currentDate = '';
  pendingLitiges = 0;
  litiges: Litige[] = [];

  constructor(
    private adminService: AdminService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.setDate();
    this.loadLitiges();
  }

  setDate(): void {
    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    this.currentDate = new Date().toLocaleDateString('fr-FR', opts);
  }

  loadLitiges(): void {
    // ▶︎ FIX #2 : statut backend valide = OPEN (PENDING n'existe pas dans
    //   DisputeStatus.java → ancien appel renvoyait HTTP 500).
    this.adminService
      .getLitiges('OPEN')
      .pipe(catchError(() => of([])))
      .subscribe({
        next: (data) => {
          this.litiges = this.mapLitiges(data);
          this.pendingLitiges = this.litiges.length;
        },
        error: () => {
          this.litiges = [];
          this.pendingLitiges = 0;
        },
      });
  }

  private mapLitiges(data: any[]): Litige[] {
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      id: item.id ?? item.litigeId ?? '',
      priority: item.priority ?? item.urgency ?? 'OUVERT',
      title: item.title ?? item.subject ?? '',
      timeAgo: item.timeAgo ?? item.createdAt ?? '',
      description: item.description ?? '',
      route: item.route ?? item.itineraire ?? '',
      amount: item.amount ?? '',
      amountLabel: item.amountLabel,
      amountColor: item.amountColor,
      extraValue: item.extraValue ?? item.extra ?? '',
      extraLabel: item.extraLabel,
      extraColor: item.extraColor,
      status: item.transactionStatus ?? item.status ?? '',
      statusLabel: item.statusLabel,
      statusColor: item.statusColor,
      history: Array.isArray(item.history) ? item.history : [],
      actions: {
        primary: (item.actions?.primary ?? []).map((a: any) => ({
          label: a.label,
          icon: a.icon,
          type: a.type,
          variant: a.variant || this.inferVariant(a.type),
        })),
        secondary: (item.actions?.secondary ?? []).map((a: any) => ({
          label: a.label,
          icon: a.icon,
          type: a.type,
          variant: a.variant || this.inferVariant(a.type),
        })),
        ghost: (item.actions?.ghost ?? []).map((a: any) => ({
          label: a.label,
          icon: a.icon,
          type: a.type,
          variant: 'ghost',
        })),
      },
    }));
  }

  inferVariant(type: string): string {
    const map: Record<string, string> = {
      refund: 'green',
      indemnify: 'green',
      suspend: 'outline-red',
      verify: 'outline-blue',
      view: 'blue',
      contact: 'ghost',
      close: 'ghost',
    };
    return map[type] || 'default';
  }

  getPriorityClass(priority: string): string {
    return 'tag-' + priority.toLowerCase().replace(/\s+/g, '-');
  }

  /**
   * ▶︎ FIX #2 : action handler branché sur les vrais endpoints backend.
   *   Mapping action.type → opération :
   *     - assign        → POST /disputes/{id}/assign (s'attribue le litige)
   *     - refund        → resolve avec outcome=RESOLVED
   *     - indemnify     → resolve avec outcome=RESOLVED + note "indemnisation"
   *     - reject        → resolve avec outcome=REJECTED
   *     - close         → resolve avec outcome=CLOSED
   *     - suspend / verify / view / contact → action UI uniquement
   */
  handleAction(litige: Litige, action: LitigeAction): void {
    switch (action.type) {
      case 'assign':
        this.adminService.assignLitige(litige.id).subscribe({
          next: () => {
            this.toast.success('Litige assigné.');
            this.loadLitiges();
          },
          error: (err) => this.toast.error(err.error?.message || "Erreur lors de l'assignation."),
        });
        break;

      case 'refund':
        if (!confirm('Confirmer le remboursement et clôturer le litige ?')) return;
        this.adminService
          .updateLitigeStatus(litige.id, 'RESOLVED', 'Remboursement effectué')
          .subscribe({
            next: () => {
              this.toast.success('Litige résolu (remboursement).');
              this.loadLitiges();
            },
            error: (err) => this.toast.error(err.error?.message || 'Erreur.'),
          });
        break;

      case 'indemnify':
        if (!confirm("Confirmer l'indemnisation et clôturer le litige ?")) return;
        this.adminService
          .updateLitigeStatus(litige.id, 'RESOLVED', 'Indemnisation accordée')
          .subscribe({
            next: () => {
              this.toast.success('Litige résolu (indemnisation).');
              this.loadLitiges();
            },
            error: (err) => this.toast.error(err.error?.message || 'Erreur.'),
          });
        break;

      case 'reject': {
        const reason = prompt('Motif du rejet du litige :') || '';
        if (!reason.trim()) return;
        this.adminService.updateLitigeStatus(litige.id, 'REJECTED', reason).subscribe({
          next: () => {
            this.toast.success('Litige rejeté.');
            this.loadLitiges();
          },
          error: (err) => this.toast.error(err.error?.message || 'Erreur.'),
        });
        break;
      }

      case 'close':
        if (!confirm('Clôturer ce litige sans résolution ?')) return;
        this.adminService
          .updateLitigeStatus(litige.id, 'CLOSED', 'Clôturé administrativement')
          .subscribe({
            next: () => {
              this.toast.success('Litige clôturé.');
              this.loadLitiges();
            },
            error: (err) => this.toast.error(err.error?.message || 'Erreur.'),
          });
        break;

      case 'view':
      case 'contact':
      case 'verify':
      case 'suspend':
        // Actions UI — à brancher selon ton flux (navigation, modale...)
        this.toast.info(`Action "${action.label}" — UI à implémenter.`);
        break;

      default:
        this.toast.info(`Action "${action.type}" inconnue.`);
    }
  }
}
