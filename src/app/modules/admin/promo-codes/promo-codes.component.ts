import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AdminPromoCodeService } from '../../../core/services/admin-promo-code.service';
import { AdminService } from '../../../core/services/admin.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';
import { catchError } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';

interface PromoCodeRow {
  id: string;
  displayId: string;
  code: string;
  typeLabel: string;
  value: string;
  usedCount: number;
  usageLimit: number;
  expiryDate: string;
  status: string;
  statusLabel: string;
  statusClass: string;
  active: boolean;
  discountType: string;
  discountValue: number;
  validUntil: string;
  description: string;
}

@Component({
  selector: 'app-promo-codes',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AdminSidebarComponent],
  templateUrl: './promo-codes.component.html',
  styleUrls: ['./promo-codes.component.css'],
})
export class PromoCodesComponent implements OnInit {
  currentDate = '';

  codes: PromoCodeRow[] = [];
  filteredCodes: PromoCodeRow[] = [];
  loading = true;
  searchQuery = '';

  activeTab = 'all';
  tabs = [
    { label: 'Tous', value: 'all' },
    { label: 'Actifs', value: 'active' },
    { label: 'Suspendus', value: 'suspended' },
    { label: 'Expirés', value: 'expired' },
    { label: 'Complets', value: 'completed' },
  ];

  // Sidebar stats
  loyaltyStats = { distributed: 0, used: 0 };
  trackingStats = {
    createdThisMonth: 0,
    active: 0,
    expired: 0,
    savings: 0,
    revenueImpact: 0,
  };

  // Modal
  showForm = false;
  editMode = false;
  selectedCodeId: string | null = null;
  promoForm: FormGroup;
  submitting = false;

  // Auto-generation words for promo codes
  private codeWords = [
    'SUMMER', 'WINTER', 'SPRING', 'FALL', 'RAMADAN', 'EID', 'NEWYEAR',
    'FLASH', 'MEGA', 'SUPER', 'HAPPY', 'LUCKY', 'GOLDEN', 'SPECIAL',
    'BONUS', 'EXTRA', 'VIP', 'PRO', 'MAX', 'ULTRA', 'ELITE', 'HOLIDAY',
    'WEEKEND', 'FAMILY', 'FRIEND', 'WELCOME', 'THANKS', 'EARLY', 'LAST',
    'FAST', 'QUICK', 'SMART', 'BRAVE', 'COOL',
  ];

  constructor(
    private promoService: AdminPromoCodeService,
    private adminService: AdminService,
    private fb: FormBuilder,
    public permissionService: PermissionService,
    private toast: ToastService,
  ) {
    this.promoForm = this.fb.group({
      code: [''],
      discountType: ['PERCENTAGE', Validators.required],
      discountValue: [0, [Validators.required, Validators.min(0)]],
      validUntil: ['', Validators.required],
      usageLimit: [1000, [Validators.min(1)]],
      active: [true],
      description: [''],
    });
  }

  ngOnInit(): void {
    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    this.currentDate = new Date().toLocaleDateString('fr-FR', opts);
    this.loadData();
  }

  /* ═════════════════════════════════════════════════════
     AUTO GENERATE PROMO CODE
     ═════════════════════════════════════════════════════ */
  autoGenerateCode(): string {
    const word = this.codeWords[Math.floor(Math.random() * this.codeWords.length)];
    const num = Math.floor(Math.random() * 90) + 10;
    return `${word}${num}`;
  }

  regenerateCode(): void {
    const newCode = this.autoGenerateCode();
    this.promoForm.patchValue({ code: newCode });
  }

  /* ═════════════════════════════════════════════════════
     CHARGEMENT DES DONNÉES
     ═════════════════════════════════════════════════════ */
  loadData(): void {
    this.loading = true;
    forkJoin({
      promos: this.promoService.getAll().pipe(catchError((err) => {
        console.error('❌ ERREUR getAll promos:', err);
        return of([]);
      })),
      loyalty: this.adminService.getUsersStats().pipe(catchError((err) => {
        console.error('❌ ERREUR stats:', err);
        return of(null);
      })),
    }).subscribe({
      next: ({ promos, loyalty }) => {
        console.log('✅ Promos reçus:', promos);
        console.log('✅ Nombre de promos:', promos?.length);
        this.mapLoyalty(loyalty);
        this.mapCodes(promos);
        this.computeTrackingStats();
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('❌ ERREUR forkJoin global:', err);
        this.loading = false;
        this.codes = [];
        this.filteredCodes = [];
      },
    });
  }

  private mapLoyalty(data: any): void {
    if (data) {
      this.loyaltyStats.distributed = Math.floor(
        (data.loyaltyPointsDistributed ?? data.totalLoyaltyPoints ?? 0) / 1000,
      );
      this.loyaltyStats.used = Math.floor(
        (data.loyaltyPointsUsed ?? data.redeemedPoints ?? 0) / 1000,
      );
    }
  }

  private mapCodes(data: any[]): void {
    const raw = Array.isArray(data) ? data : [];

    if (raw.length === 0) {
      console.warn('⚠️ Aucun code promo reçu de l\'API');
    }

    this.codes = raw.map((c: any) => {
      const used = c.usedCount ?? 0;
      const limit = c.maxUses ?? c.usageLimit ?? c.maxUsage ?? 1000;
      const expired = c.validUntil ? new Date(c.validUntil) < new Date() : false;
      const full = used >= limit;

      let status = 'active';
      let statusLabel = 'Actif';
      let statusClass = 'actif';

      if (!c.active) {
        status = 'suspended';
        statusLabel = 'Suspendu';
        statusClass = 'suspendu';
      } else if (expired) {
        status = 'expired';
        statusLabel = 'Expiré';
        statusClass = 'expire';
      } else if (full) {
        status = 'completed';
        statusLabel = 'Complet';
        statusClass = 'complet';
      }

      const isPercent = (c.discountType ?? 'PERCENTAGE') === 'PERCENTAGE';
      const value = isPercent ? `${c.discountValue}%` : `${c.discountValue} DT`;

      return {
        id: c.id ?? '',
        displayId: '#' + (c.id ?? 'P0000'),
        code: c.code ?? '',
        typeLabel: isPercent ? '%' : 'DT',
        value,
        usedCount: used,
        usageLimit: limit,
        expiryDate: c.validUntil ? this.formatDate(c.validUntil) : '—',
        status,
        statusLabel,
        statusClass,
        active: c.active && !expired && !full,
        discountType: c.discountType ?? 'PERCENTAGE',
        discountValue: Number(c.discountValue) ?? 0,
        validUntil: c.validUntil ?? '',
        description: c.description ?? '',
      };
    });
  }

  private formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private computeTrackingStats(): void {
    this.trackingStats.active = this.codes.filter((c) => c.status === 'active').length;
    this.trackingStats.expired = this.codes.filter((c) => c.status === 'expired').length;
    this.trackingStats.createdThisMonth = this.codes.length;

    const totalSavings = this.codes.reduce((s, c) => {
      const avgOrder = 18;
      const discount =
        c.discountType === 'PERCENTAGE' ? (avgOrder * c.discountValue) / 100 : c.discountValue;
      return s + discount * c.usedCount;
    }, 0);
    this.trackingStats.savings = -totalSavings;

    const totalRevenue = 124800;
    this.trackingStats.revenueImpact =
      totalRevenue > 0 ? -((totalSavings / totalRevenue) * 100) : 0;
    this.trackingStats.revenueImpact = Math.round(this.trackingStats.revenueImpact * 10) / 10;
  }

  setTab(tab: string): void {
    this.activeTab = tab;
    this.applyFilters();
  }

  applyFilters(): void {
    let filtered = this.codes;
    console.log('Codes avant filtre:', this.codes.length, '| Tab:', this.activeTab);

    if (this.activeTab !== 'all') {
      filtered = filtered.filter((c) => c.status === this.activeTab);
      console.log('Après filtre tab:', filtered.length);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) => c.code.toLowerCase().includes(q) || c.displayId.toLowerCase().includes(q),
      );
      console.log('Après filtre search:', filtered.length);
    }

    this.filteredCodes = filtered;
    console.log('Final filtered:', this.filteredCodes.length);
  }

  /* ═════════════════════════════════════════════════════
     CRUD - MODAL
     ═════════════════════════════════════════════════════ */
  openCreateForm(): void {
    this.editMode = false;
    this.selectedCodeId = null;
    const generatedCode = this.autoGenerateCode();
    this.promoForm.reset({
      code: generatedCode,
      discountType: 'PERCENTAGE',
      discountValue: 0,
      usageLimit: 1000,
      active: true,
      description: '',
    });
    this.showForm = true;
  }

  openEditForm(code: PromoCodeRow): void {
    this.editMode = true;
    this.selectedCodeId = code.id;
    this.promoForm.patchValue({
      code: code.code,
      discountType: code.discountType,
      discountValue: code.discountValue,
      validUntil: code.validUntil ? code.validUntil.split('T')[0] : '',
      usageLimit: code.usageLimit,
      active: code.active,
      description: code.description,
    });
    this.showForm = true;
  }

  cancelForm(): void {
    this.showForm = false;
    this.selectedCodeId = null;
  }

  closeModal(event?: MouseEvent): void {
    if (event && event.target !== event.currentTarget) return;
    this.cancelForm();
  }

  onSubmit(): void {
    if (this.promoForm.invalid) return;

    let codeValue = this.promoForm.value.code?.trim();
    if (!codeValue) {
      codeValue = this.autoGenerateCode();
      this.promoForm.patchValue({ code: codeValue });
    }

    this.submitting = true;

    const formValue = this.promoForm.value;
    const payload = {
      code: codeValue.toUpperCase(),
      discountType: formValue.discountType,
      discountValue: formValue.discountValue,
      validUntil: formValue.validUntil
        ? new Date(formValue.validUntil).toISOString()
        : undefined,
      maxUses: formValue.usageLimit,
      active: formValue.active,
      description: formValue.description,
    };

    const req$ =
      this.editMode && this.selectedCodeId
        ? this.promoService.update(this.selectedCodeId, payload)
        : this.promoService.create(payload);

    req$.subscribe({
      next: () => {
        this.toast.success(this.editMode ? 'Code modifié' : 'Code créé');
        this.loadData();
        this.cancelForm();
        this.submitting = false;
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Erreur');
        this.submitting = false;
      },
    });
  }

  /* ═════════════════════════════════════════════════════
     ACTIONS
     ═════════════════════════════════════════════════════ */
  toggleStatus(code: PromoCodeRow): void {
    const req$ = code.active
      ? this.promoService.deactivate(code.id)
      : this.promoService.activate(code.id);

    req$.subscribe({
      next: () => {
        this.toast.success(code.active ? 'Code suspendu' : 'Code activé');
        this.loadData();
      },
      error: (err) => this.toast.error(err.error?.message || 'Erreur'),
    });
  }

  deletePromoCode(id: string): void {
    if (!confirm('Supprimer ce code promo ?')) return;
    this.promoService.delete(id).subscribe({
      next: () => {
        this.toast.success('Code supprimé');
        this.loadData();
      },
      error: (err) => this.toast.error(err.error?.message || 'Erreur suppression'),
    });
  }
}
