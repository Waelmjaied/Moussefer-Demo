import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  showPassword = false;

  /* ── failed-attempts / ban state ── */
  failedAttempts = 0;
  isBanned = false;
  banSecondsRemaining = 0;
  private banTimer: any = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
    private toast: ToastService,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      console.log('[Login] Form invalid:', this.loginForm.errors);
      return;
    }

    if (this.isBanned) {
      this.toast.error(
        `Compte temporairement bloqué. Réessayez dans ${this.banSecondsRemaining}s.`,
      );
      return;
    }

    this.loading = true;
    console.log('[Login] Submitting:', this.loginForm.value);

    this.authService.login(this.loginForm.value).subscribe({
      next: (response) => {
        console.log('[Login] Success, role:', response.role);
        this.failedAttempts = 0; // reset on success
        this.clearBan();
        const role = response.role;

        if (role === 'DRIVER') {
          this.redirectDriverByKyc();
        } else if (role === 'ORGANIZER') {
          this.router.navigate(['/organizer/my-voyages']);
        } else if (role === 'ADMIN') {
          this.router.navigate(['/admin/users']);
        } else {
          this.router.navigate(['/passenger/search']);
        }
      },
      error: (err) => {
        console.error('[Login] Error:', err);
        const status = err.status;
        const msg = err.error?.message || 'Email ou mot de passe incorrect';

        if (
          status === 429 ||
          msg.toLowerCase().includes('banned') ||
          msg.toLowerCase().includes('bloqué')
        ) {
          // Backend returned a ban / rate-limit response
          this.isBanned = true;
          this.banSecondsRemaining = 15 * 60; // 15 minutes fallback
          this.startBanTimer();
          this.toast.error(`Trop de tentatives échouées. Compte bloqué pendant 15 minutes.`);
        } else {
          this.failedAttempts++;
          const remaining = Math.max(0, 5 - this.failedAttempts);
          if (remaining > 0) {
            this.toast.error(
              `${msg} — Tentative ${this.failedAttempts}/5. Il vous reste ${remaining} essai${remaining > 1 ? 's' : ''}.`,
            );
          } else {
            // 5th failed attempt → trigger local ban mirror
            this.isBanned = true;
            this.banSecondsRemaining = 15 * 60;
            this.startBanTimer();
            this.toast.error(`Trop de tentatives échouées. Compte bloqué pendant 15 minutes.`);
          }
        }

        this.loading = false;
      },
    });
  }

  /** Formats the remaining ban time as mm:ss */
  get banCountdown(): string {
    const m = Math.floor(this.banSecondsRemaining / 60)
      .toString()
      .padStart(2, '0');
    const s = (this.banSecondsRemaining % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  private startBanTimer(): void {
    this.clearBanTimer();
    this.banTimer = setInterval(() => {
      this.banSecondsRemaining--;
      if (this.banSecondsRemaining <= 0) {
        this.clearBan();
      }
    }, 1000);
  }

  private clearBan(): void {
    this.isBanned = false;
    this.failedAttempts = 0;
    this.clearBanTimer();
  }

  private clearBanTimer(): void {
    if (this.banTimer) {
      clearInterval(this.banTimer);
      this.banTimer = null;
    }
  }

  /**
   * Driver post-login routing:
   *  - VERIFIED  → /driver/publish      (ready to publish trips)
   *  - anything  → /driver/documents    (must complete KYC inscription first)
   *
   * On a profile fetch error we default to the documents page — safer than
   * dropping them on a screen that assumes a complete profile.
   */
  private redirectDriverByKyc(): void {
    this.userService.getMyProfile().subscribe({
      next: (profile) => {
        if (profile?.verificationStatus === 'VERIFIED') {
          this.router.navigate(['/driver/publish']);
        } else {
          this.router.navigate(['/driver/documents']);
        }
      },
      error: (err) => {
        console.warn('[Login] Profile fetch failed, falling back to /driver/documents', err);
        this.router.navigate(['/driver/documents']);
      },
    });
  }
}
