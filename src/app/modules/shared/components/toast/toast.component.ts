import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div *ngFor="let t of toastService.toasts$ | async" class="toast-item toast-{{ t.type }}">
        <span class="toast-icon">{{ icons[t.type] }}</span>
        <span class="toast-msg">{{ t.message }}</span>
      </div>
    </div>
  `,
  styles: [
    `
      .toast-container {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      }
      .toast-item {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 260px;
        max-width: 380px;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        animation: slideIn 0.25s ease;
      }
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateX(40px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      .toast-success {
        background: #1d9e75;
        color: #fff;
      }
      .toast-error {
        background: #e24b4a;
        color: #fff;
      }
      .toast-info {
        background: #185fa5;
        color: #fff;
      }
      .toast-warning {
        background: #ba7517;
        color: #fff;
      }
      .toast-icon {
        font-size: 17px;
        flex-shrink: 0;
      }
    `,
  ],
})
export class ToastComponent {
  icons: Record<string, string> = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  };
  constructor(public toastService: ToastService) {}
}
