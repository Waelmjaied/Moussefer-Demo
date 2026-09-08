import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AdminBannerService } from '../../../core/services/admin-banner.service';
import { AdminService } from '../../../core/services/admin.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';
import { catchError } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';

interface BannerRow {
  id: string;
  title: string;
  previewText: string;
  imageUrl: string;
  subtitle: string;
  status: string;
  statusLabel: string;
  statusClass: string;
  pageLabel: string;
  pageClass: string;
  impressions: number;
  clicks: number;
  ctr: string;
  redirectUrl: string;
  active: boolean;
  startsAt?: string;
  endsAt?: string;
}

@Component({
  selector: 'app-banners',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AdminSidebarComponent],
  templateUrl: './banners.component.html',
  styleUrls: ['./banners.component.css'],
})
export class BannersComponent implements OnInit {
  currentDate = '';

  banners: BannerRow[] = [];
  filteredBanners: BannerRow[] = [];
  loading = true;
  searchQuery = '';

  activeTab = 'all';
  tabs = [
    { label: 'Toutes', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'En attente', value: 'pending' },
    { label: 'Expirées', value: 'expired' },
  ];

  showForm = false;
  editMode = false;
  selectedBannerId: string | null = null;
  bannerForm: FormGroup;
  submitting = false;

  /* ── Image upload ── */
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  uploadingImage = false;

  constructor(
    private fb: FormBuilder,
    private bannerService: AdminBannerService,
    private adminService: AdminService,
    public permissionService: PermissionService,
    private toast: ToastService,
  ) {
    this.bannerForm = this.fb.group({
      title: ['', Validators.required],
      previewText: ['', Validators.required],
      redirectUrl: ['', [Validators.required, Validators.pattern(/^https?:\/.+/)]],
      pageLabel: ["Page d'accueil"],
      startsAt: [''],
      endsAt: [''],
      targetAudience: ['ALL'],
      active: [true],
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
    this.loadBanners();
  }

  loadBanners(): void {
    this.loading = true;
    this.bannerService
      .getAll()
      .pipe(catchError(() => of([])))
      .subscribe({
        next: (data: any[]) => {
          const raw = Array.isArray(data) ? data : [];
          if (raw.length > 0) {
            const stats$ = raw.map((b: any) =>
              this.adminService.getBannerStats(b.id ?? b.bannerId).pipe(catchError(() => of(null))),
            );
            forkJoin(stats$).subscribe({
              next: (statsArray) => {
                this.banners = raw.map((b: any, idx: number) => this.mapBanner(b, statsArray[idx]));
                this.applyFilters();
                this.loading = false;
              },
              error: () => {
                this.banners = raw.map((b: any) => this.mapBanner(b, null));
                this.applyFilters();
                this.loading = false;
              },
            });
          } else {
            this.banners = [];
            this.filteredBanners = [];
            this.loading = false;
          }
        },
        error: () => {
          this.loading = false;
          this.banners = [];
          this.filteredBanners = [];
        },
      });
  }

  private mapBanner(b: any, stats: any): BannerRow {
    const now = new Date();
    const start = b.startsAt ? new Date(b.startsAt) : null;
    const end = b.endsAt ? new Date(b.endsAt) : null;
    let status = 'active';
    let statusLabel = 'Active';
    let statusClass = 'active';

    if (!b.active) {
      status = 'expired';
      statusLabel = 'Expiré';
      statusClass = 'expired';
    } else if (start && start > now) {
      status = 'pending';
      statusLabel = 'En attente';
      statusClass = 'pending';
    } else if (end && end < now) {
      status = 'expired';
      statusLabel = 'Expiré';
      statusClass = 'expired';
    }

    const page = b.pageLabel ?? b.page ?? "Page d'accueil";
    const pageClass = page.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '').replace(/é/g, 'e');

    const impressions = stats?.impressions ?? stats?.views ?? 0;
    const clicks = stats?.clicks ?? 0;
    const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : '0.0';

    return {
      id: b.id ?? b.bannerId ?? '',
      title: b.title ?? 'Sans titre',
      previewText: b.previewText ?? b.title ?? 'Bannière',
      imageUrl: b.imageUrl ?? b.image ?? b.color ?? '',
      subtitle: `${page} · ${this.formatDate(b.startsAt)} – ${this.formatDate(b.endsAt)}`,
      status,
      statusLabel,
      statusClass,
      pageLabel: page,
      pageClass,
      impressions,
      clicks,
      ctr,
      redirectUrl: b.redirectUrl ?? b.link ?? '',
      active: b.active ?? false,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
    };
  }

  private formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  setTab(tab: string): void {
    this.activeTab = tab;
    this.applyFilters();
  }

  applyFilters(): void {
    let filtered = this.banners;
    if (this.activeTab !== 'all') {
      filtered = filtered.filter((b) => b.status === this.activeTab);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (b) => b.title.toLowerCase().includes(q) || b.previewText.toLowerCase().includes(q),
      );
    }
    this.filteredBanners = filtered;
  }

  /* ── Image upload handlers ── */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  removeImage(): void {
    this.selectedFile = null;
    this.imagePreview = null;
  }

  /* ── Form ── */
  openCreateForm(): void {
    this.editMode = false;
    this.selectedBannerId = null;
    this.selectedFile = null;
    this.imagePreview = null;
    this.bannerForm.reset({
      pageLabel: "Page d'accueil",
      targetAudience: 'ALL',
      active: true,
    });
    this.showForm = true;
  }

  openEditForm(b: BannerRow): void {
    this.editMode = true;
    this.selectedBannerId = b.id;
    this.selectedFile = null;
    this.imagePreview = b.imageUrl || null;
    this.bannerForm.patchValue({
      title: b.title,
      previewText: b.previewText,
      redirectUrl: b.redirectUrl,
      pageLabel: b.pageLabel,
      startsAt: b.startsAt ? b.startsAt.split('T')[0] : '',
      endsAt: b.endsAt ? b.endsAt.split('T')[0] : '',
      active: b.active,
    });
    this.showForm = true;
  }

  cancelForm(): void {
    this.showForm = false;
    this.selectedBannerId = null;
    this.selectedFile = null;
    this.imagePreview = null;
  }

  closeModal(event?: MouseEvent): void {
    if (event && event.target !== event.currentTarget) return;
    this.cancelForm();
  }

  onSubmit(): void {
    if (this.bannerForm.invalid) return;

    // If a new image was selected, upload it first
    if (this.selectedFile) {
      this.uploadingImage = true;
      this.bannerService.uploadImage(this.selectedFile).subscribe({
        next: (res: any) => {
          this.uploadingImage = false;
          const imageUrl = res.imageUrl ?? res.url ?? res.fileUrl ?? '';
          this.saveBanner(imageUrl);
        },
        error: (err: any) => {
          this.uploadingImage = false;
          this.toast.error(err.error?.message || "Erreur lors de l'upload de l'image");
        },
      });
    } else if (this.imagePreview) {
      // Editing with existing image
      this.saveBanner(this.imagePreview);
    } else {
      this.toast.error('Veuillez sélectionner une image');
    }
  }

  private saveBanner(imageUrl: string): void {
    this.submitting = true;
    const payload = {
      ...this.bannerForm.value,
      imageUrl,
      startsAt: this.bannerForm.value.startsAt
        ? new Date(this.bannerForm.value.startsAt).toISOString()
        : undefined,
      endsAt: this.bannerForm.value.endsAt
        ? new Date(this.bannerForm.value.endsAt).toISOString()
        : undefined,
    };
    const req$ =
      this.editMode && this.selectedBannerId
        ? this.bannerService.update(this.selectedBannerId, payload)
        : this.bannerService.create(payload);

    req$.subscribe({
      next: () => {
        this.toast.success(this.editMode ? 'Bannière modifiée' : 'Bannière créée');
        this.loadBanners();
        this.cancelForm();
        this.submitting = false;
      },
      error: (err: any) => {
        this.toast.error(err.error?.message || 'Erreur');
        this.submitting = false;
      },
    });
  }

  pauseBanner(b: BannerRow): void {
    this.bannerService.update(b.id, { active: false }).subscribe({
      next: () => {
        this.toast.success('Bannière mise en pause');
        this.loadBanners();
      },
      error: (err: any) => this.toast.error(err.error?.message || 'Erreur'),
    });
  }

  renewBanner(b: BannerRow): void {
    const newEnd = new Date();
    newEnd.setMonth(newEnd.getMonth() + 1);
    this.bannerService.update(b.id, { active: true, endsAt: newEnd.toISOString() }).subscribe({
      next: () => {
        this.toast.success('Bannière renouvelée');
        this.loadBanners();
      },
      error: (err: any) => this.toast.error(err.error?.message || 'Erreur'),
    });
  }

  viewReport(b: BannerRow): void {
    console.log('Rapport bannière', b.id);
  }

  deleteBanner(id: string): void {
    if (!confirm('Supprimer définitivement cette bannière ?')) return;
    this.bannerService.delete(id).subscribe({
      next: () => {
        this.toast.success('Bannière supprimée');
        this.loadBanners();
      },
      error: (err: any) => this.toast.error(err.error?.message || 'Erreur suppression'),
    });
  }
}
