import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
// import { ToastService } from '../../../core/services/toast.service'; // <-- ADAPTE ICI

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css'],
})
export class ForgotPasswordComponent {
  step: 'email' | 'code' = 'email';
  emailForm: FormGroup;
  codeForm: FormGroup;
  loading = false;
  userEmail = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toast: ToastService,
  ) {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });

    this.codeForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
  }

  onSubmitEmail(): void {
    if (this.emailForm.invalid) return;
    this.loading = true;
    this.userEmail = this.emailForm.value.email;

    this.authService.forgotPassword(this.userEmail).subscribe({
      next: () => {
        this.step = 'code';
        this.loading = false;
        // this.toast.success('Code envoyé ! Vérifiez votre boîte mail.');
      },
      error: () => {
        // Sécurité : on avance quand même pour ne pas révéler les emails existants
        this.step = 'code';
        this.loading = false;
      },
    });
  }

  onSubmitCode(): void {
    if (this.codeForm.invalid) return;
    const code = this.codeForm.value.code;
    // Le code 6 chiffres est passé comme token à la page reset
    this.router.navigate(['/auth/reset-password'], {
      queryParams: { token: code },
    });
  }

  resendCode(): void {
    this.loading = true;
    this.authService.forgotPassword(this.userEmail).subscribe({
      next: () => {
        this.loading = false;
        this.toast.success('Un nouveau code a été envoyé.');
      },
      error: () => {
        this.loading = false;
        this.toast.error("Échec de l'envoi. Réessayez.");
      },
    });
  }
}
