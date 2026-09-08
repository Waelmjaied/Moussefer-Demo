import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

interface KycDocument {
  id: string;
  driverId: string;
  driverName: string;
  driverEmail: string;
  documentType: 'CIN' | 'DRIVER_LICENSE' | 'VEHICLE_REGISTRATION' | 'INSURANCE' | 'OTHER';
  documentUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  uploadedAt: string;
  rejectionReason?: string;
}

/**
 * All KYC documents for one driver, grouped together. Used to render
 * "one card per driver" instead of "one card per document" in the admin
 * review view — much more usable when several documents arrive per
 * driver during onboarding.
 */
interface DriverKycGroup {
  driverId: string;
  driverName: string;
  driverEmail: string;
  documents: KycDocument[];
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  /** Earliest upload across the group, used to sort the queue. */
  earliestUpload: string;
  /** Latest upload, used to display "déposé le …" in the group header. */
  latestUpload: string;
}

@Component({
  selector: 'app-kyc-review',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebarComponent],
  templateUrl: './kyc-review.component.html',
  styleUrls: ['./kyc-review.component.css'],
})
export class KycReviewComponent implements OnInit {
  documents: KycDocument[] = [];
  filteredDocs: KycDocument[] = [];
  /** Documents from filteredDocs, grouped by driver. Drives the template. */
  groupedDocs: DriverKycGroup[] = [];
  loading = true;
  selectedDoc: KycDocument | null = null;

  // Modal states
  showPreviewModal = false;
  showRejectModal = false;
  rejectReason = '';
  rejectTargetId: string | null = null;
  processingId: string | null = null;
  /** Driver currently being bulk-approved (so we can disable the right button). */
  bulkProcessingDriverId: string | null = null;

  // Filters
  filterType = 'ALL';
  filterStatus = 'PENDING';
  searchQuery = '';

  documentTypes = [
    { value: 'ALL', label: 'Tous les types' },
    { value: 'CIN', label: "Carte d'identité" },
    { value: 'DRIVER_LICENSE', label: 'Permis de conduire' },
    { value: 'VEHICLE_REGISTRATION', label: 'Carte grise / Photo véhicule' },
    { value: 'INSURANCE', label: 'Assurance' },
    { value: 'OTHER', label: 'Autre (Visite technique, Autorisation...)' },
  ];

  statusOptions = [
    { value: 'ALL', label: 'Tous' },
    { value: 'PENDING', label: 'En attente' },
    { value: 'APPROVED', label: 'Approuvé' },
    { value: 'REJECTED', label: 'Rejeté' },
  ];

  constructor(
    private adminService: AdminService,
    public permissionService: PermissionService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadDocuments();
  }

  // ─── Mapping helpers : backend → frontend ───

  private mapStatus(backendStatus: string): 'PENDING' | 'APPROVED' | 'REJECTED' {
    const map: Record<string, string> = {
      PENDING_REVIEW: 'PENDING',
      APPROVED: 'APPROVED',
      REJECTED: 'REJECTED',
      EXPIRED: 'REJECTED',
    };
    return (map[backendStatus] || 'PENDING') as any;
  }

  private mapDocType(
    backendType: string,
  ): 'CIN' | 'DRIVER_LICENSE' | 'VEHICLE_REGISTRATION' | 'INSURANCE' | 'OTHER' {
    const map: Record<string, string> = {
      CIN: 'CIN',
      DRIVING_LICENSE_FRONT: 'DRIVER_LICENSE',
      DRIVING_LICENSE_BACK: 'DRIVER_LICENSE',
      VEHICLE_PHOTO: 'VEHICLE_REGISTRATION',
      INSURANCE: 'INSURANCE',
      TECHNICAL_VISIT: 'OTHER',
      LOUAGE_AUTHORIZATION: 'OTHER',
      OTHER: 'OTHER',
    };
    return (map[backendType] || 'OTHER') as any;
  }

  // ─── Data loading ───

  loadDocuments(): void {
    this.loading = true;
    this.adminService
      .getPendingKycDocuments(0, 100)
      .pipe(
        catchError((err) => {
          console.error('KYC load error:', err);
          this.toast.error('Erreur lors du chargement des documents KYC');
          return of([]);
        }),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: (data) => {
          this.documents = data.map((d: any) => ({
            id: d.id,
            driverId: d.userId || d.driverId || 'unknown',
            driverName: d.driverName || d.userName || `Chauffeur ${(d.userId || '').slice(0, 8)}`,
            driverEmail: d.driverEmail || d.userEmail || '',
            documentType: this.mapDocType(d.documentType),
            documentUrl: d.fileUrl || d.documentUrl || '',
            status: this.mapStatus(d.status),
            uploadedAt: d.uploadedAt || d.createdAt,
            rejectionReason: d.rejectionReason,
          }));
          this.applyFilters();
        },
      });
  }

  applyFilters(): void {
    let filtered = this.documents;

    if (this.filterType !== 'ALL') {
      filtered = filtered.filter((d) => d.documentType === this.filterType);
    }

    if (this.filterStatus !== 'ALL') {
      filtered = filtered.filter((d) => d.status === this.filterStatus);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) => d.driverName.toLowerCase().includes(q) || d.driverEmail.toLowerCase().includes(q),
      );
    }

    this.filteredDocs = filtered;
    this.rebuildGroups();
  }

  /**
   * Rebuild `groupedDocs` from `filteredDocs`. Called every time the
   * filter set changes, or after an approve/reject reloads the list.
   *
   * Inside each group:
   *   - documents are sorted oldest → newest, so the first doc shown is
   *     the one that has been waiting longest
   *   - pending docs are listed before approved/rejected ones for quicker
   *     triage
   * Groups themselves are sorted by their earliest pending upload, so
   * drivers waiting the longest float to the top.
   */
  private rebuildGroups(): void {
    const map = new Map<string, DriverKycGroup>();

    for (const doc of this.filteredDocs) {
      let grp = map.get(doc.driverId);
      if (!grp) {
        grp = {
          driverId: doc.driverId,
          driverName: doc.driverName,
          driverEmail: doc.driverEmail,
          documents: [],
          pendingCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
          earliestUpload: doc.uploadedAt,
          latestUpload: doc.uploadedAt,
        };
        map.set(doc.driverId, grp);
      }
      grp.documents.push(doc);
      if (doc.status === 'PENDING') grp.pendingCount++;
      else if (doc.status === 'APPROVED') grp.approvedCount++;
      else if (doc.status === 'REJECTED') grp.rejectedCount++;
      if (doc.uploadedAt && doc.uploadedAt < grp.earliestUpload)
        grp.earliestUpload = doc.uploadedAt;
      if (doc.uploadedAt && doc.uploadedAt > grp.latestUpload) grp.latestUpload = doc.uploadedAt;
    }

    // Sort documents inside each group (pending first, then by date).
    map.forEach((grp) => {
      grp.documents.sort((a, b) => {
        if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
        if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
        return a.uploadedAt.localeCompare(b.uploadedAt);
      });
    });

    // Sort groups: drivers with pending docs first, oldest waiting first.
    this.groupedDocs = Array.from(map.values()).sort((a, b) => {
      if (a.pendingCount > 0 && b.pendingCount === 0) return -1;
      if (a.pendingCount === 0 && b.pendingCount > 0) return 1;
      return a.earliestUpload.localeCompare(b.earliestUpload);
    });
  }

  // ─── Display helpers ───

  getDocTypeLabel(type: string): string {
    const found = this.documentTypes.find((t) => t.value === type);
    return found?.label || type;
  }

  getDocTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      CIN: 'bi-person-vcard',
      DRIVER_LICENSE: 'bi-credit-card-2-front',
      VEHICLE_REGISTRATION: 'bi-car-front',
      INSURANCE: 'bi-shield-check',
      OTHER: 'bi-file-earmark',
    };
    return icons[type] || 'bi-file-earmark';
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'status-pending',
      APPROVED: 'status-approved',
      REJECTED: 'status-rejected',
    };
    return map[status] || '';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'En attente',
      APPROVED: 'Approuvé',
      REJECTED: 'Rejeté',
    };
    return map[status] || status;
  }

  // ─── Actions ───

  previewDocument(doc: KycDocument): void {
    this.selectedDoc = doc;
    this.showPreviewModal = true;
  }

  closePreview(): void {
    this.showPreviewModal = false;
    this.selectedDoc = null;
  }

  approveDocument(docId: string): void {
    if (!confirm('Êtes-vous sûr de vouloir approuver ce document ?')) return;

    this.processingId = docId;
    this.adminService.approveKycDocument(docId).subscribe({
      next: () => {
        this.toast.success('Document approuvé avec succès');
        this.loadDocuments();
        if (this.selectedDoc?.id === docId) this.closePreview();
      },
      error: (err) => {
        this.toast.error(err.error?.message || "Erreur lors de l'approbation");
      },
      complete: () => (this.processingId = null),
    });
  }

  openRejectModal(docId: string): void {
    this.rejectTargetId = docId;
    this.rejectReason = '';
    this.showRejectModal = true;
  }

  closeRejectModal(): void {
    this.showRejectModal = false;
    this.rejectTargetId = null;
    this.rejectReason = '';
  }

  confirmReject(): void {
    if (!this.rejectTargetId || !this.rejectReason.trim()) {
      this.toast.error('Veuillez indiquer un motif de rejet');
      return;
    }

    this.processingId = this.rejectTargetId;
    this.adminService.rejectKycDocument(this.rejectTargetId, this.rejectReason).subscribe({
      next: () => {
        this.toast.success('Document rejeté');
        this.closeRejectModal();
        this.loadDocuments();
        if (this.selectedDoc?.id === this.rejectTargetId) this.closePreview();
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Erreur lors du rejet');
      },
      complete: () => (this.processingId = null),
    });
  }

  /**
   * Approve every PENDING document of a given driver in sequence.
   * Uses sequential subscribes (not forkJoin) so a single 400/500 on
   * one document doesn't kill the others — and so the user gets an
   * accurate count of successes at the end. After completion the queue
   * is reloaded once.
   */
  approveAllForDriver(driverId: string): void {
    const group = this.groupedDocs.find((g) => g.driverId === driverId);
    if (!group) return;
    const pending = group.documents.filter((d) => d.status === 'PENDING');
    if (pending.length === 0) return;
    if (
      !confirm(`Approuver les ${pending.length} document(s) en attente de ${group.driverName} ?`)
    ) {
      return;
    }

    this.bulkProcessingDriverId = driverId;
    let ok = 0;
    let ko = 0;
    let remaining = pending.length;

    const next = (idx: number): void => {
      if (idx >= pending.length) {
        this.bulkProcessingDriverId = null;
        if (ko === 0) {
          this.toast.success(`${ok} document(s) approuvé(s) pour ${group.driverName}`);
        } else {
          this.toast.error(`${ok} approuvé(s), ${ko} échec(s) sur ${group.driverName}`);
        }
        this.loadDocuments();
        return;
      }
      const doc = pending[idx];
      this.adminService.approveKycDocument(doc.id).subscribe({
        next: () => {
          ok++;
          remaining--;
          next(idx + 1);
        },
        error: (err) => {
          console.error('[approveAllForDriver] failed for', doc.id, err);
          ko++;
          remaining--;
          next(idx + 1);
        },
      });
    };

    next(0);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  pendingCount(): number {
    return this.documents.filter((d) => d.status === 'PENDING').length;
  }

  isImage(url: string): boolean {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.gif') ||
      lower.endsWith('.webp') ||
      lower.endsWith('.bmp')
    );
  }
}
