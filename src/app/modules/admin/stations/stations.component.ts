import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import * as L from 'leaflet';
import { StationService } from '../../../core/services/station.service';
import { AdminStationService, ImportResult } from '../../../core/services/admin-station.service';
import { Station } from '../../../core/models/station.model';
import { CommonModule } from '@angular/common';
import { ConfirmModalService } from '../../../core/services/confirm-modal.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';

@Component({
  selector: 'app-stations',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AdminSidebarComponent],
  templateUrl: './stations.component.html',
  styleUrls: ['./stations.component.css'],
})
export class StationsComponent implements OnInit {
  stations: Station[] = [];
  loading = true;
  showForm = false;
  editMode = false;
  selectedStation: Station | null = null;
  stationForm: FormGroup;
  map!: L.Map;
  marker!: L.Marker;
  mapInitialized = false;

  @ViewChild('mapContainer') mapContainer!: ElementRef;

  // ─── Import (un seul fichier fusionné) ───
  showImport = false;
  selectedFile: File | null = null;
  importLoading = false;
  importResult: ImportResult | null = null;

  // ─── Map Modal ───
  showMapModal = false;
  mapModal!: L.Map;
  mapModalMarker!: L.Marker;
  mapModalInitialized = false;

  @ViewChild('mapModalContainer') mapModalContainer!: ElementRef;

  // ─── Secondary points ───
  selectedStationForPoints: Station | null = null;
  secondaryPoints: any[] = [];
  pointsLoading = false;
  newPointName = '';
  newPointAddress = '';

  // ─── Stats ───
  stationStats: any = null;
  statsLoading = false;

  constructor(
    private stationService: StationService,
    private adminStationService: AdminStationService,
    private fb: FormBuilder,
    private confirmModal: ConfirmModalService,
    public permissionService: PermissionService,
    private cdr: ChangeDetectorRef,
  ) {
    this.stationForm = this.fb.group({
      name: ['', Validators.required],
      address: ['', Validators.required],
      latitude: [36.8001, [Validators.required, Validators.min(-90), Validators.max(90)]],
      longitude: [10.1844, [Validators.required, Validators.min(-180), Validators.max(180)]],
    });
  }

  ngOnInit(): void {
    this.loadStations();
  }

  /* ═════════════════════════════════════════════════════
     CHARGEMENT + CARTE PRINCIPALE
     ═════════════════════════════════════════════════════ */
  loadStations(): void {
    this.loading = true;
    this.stationService.getAll().subscribe({
      next: (data) => {
        this.stations = data;
        this.loading = false;
        this.cdr.detectChanges();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.tryInitMap();
            this.updateMarkers();
          });
        });
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => this.tryInitMap());
        });
      },
    });
  }

  private tryInitMap(): void {
    if (this.mapInitialized) return;
    const el = this.mapContainer?.nativeElement;
    if (!el) {
      setTimeout(() => {
        if (!this.mapInitialized && this.mapContainer?.nativeElement) {
          this.initMap();
        }
      }, 200);
      return;
    }
    this.initMap();
  }

  initMap(): void {
    const el = this.mapContainer.nativeElement;
    if (!el || el.clientHeight === 0) {
      console.warn('Map container has no height yet');
      return;
    }
    this.map = L.map(el, { attributionControl: false }).setView([36.8001, 10.1844], 7);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CartoDB',
    }).addTo(this.map);
    L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(this.map);
    this.mapInitialized = true;
    setTimeout(() => this.map.invalidateSize(), 100);
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      this.stationForm.patchValue({ latitude: lat, longitude: lng });
      this.updateMarker(lat, lng);
    });
  }

  updateMarker(lat: number, lng: number): void {
    if (!this.map) return;
    if (this.marker) this.marker.remove();
    this.marker = L.marker([lat, lng]).addTo(this.map);
  }

  updateMarkers(): void {
    if (!this.map) return;
    this.map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) layer.remove();
    });
    this.stations.forEach((station) => {
      L.marker([station.latitude, station.longitude])
        .bindPopup(`<<b>${station.name}</b><br>${station.address}`)
        .addTo(this.map);
    });
  }

  /* ═════════════════════════════════════════════════════
     CARTE MODALE — CHOISIR L'EMPLACEMENT
     ═════════════════════════════════════════════════════ */
  openMapModal(): void {
    this.showMapModal = true;
    this.mapModalInitialized = false;
    this.cdr.detectChanges();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.initMapModal());
    });
  }

  closeMapModal(): void {
    this.showMapModal = false;
    this.mapModalInitialized = false;
  }

  initMapModal(): void {
    if (this.mapModalInitialized) return;
    const el = this.mapModalContainer?.nativeElement;
    if (!el || el.clientHeight === 0) {
      setTimeout(() => this.initMapModal(), 100);
      return;
    }

    const currentLat = this.stationForm.get('latitude')?.value || 36.8001;
    const currentLng = this.stationForm.get('longitude')?.value || 10.1844;

    this.mapModal = L.map(el, { attributionControl: false }).setView([currentLat, currentLng], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CartoDB',
    }).addTo(this.mapModal);
    L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(this.mapModal);

    if (currentLat && currentLng) {
      this.mapModalMarker = L.marker([currentLat, currentLng]).addTo(this.mapModal);
    }

    this.mapModal.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      this.stationForm.patchValue({ latitude: lat, longitude: lng });
      if (this.mapModalMarker) this.mapModalMarker.remove();
      this.mapModalMarker = L.marker([lat, lng]).addTo(this.mapModal);
    });

    this.mapModalInitialized = true;
    setTimeout(() => this.mapModal.invalidateSize(), 100);
  }

  /* ═════════════════════════════════════════════════════
     CRUD
     ═════════════════════════════════════════════════════ */
  openCreateForm(): void {
    this.editMode = false;
    this.selectedStation = null;
    this.stationForm.reset({ latitude: 36.8001, longitude: 10.1844 });
    this.showForm = true;
  }

  openEditForm(station: Station): void {
    this.editMode = true;
    this.selectedStation = station;
    this.stationForm.patchValue(station);
    this.showForm = true;
  }

  cancelForm(): void {
    this.showForm = false;
    this.selectedStation = null;
  }

  onSubmit(): void {
    if (this.stationForm.invalid) return;
    const formValue = this.stationForm.value;
    if (this.editMode && this.selectedStation) {
      this.adminStationService.update(this.selectedStation.id, formValue).subscribe(() => {
        this.loadStations();
        this.cancelForm();
      });
    } else {
      this.adminStationService.create(formValue).subscribe(() => {
        this.loadStations();
        this.cancelForm();
      });
    }
  }

  async deleteStation(id: string): Promise<void> {
    const confirmed = await this.confirmModal.confirm('Supprimer cette station ?', 'Suppression');
    if (confirmed) {
      this.adminStationService.deactivate(id).subscribe(() => this.loadStations());
    }
  }

  /* ═════════════════════════════════════════════════════
     POINTS SECONDAIRES
     ═════════════════════════════════════════════════════ */
  loadSecondaryPoints(station: Station): void {
    this.selectedStationForPoints = station;
    this.pointsLoading = true;
    this.adminStationService.getSecondaryPoints(station.id).subscribe({
      next: (pts) => {
        this.secondaryPoints = pts;
        this.pointsLoading = false;
      },
      error: () => (this.pointsLoading = false),
    });
  }

  addSecondaryPoint(): void {
    if (!this.selectedStationForPoints || !this.newPointName.trim()) return;
    this.adminStationService
      .addSecondaryPoint(this.selectedStationForPoints.id, {
        name: this.newPointName.trim(),
        address: this.newPointAddress.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.newPointName = '';
          this.newPointAddress = '';
          this.loadSecondaryPoints(this.selectedStationForPoints!);
        },
      });
  }

  removeSecondaryPoint(pointId: string): void {
    this.adminStationService.removeSecondaryPoint(pointId).subscribe({
      next: () => this.loadSecondaryPoints(this.selectedStationForPoints!),
    });
  }

  closeSecondaryPoints(): void {
    this.selectedStationForPoints = null;
    this.secondaryPoints = [];
  }

  /* ═════════════════════════════════════════════════════
     STATS
     ═════════════════════════════════════════════════════ */
  loadStationStats(stationId: string): void {
    this.statsLoading = true;
    this.adminStationService.getStats(stationId).subscribe({
      next: (s) => {
        this.stationStats = s;
        this.statsLoading = false;
      },
      error: () => (this.statsLoading = false),
    });
  }

  /* ═════════════════════════════════════════════════════
     IMPORT — UN SEUL FICHIER (CSV / Excel / JSON)
     ═════════════════════════════════════════════════════ */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.selectedFile = input.files[0];
  }

  removeFile(): void {
    this.selectedFile = null;
    const input = document.getElementById('stationFile') as HTMLInputElement;
    if (input) input.value = '';
  }

  submitImport(): void {
    if (!this.selectedFile) return;

    const file = this.selectedFile;
    const ext = file.name.split('.').pop()?.toLowerCase();

    this.importLoading = true;
    this.importResult = null;

    if (ext === 'json') {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const rows = JSON.parse(reader.result as string);
          if (!Array.isArray(rows)) throw new Error('Le fichier JSON doit contenir un tableau');
          this.sendImportJson(rows);
        } catch (e: any) {
          this.importLoading = false;
          this.importResult = {
            created: 0,
            updated: 0,
            failed: 1,
            total: 0,
            errors: ['JSON invalide: ' + e.message],
          };
        }
      };
      reader.onerror = () => {
        this.importLoading = false;
        this.importResult = {
          created: 0,
          updated: 0,
          failed: 1,
          total: 0,
          errors: ['Erreur de lecture du fichier'],
        };
      };
      reader.readAsText(file);
    } else if (ext === 'csv') {
      this.sendImportCsv(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      this.sendImportExcel(file);
    } else {
      this.importLoading = false;
      this.importResult = {
        created: 0,
        updated: 0,
        failed: 1,
        total: 0,
        errors: ['Format non supporté. Utilisez .csv, .xlsx ou .json'],
      };
    }
  }

  private sendImportJson(rows: any[]): void {
    this.adminStationService.importJson(rows).subscribe({
      next: (res) => {
        this.importResult = res;
        this.importLoading = false;
        this.selectedFile = null;
        if (res.created > 0 || res.updated > 0) this.loadStations();
      },
      error: (err) => {
        this.importLoading = false;
        this.importResult = {
          created: 0,
          updated: 0,
          failed: 1,
          total: 0,
          errors: [err.error?.message || 'Erreur import JSON'],
        };
      },
    });
  }

  private sendImportCsv(file: File): void {
    this.adminStationService.importCsv(file).subscribe({
      next: (res) => {
        this.importResult = res;
        this.importLoading = false;
        this.selectedFile = null;
        if (res.created > 0 || res.updated > 0) this.loadStations();
      },
      error: (err) => {
        this.importLoading = false;
        this.importResult = {
          created: 0,
          updated: 0,
          failed: 1,
          total: 0,
          errors: [err.error?.message || 'Erreur import CSV'],
        };
      },
    });
  }

  private sendImportExcel(file: File): void {
    this.adminStationService.importExcel(file).subscribe({
      next: (res) => {
        this.importResult = res;
        this.importLoading = false;
        this.selectedFile = null;
        if (res.created > 0 || res.updated > 0) this.loadStations();
      },
      error: (err) => {
        this.importLoading = false;
        this.importResult = {
          created: 0,
          updated: 0,
          failed: 1,
          total: 0,
          errors: [err.error?.message || 'Erreur import Excel'],
        };
      },
    });
  }

  downloadCsvTemplate(): void {
    const header = 'id,name,city,region,address,latitude,longitude\n';
    const example = ',Station Centrale,Tunis,Tunis,Avenue Habib Bourguiba,36.8065,10.1815\n';
    const blob = new Blob([header + example], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stations_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
