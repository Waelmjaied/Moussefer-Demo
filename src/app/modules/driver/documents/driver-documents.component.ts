import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  DriverDocumentsService,
  KycStatus,
  DriverDocument,
} from '../../../core/services/driver-documents.service';
import { ToastService } from '../../../core/services/toast.service';
import { DriverSidebarComponent } from '../driver-sidebar/driver-sidebar.component';

/* ============================================
   STEP DEFINITIONS
   Each step maps to one backend DocumentType enum value, so what the
   driver uploads at /api/v1/drivers/documents is immediately accepted
   by Spring and shows up in the admin KYC queue.
   ============================================ */

interface StepDef {
  /** Backend DocumentType enum value, sent verbatim as `type` */
  type:
    | 'CIN'
    | 'DRIVING_LICENSE_FRONT'
    | 'DRIVING_LICENSE_BACK'
    | 'VEHICLE_PHOTO'
    | 'INSURANCE'
    | 'TECHNICAL_VISIT'
    | 'LOUAGE_AUTHORIZATION'
    | 'OTHER';
  label: string;
  description: string;
  icon: string;             // bootstrap-icons name (without 'bi-' prefix when used as class suffix)
  acceptedTypes: string;    // input[accept] value
  requiresExpiry: boolean;  // when true, stepForm.expiryDate becomes required
  expiryLabel?: string;
}

const STEPS: StepDef[] = [
  {
    type: 'CIN',
    label: "Carte d'Identité Nationale",
    description: 'Téléversez un scan clair et lisible de votre CIN (recto ou recto/verso).',
    icon: 'person-vcard',
    acceptedTypes: 'image/*,.pdf',
    requiresExpiry: false,
  },
  {
    type: 'DRIVING_LICENSE_FRONT',
    label: 'Permis de conduire (recto)',
    description: 'Scan du recto de votre permis de conduire.',
    icon: 'card-image',
    acceptedTypes: 'image/*,.pdf',
    requiresExpiry: false,
  },
  {
    type: 'DRIVING_LICENSE_BACK',
    label: 'Permis de conduire (verso)',
    description: 'Scan du verso de votre permis de conduire.',
    icon: 'card-image',
    acceptedTypes: 'image/*,.pdf',
    requiresExpiry: false,
  },
  {
    type: 'VEHICLE_PHOTO',
    label: 'Photo du Louage',
    description: 'Photo nette de votre véhicule avec la plaque visible.',
    icon: 'car-front',
    acceptedTypes: 'image/*',
    requiresExpiry: false,
  },
  {
    type: 'INSURANCE',
    label: 'Assurance véhicule',
    description: "Attestation d'assurance en cours de validité.",
    icon: 'shield-check',
    acceptedTypes: 'image/*,.pdf',
    requiresExpiry: true,
    expiryLabel: "Date d'expiration de l'assurance",
  },
  {
    type: 'TECHNICAL_VISIT',
    label: 'Visite technique',
    description: 'Rapport de visite technique en cours de validité.',
    icon: 'tools',
    acceptedTypes: 'image/*,.pdf',
    requiresExpiry: true,
    expiryLabel: "Date d'expiration de la visite technique",
  },
  {
    type: 'LOUAGE_AUTHORIZATION',
    label: 'Autorisation Louage',
    description: 'رخصة اللواج — document officiel de la licence de transport.',
    icon: 'file-earmark-check',
    acceptedTypes: 'image/*,.pdf',
    requiresExpiry: false,
  },
];

@Component({
  selector: 'app-driver-documents',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DriverSidebarComponent],
  templateUrl: './driver-documents.component.html',
  styleUrls: ['./driver-documents.component.css'],
})
export class DriverDocumentsComponent implements OnInit {
  constructor(
    private docService: DriverDocumentsService,
    private toast: ToastService,
    private fb: FormBuilder,
    private router: Router,
  ) {}

  /* ---------- Wizard state ---------- */
  readonly steps: StepDef[] = STEPS;
  currentStep = 0; // 0-indexed, must be `number` (not signal) because the template does `currentStep + 1` and `currentStep === i`

  /* ---------- UI state ---------- */
  loading = true;
  uploading = false;
  uploadError: string | null = null;

  /* ---------- Data from backend ---------- */
  kycStatus: KycStatus | null = null;
  documents: DriverDocument[] = [];

  /* ---------- Reactive form for the current step ---------- */
  stepForm!: FormGroup;

  /* ============================================
     LIFECYCLE
     ============================================ */
  ngOnInit(): void {
    this.initStepForm();
    this.applyStepValidators();
    this.loadAll();
  }

  private initStepForm(): void {
    this.stepForm = this.fb.group({
      file: [null as File | null, Validators.required],
      expiryDate: [null as string | null],
    });
  }

  /**
   * Toggle the `expiryDate` validator based on the current step.
   * Called every time we move to another step.
   */
  private applyStepValidators(): void {
    const expCtrl = this.stepForm.get('expiryDate');
    if (!expCtrl) return;
    if (this.currentStepDef?.requiresExpiry) {
      expCtrl.setValidators([Validators.required]);
    } else {
      expCtrl.clearValidators();
    }
    expCtrl.updateValueAndValidity({ emitEvent: false });
  }

  /* ============================================
     COMPUTED PROPERTIES (used by the HTML)
     ============================================ */

  /** The step the user is currently on. */
  get currentStepDef(): StepDef {
    return this.steps[this.currentStep] ?? this.steps[0];
  }

  /** Existing uploaded document for the current step, if any. */
  get currentStepDoc(): DriverDocument | undefined {
    const type = this.currentStepDef?.type;
    return this.documents.find((d) => d.documentType === type);
  }

  get isFirstStep(): boolean {
    return this.currentStep === 0;
  }

  get isLastStep(): boolean {
    return this.currentStep === this.steps.length - 1;
  }

  /**
   * Overall KYC completion progress, 0-100.
   * Counts any step whose document is already in the backend (any status
   * except 'missing'), so the progress bar advances as the driver
   * submits documents — even before the admin approves them.
   */
  get progressPercent(): number {
    if (!this.steps.length) return 0;
    const submitted = this.steps.filter((s) => this.getStepStatus(s.type) !== 'missing').length;
    return Math.round((submitted / this.steps.length) * 100);
  }

  /* ============================================
     DATA LOADING
     ============================================ */

  loadAll(): void {
    this.loading = true;
    this.docService.getMyDocuments().subscribe({
      next: (docs) => {
        this.documents = docs ?? [];
        this.loading = false;
      },
      error: (err) => {
        console.warn('[loadAll] getMyDocuments failed', err);
        this.documents = [];
        this.loading = false;
      },
    });
  }

  /* ============================================
     NAVIGATION
     ============================================ */

  /**
   * Move to a specific step by index. Accepts plain `number` because the
   * template iterates with `let i = index` and passes `i` (number) here.
   */
  goToStep(i: number): void {
    if (i < 0 || i >= this.steps.length) return;
    this.currentStep = i;
    this.uploadError = null;
    this.stepForm.reset();
    this.applyStepValidators();
  }

  prevStep(): void {
    this.goToStep(this.currentStep - 1);
  }

  nextStep(): void {
    this.goToStep(this.currentStep + 1);
  }

  /* ============================================
     FILE HANDLING (called from the input change event)
     ============================================ */

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.stepForm.patchValue({ file: null });
      return;
    }

    // Size cap matches backend MultipartFile config (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      this.uploadError = 'Fichier trop volumineux (max 10 MB).';
      this.stepForm.patchValue({ file: null });
      input.value = '';
      return;
    }

    // Type cap
    const allowedExt = /\.(png|jpe?g|pdf)$/i;
    if (!allowedExt.test(file.name)) {
      this.uploadError = 'Format non supporté. Utilisez PNG, JPG ou PDF.';
      this.stepForm.patchValue({ file: null });
      input.value = '';
      return;
    }

    this.uploadError = null;
    this.stepForm.patchValue({ file });
  }

  /* ============================================
     STATUS HELPERS (called from the HTML)
     ============================================ */

  /** What state is a step in, based on its existing backend document? */
  getStepStatus(type: string): 'missing' | 'pending' | 'approved' | 'rejected' | 'expired' {
    const doc = this.documents.find((d) => d.documentType === type);
    if (!doc) return 'missing';
    switch (doc.status) {
      case 'APPROVED':
        return 'approved';
      case 'PENDING_REVIEW':
      case 'PENDING' as any:
        return 'pending';
      case 'REJECTED':
        return 'rejected';
      case 'EXPIRED':
        return 'expired';
      default:
        return 'pending';
    }
  }

  /** Bootstrap-icons class string for a given step's status badge. */
  getStepStatusIcon(type: string): string {
    switch (this.getStepStatus(type)) {
      case 'approved':
        return 'bi-check-circle-fill text-success';
      case 'pending':
        return 'bi-hourglass-split text-warning';
      case 'rejected':
        return 'bi-x-circle-fill text-danger';
      case 'expired':
        return 'bi-exclamation-triangle-fill text-warning';
      default:
        return 'bi-circle text-muted';
    }
  }

  /** Human-readable label for a document status. */
  getDocStatusLabel(status: string): string {
    switch (status) {
      case 'APPROVED':
        return 'Validé';
      case 'PENDING_REVIEW':
      case 'PENDING':
        return 'En attente';
      case 'REJECTED':
        return 'Refusé';
      case 'EXPIRED':
        return 'Expiré';
      default:
        return status;
    }
  }

  /* ============================================
     UPLOAD CURRENT STEP
     Sends the file + (optional) expiry to the backend. The `type` is the
     backend enum value coming straight from `currentStepDef.type`, so
     Spring accepts it without any mapping layer.
     ============================================ */

  uploadCurrentStep(): void {
    if (this.uploading) return;

    if (this.stepForm.invalid) {
      this.stepForm.markAllAsTouched();
      this.uploadError = this.currentStepDef.requiresExpiry
        ? "Sélectionnez un fichier et renseignez la date d'expiration."
        : 'Sélectionnez un fichier à téléverser.';
      return;
    }

    const file: File = this.stepForm.value.file;
    const expiry: string | undefined = this.currentStepDef.requiresExpiry
      ? this.stepForm.value.expiryDate || undefined
      : undefined;
    const backendType = this.currentStepDef.type;

    this.uploading = true;
    this.uploadError = null;

    console.log(`[uploadCurrentStep] uploading type=${backendType}`,
      { fileName: file.name, size: file.size, expiry });

    this.docService.uploadDocument(backendType, file, expiry).subscribe({
      next: () => {
        this.uploading = false;
        this.toast.success(
          `${this.currentStepDef.label} soumis — en attente de validation par l'administration.`,
        );
        this.stepForm.reset();
        this.loadAll();
        // Auto-advance unless this is the final step.
        if (!this.isLastStep) {
          setTimeout(() => this.nextStep(), 700);
        }
      },
      error: (err) => {
        this.uploading = false;
        this.uploadError = err?.error?.message || err?.message || "Erreur lors de l'upload.";
        console.error('[uploadCurrentStep] failed', err);
        this.toast.error(this.uploadError || 'Erreur upload');
      },
    });
  }

  /* ============================================
     FINISH (last step button)
     The actual document submissions have already happened step by step,
     so this just wraps up the wizard and sends the driver to their
     profile where the KYC status is displayed.
     ============================================ */

  finish(): void {
    this.toast.success('Dossier complet ! En attente de validation par l\'administration.');
    setTimeout(() => this.router.navigate(['/driver/Settings']), 1500);
  }

  /* ============================================
     UTILITIES
     ============================================ */

  formatDate(iso?: string | null): string {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return iso ?? '';
    }
  }

  formatFileSize(bytes?: number | null): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
