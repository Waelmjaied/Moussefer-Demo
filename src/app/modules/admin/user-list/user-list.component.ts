// Cible : src/app/modules/admin/user-list/user-list.component.ts
// FIX #2 (admin wiring) :
//   - sendMessage : ouvre une modale de saisie (titre + message) puis envoie
//     via adminService.sendNotification (endpoint qui existait déjà).
//   - Plus de console.log.
// Ajout côté template requis : voir le bloc HTML en bas de ce fichier (commentaire).

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

import { AdminService } from '../../../core/services/admin.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone?: string;
  registrationDate: string;
  tripCount?: number;
  complaints?: number;
  type: string;
  status: string;
  lastLogin?: string;
  profileUpdated?: string;
}

interface AdminRoleOption {
  name: string;
  label: string;
}

@Component({
  selector: 'app-userList',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebarComponent],
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css'],
})
export class UserListComponent implements OnInit {
  currentDate = '';
  moduleCode = 'M02';
  pageTitle = 'Gestion des comptes';

  activeTab = 'Tous';
  tabs = [
    { label: 'Tous', value: 'Tous' },
    { label: 'Passagers', value: 'Passagers' },
    { label: 'Chauffeurs', value: 'Chauffeurs' },
    { label: 'Organisateurs', value: 'Organisateurs' },
    { label: 'Actifs', value: 'Actifs' },
    { label: 'En attente', value: 'En attente' },
    { label: 'Suspendu', value: 'Suspendu' },
    { label: 'Bloqué', value: 'Bloqué' },
  ];

  users: UserRow[] = [];
  filteredUsers: UserRow[] = [];
  loading = true;
  searchQuery = '';

  selectedUser: UserRow | null = null;
  showDetailPanel = false;

  showSuspendModal = false;
  suspendTarget: UserRow | null = null;
  suspendReason = '';
  suspendDuration = 7;

  // ▶︎ FIX #2 : état de la modale "Envoyer un message"
  showMessageModal = false;
  messageTarget: UserRow | null = null;
  messageTitle = '';
  messageBody = '';
  sendingMessage = false;

  showCreateModal = false;
  creating = false;
  availableAdminRoles: AdminRoleOption[] = [];

  roleOptions = [
    { value: 'PASSENGER', label: 'Passager' },
    { value: 'DRIVER', label: 'Chauffeur' },
    { value: 'ORGANIZER', label: 'Organisateur' },
    { value: 'ADMIN', label: 'Administrateur' },
  ];

  createForm = {
    name: '',
    email: '',
    phoneNumber: '',
    role: 'PASSENGER',
    adminRole: '',
    password: '',
  };

  private avatarColors = ['#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3', '#f3e8ff', '#ffedd5'];

  constructor(
    private adminService: AdminService,
    public permissionService: PermissionService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    this.currentDate = new Date().toLocaleDateString('fr-FR', opts);
    this.loadUsers();
    this.loadAdminRoles();
  }

  loadAdminRoles(): void {
    if (!this.permissionService.isSuperAdmin()) return;
    this.adminService
      .listAdminRoles()
      .pipe(catchError(() => of(null)))
      .subscribe({
        next: (rolesData: any) => {
          const roleList = Array.isArray(rolesData) ? rolesData : [];
          if (roleList.length > 0) {
            this.availableAdminRoles = roleList.map((r: any) => ({
              name: r.name ?? r.roleName ?? '',
              label: r.label ?? r.displayName ?? r.name ?? '',
            }));
          } else {
            this.setFallbackAdminRoles();
          }
        },
        error: () => this.setFallbackAdminRoles(),
      });
  }

  private setFallbackAdminRoles(): void {
    this.availableAdminRoles = [
      { name: 'SUPER_ADMIN', label: 'Super admin' },
      { name: 'OPERATIONAL_ADMIN', label: 'Admin Opérationnel' },
      { name: 'FINANCIAL_ADMIN', label: 'Admin Financier' },
      { name: 'MODERATOR', label: 'Modérateur' },
      { name: 'AUDITEUR', label: 'Auditeur' },
    ];
  }

  loadUsers(): void {
    this.loading = true;
    this.adminService
      .listAllUsers(0, 200)
      .pipe(catchError(() => of([])))
      .subscribe({
        next: (data: any[]) => {
          this.users = (Array.isArray(data) ? data : []).map((u: any) => ({
            id: u.id || u.userId || '',
            name: u.name || '',
            email: u.email || '',
            phone: u.phoneNumber || u.telephone || u.phone || '',
            registrationDate: u.createdAt ? this.formatDate(u.createdAt) : '—',
            tripCount: u.tripCount || u.trips || 0,
            complaints: u.complaints || 0,
            type: this.mapType(u.role, u.adminRole),
            status: this.mapStatus(u.status, u.active),
            lastLogin: u.lastLogin ? this.formatDate(u.lastLogin) : undefined,
            profileUpdated: u.updatedAt ? this.formatRelative(u.updatedAt) : undefined,
          }));
          this.applyFilter();
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.users = [];
          this.filteredUsers = [];
        },
      });
  }

  mapType(role?: string, adminRole?: string): string {
    if (adminRole && adminRole !== 'NONE') return 'Admin';
    if (role === 'DRIVER') return 'Chauffeur';
    if (role === 'ORGANIZER') return 'Organisateur';
    if (role === 'PASSENGER') return 'Passager';
    return 'Passager';
  }

  mapStatus(status?: string, active?: boolean): string {
    if (status === 'SUSPENDED') return 'Suspendu';
    if (status === 'BANNED' || status === 'BLOCKED') return 'Bloqué';
    if (status === 'PENDING') return 'En attente';
    if (active === false) return 'Bloqué';
    return 'Actif';
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatRelative(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return 'Hier';
    if (diff < 7) return `Il y a ${diff} jours`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  applyFilter(): void {
    let filtered = this.users;

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      );
    }

    switch (this.activeTab) {
      case 'Passagers':
        filtered = filtered.filter((u) => u.type === 'Passager');
        break;
      case 'Chauffeurs':
        filtered = filtered.filter((u) => u.type === 'Chauffeur');
        break;
      case 'Organisateurs':
        filtered = filtered.filter((u) => u.type === 'Organisateur');
        break;
      case 'Actifs':
        filtered = filtered.filter((u) => u.status === 'Actif');
        break;
      case 'En attente':
        filtered = filtered.filter((u) => u.status === 'En attente');
        break;
      case 'Suspendu':
        filtered = filtered.filter((u) => u.status === 'Suspendu');
        break;
      case 'Bloqué':
        filtered = filtered.filter((u) => u.status === 'Bloqué');
        break;
    }

    this.filteredUsers = filtered;
  }

  setTab(tab: string): void {
    this.activeTab = tab;
    this.applyFilter();
  }

  selectUser(user: UserRow): void {
    this.selectedUser = user;
    this.showDetailPanel = true;
  }

  viewUser(user: UserRow): void {
    this.selectUser(user);
    if (user.status === 'En attente') {
      this.validateUser(user);
    } else if (user.status === 'Suspendu' || user.status === 'Bloqué') {
      this.restoreUser(user);
    }
  }

  getInitials(name?: string): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || '';
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  getAvatarColor(name?: string): string {
    const str = name || '';
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return this.avatarColors[Math.abs(hash) % this.avatarColors.length];
  }

  getRoleClass(type: string): string {
    const map: Record<string, string> = {
      Passager: 'passager',
      Chauffeur: 'chauffeur',
      Organisateur: 'organisateur',
      Admin: 'admin',
    };
    return map[type] || 'passager';
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Actif: 'actif',
      'En attente': 'attente',
      Suspendu: 'suspendu',
      Bloqué: 'bloque',
    };
    return map[status] || 'actif';
  }

  /* ═════════════════════════════════════════════════════
     MODAL CRÉATION
     ═════════════════════════════════════════════════════ */
  openCreateModal(): void {
    this.createForm = {
      name: '',
      email: '',
      phoneNumber: '',
      role: 'PASSENGER',
      adminRole: '',
      password: '',
    };
    this.showCreateModal = true;
  }

  closeCreateModal(event?: MouseEvent): void {
    if (event && event.target !== event.currentTarget) return;
    this.showCreateModal = false;
  }

  isCreateFormValid(): boolean {
    const baseValid =
      this.createForm.name.trim().length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.createForm.email) &&
      this.createForm.password.length >= 6 &&
      this.createForm.phoneNumber.trim().length > 0;

    if (this.createForm.role === 'ADMIN' && this.permissionService.isSuperAdmin()) {
      return baseValid && this.createForm.adminRole.trim().length > 0;
    }

    return baseValid;
  }

  submitCreateUser(): void {
    if (!this.isCreateFormValid()) return;
    this.creating = true;

    const payload: any = {
      name: this.createForm.name,
      email: this.createForm.email,
      password: this.createForm.password,
      phoneNumber: this.createForm.phoneNumber,
      role: this.createForm.role,
    };

    if (this.createForm.role === 'ADMIN' && this.createForm.adminRole) {
      payload.adminRole = this.createForm.adminRole;
    }

    this.adminService.createUser(payload).subscribe({
      next: () => {
        this.toast.success('Compte créé avec succès.');
        this.creating = false;
        this.showCreateModal = false;
        this.loadUsers();
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Erreur lors de la création.');
        this.creating = false;
      },
    });
  }

  /* ═════════════════════════════════════════════════════
     ACTIONS UTILISATEUR
     ═════════════════════════════════════════════════════ */
  validateUser(user: UserRow): void {
    this.adminService
      .verifyUser(user.id, true)
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.toast.success(`${user.name} validé.`);
        this.loadUsers();
      });
  }

  openSuspendModal(user: UserRow): void {
    this.suspendTarget = user;
    this.suspendReason = '';
    this.suspendDuration = 7;
    this.showSuspendModal = true;
  }

  closeSuspendModal(event?: MouseEvent): void {
    if (event && (event.target as HTMLElement).classList.contains('modal-dialog')) return;
    this.showSuspendModal = false;
    this.suspendTarget = null;
  }

  confirmSuspend(): void {
    if (!this.suspendTarget || !this.suspendReason.trim()) return;
    this.adminService
      .suspendUser(this.suspendTarget.id, this.suspendReason, this.suspendDuration)
      .subscribe({
        next: () => {
          this.toast.success('Utilisateur suspendu.');
          this.loadUsers();
          this.closeSuspendModal();
          if (this.selectedUser?.id === this.suspendTarget?.id) {
            this.showDetailPanel = false;
          }
        },
        error: (err) => this.toast.error(err.message || 'Erreur lors de la suspension'),
      });
  }

  restoreUser(user: UserRow): void {
    this.adminService.reactivateUser(user.id).subscribe({
      next: () => {
        this.toast.success('Utilisateur restauré.');
        this.loadUsers();
        if (this.selectedUser?.id === user.id) this.showDetailPanel = false;
      },
      error: (err) => this.toast.error(err.message || 'Erreur'),
    });
  }

  /* ═════════════════════════════════════════════════════
     ENVOI DE MESSAGE — branché sur sendNotification
     ═════════════════════════════════════════════════════ */

  /** ▶︎ FIX #2 : ouvre la modale de saisie (titre + corps). */
  sendMessage(user: UserRow): void {
    this.messageTarget = user;
    this.messageTitle = '';
    this.messageBody = '';
    this.showMessageModal = true;
  }

  closeMessageModal(event?: MouseEvent): void {
    if (event && (event.target as HTMLElement).classList.contains('modal-dialog')) return;
    this.showMessageModal = false;
    this.messageTarget = null;
  }

  confirmSendMessage(): void {
    if (!this.messageTarget || !this.messageTitle.trim() || !this.messageBody.trim()) {
      this.toast.error('Titre et message obligatoires.');
      return;
    }
    this.sendingMessage = true;

    this.adminService
      .sendNotification({
        userId: this.messageTarget.id,
        title: this.messageTitle.trim(),
        body: this.messageBody.trim(),
      })
      .subscribe({
        next: () => {
          this.toast.success(`Message envoyé à ${this.messageTarget!.name}.`);
          this.sendingMessage = false;
          this.showMessageModal = false;
          this.messageTarget = null;
        },
        error: (err) => {
          this.sendingMessage = false;
          this.toast.error(err.error?.message || "Erreur lors de l'envoi du message.");
        },
      });
  }
}

/* ═════════════════════════════════════════════════════
   AJOUT TEMPLATE — coller à la fin de user-list.component.html

   <!-- Modal "Envoyer un message" -->
   <div *ngIf="showMessageModal" class="modal-overlay" (click)="closeMessageModal($event)">
     <div class="modal-dialog">
       <h3>Envoyer un message à {{ messageTarget?.name }}</h3>
       <p class="text-muted">{{ messageTarget?.email }}</p>

       <label>
         Titre
         <input type="text" [(ngModel)]="messageTitle" maxlength="100"
                placeholder="Ex: Notification importante" />
       </label>

       <label>
         Message
         <textarea [(ngModel)]="messageBody" rows="5" maxlength="500"
                   placeholder="Votre message…"></textarea>
       </label>

       <div class="modal-actions">
         <button type="button" (click)="closeMessageModal()" [disabled]="sendingMessage">
           Annuler
         </button>
         <button type="button" class="primary" (click)="confirmSendMessage()"
                 [disabled]="sendingMessage || !messageTitle.trim() || !messageBody.trim()">
           {{ sendingMessage ? 'Envoi…' : 'Envoyer' }}
         </button>
       </div>
     </div>
   </div>
   ═════════════════════════════════════════════════════ */
