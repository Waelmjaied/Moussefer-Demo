import { Component, Input, Output, EventEmitter } from '@angular/core';
import { AdminService, UserProfile } from '../../../core/services/admin.service';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  standalone: true,
  selector: 'app-verify-modal',
  templateUrl: './verify-modal.component.html',
  styleUrls: ['./verify-modal.component.css'],
  imports: [AdminSidebarComponent],
})
export class VerifyModalComponent {
  @Input() user: UserProfile | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() verified = new EventEmitter<void>();

  submitting = false;

  constructor(
    private adminService: AdminService,
    private toast: ToastService,
  ) {}

  setVerified(verified: boolean): void {
    if (!this.user) return;
    this.submitting = true;
    this.adminService.verifyUser(this.user.userId, verified).subscribe({
      next: () => {
        this.verified.emit();
        this.close.emit();
      },
      error: (err) => {
        this.toast.error(err.message || "Erreur lors de l'opération");
      },
      complete: () => (this.submitting = false),
    });
  }
}
