import { Component, Input, Output, EventEmitter } from '@angular/core';
import { UserProfile, AdminService } from '../../../core/services/admin.service';
import { DatePipe, NgIf } from '@angular/common';
import { SharedModule } from '../../shared/shared.module';
import { PermissionService } from '../../../core/services/permission.service';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  standalone: true,
  selector: 'app-user-detail-modal',
  templateUrl: './user-detail-modal.component.html',
  styleUrls: ['./user-detail-modal.component.css'],
  imports: [DatePipe, NgIf, SharedModule, AdminSidebarComponent],
})
export class UserDetailModalComponent {
  @Input() user: UserProfile | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  assignAdminRoleValue: string = '';
  loyaltyPoints: any = null;

  constructor(
    private adminService: AdminService,
    public permissionService: PermissionService,
    private toast: ToastService,
  ) {}

  loadLoyaltyPoints(): void {
    if (!this.user) return;
    this.adminService.getUserLoyaltyPoints(this.user.userId).subscribe({
      next: (data) => (this.loyaltyPoints = data),
      error: () => this.toast.error('Impossible de charger les points'),
    });
  }

  assignAdminRole(): void {
    if (!this.user || !this.assignAdminRoleValue) return;

    this.adminService.assignAdminRole(this.user.userId, this.assignAdminRoleValue).subscribe({
      next: () => {
        this.toast.success('Rôle administrateur attribué avec succès');
        this.updated.emit();
        this.close.emit();
      },
      error: (err) => {
        // The second argument 'Erreur' is accepted by your ToastService.error method (even if unused)
        this.toast.error(err.error?.message || "Erreur lors de l'attribution du rôle");
      },
    });
  }
}
