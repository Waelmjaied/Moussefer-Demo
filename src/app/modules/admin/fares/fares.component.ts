import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmModalService } from '../../../core/services/confirm-modal.service';
import { RegulatedFareService, RegulatedFare } from '../../../core/services/regulated-fare.service';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';

@Component({
  selector: 'app-fares',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AdminSidebarComponent],
  templateUrl: './fares.component.html',
  styleUrls: ['./fares.component.css'],
})
export class FaresComponent implements OnInit {
  fares: RegulatedFare[] = [];
  loading = true;
  showForm = false;
  editMode = false;
  selectedFare: RegulatedFare | null = null;
  submitting = false;
  filterCity = '';
  showImport = false;
  selectedFile: File | null = null;
  importLoading = false;
  importResult: any = null;
  fareForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private fareService: RegulatedFareService,
    public permissionService: PermissionService,
    private toast: ToastService,
    private confirmModal: ConfirmModalService,
  ) {
    this.fareForm = this.fb.group({
      departureCity: ['', Validators.required],
      arrivalCity: ['', Validators.required],
      pricePerSeat: [0, [Validators.required, Validators.min(0.1)]],
      distanceKm: [null],
      effectiveDate: [''],
      source: [''],
      active: [true],
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.fareService.getAll(this.filterCity || undefined).subscribe({
      next: (d) => {
        this.fares = d;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  openCreate(): void {
    this.editMode = false;
    this.selectedFare = null;
    this.fareForm.reset({ active: true, pricePerSeat: 0 });
    this.showForm = true;
  }

  openEdit(fare: RegulatedFare): void {
    this.editMode = true;
    this.selectedFare = fare;
    this.fareForm.patchValue(fare);
    this.showForm = true;
  }

  cancelForm(): void {
    this.showForm = false;
  }

  onSubmit(): void {
    if (this.fareForm.invalid) return;
    this.submitting = true;
    const req$ =
      this.editMode && this.selectedFare
        ? this.fareService.update(this.selectedFare.id, this.fareForm.value)
        : this.fareService.create(this.fareForm.value);
    req$.subscribe({
      next: () => {
        this.toast.success(this.editMode ? 'Tarif modifie' : 'Tarif cree');
        this.load();
        this.cancelForm();
        this.submitting = false;
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Erreur');
        this.submitting = false;
      },
    });
  }

  async toggleActive(fare: RegulatedFare): Promise<void> {
    const ok = await this.confirmModal.confirm(
      `${fare.active ? 'Desactiver' : 'Activer'} ce tarif ?`,
      'Confirmation',
    );
    if (!ok) return;
    this.fareService.toggleActive(fare.id, !fare.active).subscribe({
      next: () => {
        this.toast.success('Statut mis a jour');
        this.load();
      },
      error: (err) => this.toast.error(err.error?.message || 'Erreur'),
    });
  }

  async deleteFare(id: string): Promise<void> {
    const ok = await this.confirmModal.confirm(
      'Supprimer ce tarif definitivement ?',
      'Suppression',
    );
    if (!ok) return;
    this.fareService.delete(id).subscribe({
      next: () => {
        this.toast.success('Tarif supprime');
        this.load();
      },
      error: (err) => this.toast.error(err.error?.message || 'Erreur'),
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  removeFile(): void {
    this.selectedFile = null;
  }

  submitImport(): void {
    if (!this.selectedFile) {
      this.toast.error('Veuillez selectionner un fichier');
      return;
    }
    this.importLoading = true;
    const formData = new FormData();
    formData.append('file', this.selectedFile);
    const format = this.selectedFile.name.endsWith('.csv') ? 'CSV' : 'JSON';
    formData.append('format', format);
    this.fareService.importFile(formData).subscribe({
      next: (r) => {
        this.importResult = r;
        this.importLoading = false;
        this.selectedFile = null;
        this.load();
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Erreur import');
        this.importLoading = false;
      },
    });
  }
}
