import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../core/services/toast.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AdminService } from '../../../core/services/admin.service';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebarComponent],
  templateUrl: './admin-notifications.component.html',
  styleUrls: ['./admin-notifications.component.css'],
})
export class AdminNotificationsComponent implements OnInit {
  private api = environment.apiUrl;
  templates: any[] = [];
  loading = true;
  sending = false;
  selectedTemplate: any = null;
  targetAudience = 'ALL';
  customMessage = '';

  constructor(
    private http: HttpClient,
    private adminService: AdminService,
    public permissionService: PermissionService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.loading = true;
    this.http.get<any[]>(`${this.api}/api/v1/admin/notifications/templates`).subscribe({
      next: (d) => {
        this.templates = d;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  /**
   * The backend exposes /send (single user) and /broadcast (explicit userIds[]).
   * Neither resolves an audience label, so we resolve the audience to user IDs
   * here, then call the broadcast contract with { userIds, title, body }.
   */
  send(): void {
    const title = (
      this.selectedTemplate?.title ||
      this.selectedTemplate?.name ||
      'Notification'
    ).toString();
    const body = (
      this.customMessage?.trim() ||
      this.selectedTemplate?.body ||
      this.selectedTemplate?.message ||
      ''
    ).toString();

    if (!body) {
      this.toast.warning('Sélectionnez un template ou rédigez un message');
      return;
    }

    this.sending = true;
    // 'ALL' => no role filter; otherwise the option value IS the role name.
    const role = this.targetAudience === 'ALL' ? undefined : this.targetAudience;

    this.adminService.listAllUsers(0, 2000, role).subscribe({
      next: (users) => {
        const userIds = (users || [])
          .map((u: any) => u.id ?? u.userId ?? u.userID)
          .filter((id: any) => !!id);

        if (userIds.length === 0) {
          this.toast.warning('Aucun destinataire pour cette audience');
          this.sending = false;
          return;
        }

        this.http
          .post(`${this.api}/api/v1/admin/notifications/broadcast`, { userIds, title, body })
          .subscribe({
            next: () => {
              this.toast.success(`Notification envoyée à ${userIds.length} utilisateur(s)`);
              this.sending = false;
              this.selectedTemplate = null;
              this.customMessage = '';
            },
            error: (err) => {
              this.toast.error(err.error?.message || 'Erreur envoi');
              this.sending = false;
            },
          });
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Impossible de charger les destinataires');
        this.sending = false;
      },
    });
  }
}
