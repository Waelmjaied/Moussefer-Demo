import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService, UserProfile } from '../../../core/services/admin.service';
import { SharedModule } from '../../shared/shared.module';
import { ToastService } from '../../../core/services/toast.service';
import { CommonModule } from '@angular/common';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';

@Component({
  selector: 'app-suspend-modal',
  standalone: true,
  imports: [CommonModule, SharedModule, AdminSidebarComponent],
  templateUrl: './suspend-modal.component.html',
  styleUrls: ['./suspend-modal.component.css'],
})
export class SuspendModalComponent {
  @Input() user: UserProfile | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() suspended = new EventEmitter<void>();

  suspendForm: FormGroup;
  submitting = false;
  suspensionEndDate: Date | null = null;

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private toast: ToastService,
  ) {
    this.suspendForm = this.fb.group({
      reason: ['', Validators.required],
      durationDays: [7, [Validators.required, Validators.min(1)]],
    });
    // Initialize preview end date
    this.updateEndDate();
  }

  updateEndDate(): void {
    const days = this.suspendForm.get('durationDays')?.value;
    if (days && days > 0) {
      const end = new Date();
      end.setDate(end.getDate() + days);
      this.suspensionEndDate = end;
    } else {
      this.suspensionEndDate = null;
    }
  }

  onSubmit(): void {
    if (!this.user || this.suspendForm.invalid) return;
    this.submitting = true;
    const { reason, durationDays } = this.suspendForm.value;
    this.adminService.suspendUser(this.user.userId, reason, durationDays).subscribe({
      next: () => {
        this.suspended.emit();
        this.close.emit();
      },
      error: (err) => {
        this.toast.error(err.message || "Erreur lors de l'opération");
        this.submitting = false;
      },
      complete: () => (this.submitting = false),
    });
  }
}
