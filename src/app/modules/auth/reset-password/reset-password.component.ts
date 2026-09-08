import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
// import { ToastService } from '../../../core/services/toast.service'; // <-- ADAPTE ICI

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const p = control.get('newPassword')?.value;
  const c = control.get('confirmPassword')?.value;
  return p && c && p !== c ? { mismatch: true } : null;
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css'],
})
export class ResetPasswordComponent implements OnInit {
  form: FormGroup;
  loading = false;
  done = false;
  token = '';
  tokenMissing = false;
  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private toast: ToastService,
  ) {
    this.form = this.fb.group(
      {
        newPassword: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: passwordsMatch },
    );
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.tokenMissing = true;
      this.toast.error('Code de vérification manquant ou invalide.');
    }
  }

  get passwordStrength(): number {
    const pwd = this.form.get('newPassword')?.value || '';
    let score = 0;
    if (pwd.length > 0) score += 10;
    if (pwd.length >= 8) score += 25;
    if (/[A-Z]/.test(pwd)) score += 20;
    if (/[a-z]/.test(pwd)) score += 15;
    if (/[0-9]/.test(pwd)) score += 20;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 10;
    return Math.min(score, 100);
  }

  get strengthLabel(): string {
    const s = this.passwordStrength;
    if (s < 30) return 'Faible';
    if (s < 60) return 'Moyen';
    if (s < 80) return 'Bon';
    return 'Excellent';
  }

  get strengthColor(): string {
    const s = this.passwordStrength;
    if (s < 30) return '#ef4444';
    if (s < 60) return '#f59e0b';
    if (s < 80) return '#3b82f6';
    return '#10b981';
  }

  onSubmit(): void {
    if (this.form.invalid || !this.token) return;
    this.loading = true;
    this.authService.resetPassword(this.token, this.form.value.newPassword).subscribe({
      next: () => {
        this.done = true;
        this.loading = false;
        this.toast.success('Mot de passe réinitialisé avec succès !');
        setTimeout(() => this.router.navigate(['/auth/login']), 3000);
      },
      error: (err) => {
        this.loading = false;
        const msg = err.error?.message || 'Code invalide ou expiré. Veuillez recommencer.';
        this.toast.error(msg);
      },
    });
  }
}
