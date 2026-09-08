import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatureToggleService, FeatureToggle } from '../../../core/services/feature-toggle.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';

@Component({
  selector: 'app-feature-toggles',
  standalone: true,
  imports: [CommonModule, AdminSidebarComponent],
  templateUrl: './feature-toggles.component.html',
  styleUrls: ['./feature-toggles.component.css'],
})
export class FeatureTogglesComponent implements OnInit {
  features: FeatureToggle[] = [];
  loading = true;
  updating: string | null = null;

  constructor(
    private featureService: FeatureToggleService,
    public permissionService: PermissionService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.featureService.getAll().subscribe({
      next: (d) => {
        this.features = d;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  toggle(f: FeatureToggle): void {
    if (!this.permissionService.isSuperAdmin()) return;
    this.updating = f.featureName;
    this.featureService.update(f.featureName, !f.enabled).subscribe({
      next: (updated) => {
        f.enabled = updated.enabled;
        this.toast.success(
          `${this.formatName(f.featureName)} ${updated.enabled ? 'activé' : 'désactivé'}`,
        );
        this.updating = null;
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Erreur');
        this.updating = null;
      },
    });
  }

  formatName(name: string): string {
    return name
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase());
  }
}
