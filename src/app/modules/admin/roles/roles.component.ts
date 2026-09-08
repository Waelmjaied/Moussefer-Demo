// Cible : src/app/modules/admin/roles/roles.component.ts
// FIX #2 (admin wiring) :
//   - submitRole (create + edit) branché sur createAdminRole / updateAdminRole
//   - savePermissions branché sur updateAdminRole (PUT avec permissions)
//   - deleteRole : choix entre deactivate (soft, garde l'historique) ou
//     delete (hard, ne marche que sur les rôles custom non-système).
//   - HTTP methods alignés sur le backend (PATCH pour activate/deactivate).

import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AdminService, AdminRoleRequest } from '../../../core/services/admin.service';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';
import { ToastService } from '../../../core/services/toast.service';

interface RoleDef {
  id: string;
  name: string;
  label: string;
  description: string;
  color: string;
  userCount: number;
  isSystem?: boolean;
}

interface ModulePermission {
  module: string;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AdminSidebarComponent],
  templateUrl: './roles.component.html',
  styleUrls: ['./roles.component.css'],
})
export class RolesComponent implements OnInit {
  currentDate = '';
  moduleCode = 'M01';
  pageTitle = 'Gestion des accès et droits';

  roles: RoleDef[] = [];
  selectableRoles: RoleDef[] = [];
  selectedRole: RoleDef | null = null;
  rolePermissions: ModulePermission[] = [];

  showModal = false;
  isCreateMode = true;
  modalTitle = 'Créer un nouveau rôle';
  roleForm: FormGroup;
  modalPermissions: ModulePermission[] = [];
  saving = false;
  editingRoleId: string | null = null;

  readonly modules = [
    'Utilisateurs & Conducteurs',
    'Trajets & Louages',
    'Paiements & Commissions',
    'Stations & Départs',
    'Bannières Publicitaires',
    'Rôles & Permissions',
  ];

  private defaultRolePermissions: Record<string, ModulePermission[]> = {
    SUPER_ADMIN: [
      { module: 'Utilisateurs & Conducteurs', view: true, create: true, edit: true, delete: true },
      { module: 'Trajets & Louages', view: true, create: true, edit: true, delete: true },
      { module: 'Paiements & Commissions', view: true, create: true, edit: true, delete: true },
      { module: 'Stations & Départs', view: true, create: true, edit: true, delete: true },
      { module: 'Bannières Publicitaires', view: true, create: true, edit: true, delete: true },
      { module: 'Rôles & Permissions', view: true, create: true, edit: true, delete: true },
    ],
    OPERATIONAL_ADMIN: [
      { module: 'Utilisateurs & Conducteurs', view: true, create: true, edit: true, delete: false },
      { module: 'Trajets & Louages', view: true, create: true, edit: true, delete: true },
      { module: 'Paiements & Commissions', view: true, create: false, edit: false, delete: false },
      { module: 'Stations & Départs', view: true, create: true, edit: true, delete: false },
      { module: 'Bannières Publicitaires', view: true, create: false, edit: false, delete: false },
      { module: 'Rôles & Permissions', view: false, create: false, edit: false, delete: false },
    ],
    FINANCIAL_ADMIN: [
      {
        module: 'Utilisateurs & Conducteurs',
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      { module: 'Trajets & Louages', view: true, create: false, edit: false, delete: false },
      { module: 'Paiements & Commissions', view: true, create: true, edit: true, delete: true },
      { module: 'Stations & Départs', view: false, create: false, edit: false, delete: false },
      { module: 'Bannières Publicitaires', view: true, create: true, edit: true, delete: false },
      { module: 'Rôles & Permissions', view: false, create: false, edit: false, delete: false },
    ],
    MODERATOR: [
      { module: 'Utilisateurs & Conducteurs', view: true, create: false, edit: true, delete: true },
      { module: 'Trajets & Louages', view: true, create: false, edit: true, delete: true },
      { module: 'Paiements & Commissions', view: true, create: false, edit: false, delete: false },
      { module: 'Stations & Départs', view: false, create: false, edit: false, delete: false },
      { module: 'Bannières Publicitaires', view: true, create: false, edit: true, delete: true },
      { module: 'Rôles & Permissions', view: false, create: false, edit: false, delete: false },
    ],
    AUDITEUR: [
      {
        module: 'Utilisateurs & Conducteurs',
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      { module: 'Trajets & Louages', view: true, create: false, edit: false, delete: false },
      { module: 'Paiements & Commissions', view: true, create: false, edit: false, delete: false },
      { module: 'Stations & Départs', view: true, create: false, edit: false, delete: false },
      { module: 'Bannières Publicitaires', view: true, create: false, edit: false, delete: false },
      { module: 'Rôles & Permissions', view: true, create: false, edit: false, delete: false },
    ],
  };

  constructor(
    private adminService: AdminService,
    private fb: FormBuilder,
    private toast: ToastService,
  ) {
    this.roleForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: ['', [Validators.required, Validators.minLength(5)]],
    });
  }

  ngOnInit(): void {
    this.setDate();
    this.loadData();
  }

  setDate(): void {
    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    this.currentDate = new Date().toLocaleDateString('fr-FR', opts);
  }

  loadData(): void {
    forkJoin({
      roles: this.adminService.listAdminRoles().pipe(catchError(() => of(null))),
      users: this.adminService.listAllUsers(0, 200).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ roles, users }) => this.mapRoles(roles, users),
      error: () => {
        this.roles = [];
        this.selectableRoles = [];
        this.rolePermissions = this.buildEmptyPermissions();
      },
    });
  }

  private mapRoles(rolesData: any, usersData: any[]): void {
    const userList = Array.isArray(usersData) ? usersData : [];
    const roleList = Array.isArray(rolesData) ? rolesData : [];

    if (roleList.length === 0) {
      this.roles = [
        {
          id: '1',
          name: 'SUPER_ADMIN',
          label: 'Super admin',
          description: 'Accès total à tous les modules',
          color: '#1e3a8a',
          userCount: 1,
          isSystem: true,
        },
        {
          id: '2',
          name: 'OPERATIONAL_ADMIN',
          label: 'Admin Opérationnel',
          description: 'Trajets, réservations, stations, conducteurs',
          color: '#3b82f6',
          userCount: 0,
        },
        {
          id: '3',
          name: 'FINANCIAL_ADMIN',
          label: 'Admin Financier',
          description: 'Paiements, transactions, rapports financiers',
          color: '#8b5cf6',
          userCount: 0,
        },
        {
          id: '4',
          name: 'MODERATOR',
          label: 'Modérateur',
          description: 'Signalements, contenus, blocages',
          color: '#f59e0b',
          userCount: 0,
        },
        {
          id: '5',
          name: 'AUDITEUR',
          label: 'Auditeur',
          description: 'Lecture seule — rapports & statistiques',
          color: '#64748b',
          userCount: 0,
        },
      ];
    } else {
      this.roles = roleList.map((r: any) => ({
        id: r.id ?? r.roleId ?? '',
        name: r.name ?? r.roleName ?? '',
        label: r.label ?? r.displayName ?? r.name ?? '',
        description: r.description ?? '',
        color: r.color ?? r.accentColor ?? '#64748b',
        userCount: 0,
        isSystem: r.isSystem ?? r.name === 'SUPER_ADMIN',
      }));
    }

    const counts: Record<string, number> = {};
    userList.forEach((u: any) => {
      const role = u.adminRole ?? u.role ?? 'NONE';
      counts[role] = (counts[role] || 0) + 1;
    });
    this.roles.forEach((r) => {
      if (!r.isSystem) r.userCount = counts[r.name] ?? 0;
    });

    this.selectableRoles = this.roles.filter((r) => !r.isSystem);
    if (this.selectableRoles.length > 0) {
      this.selectRole(this.selectableRoles[0]);
    } else {
      this.rolePermissions = this.buildEmptyPermissions();
    }
  }

  selectRole(role: RoleDef): void {
    this.selectedRole = role;
    this.adminService
      .getAdminRoleByName(role.name)
      .pipe(catchError(() => of(null)))
      .subscribe({
        next: (data) => {
          if (data?.permissions) {
            this.rolePermissions = this.normalizePermissions(data.permissions);
          } else {
            this.rolePermissions = this.getDefaultPermissions(role.name);
          }
        },
        error: () => {
          this.rolePermissions = this.getDefaultPermissions(role.name);
        },
      });
  }

  private getDefaultPermissions(roleName: string): ModulePermission[] {
    return this.defaultRolePermissions[roleName] ?? this.buildEmptyPermissions();
  }

  private buildEmptyPermissions(): ModulePermission[] {
    return this.modules.map((m) => ({
      module: m,
      view: false,
      create: false,
      edit: false,
      delete: false,
    }));
  }

  private normalizePermissions(perms: any[]): ModulePermission[] {
    if (!Array.isArray(perms)) return this.buildEmptyPermissions();
    return this.modules.map((m) => {
      const found = perms.find((p: any) => p.module === m || p.moduleName === m);
      return {
        module: m,
        view: found?.view ?? found?.canView ?? false,
        create: found?.create ?? found?.canCreate ?? false,
        edit: found?.edit ?? found?.canEdit ?? false,
        delete: found?.delete ?? found?.canDelete ?? false,
      };
    });
  }

  togglePermission(idx: number, action: keyof ModulePermission): void {
    const perm = this.rolePermissions[idx];
    (perm as any)[action] = !(perm as any)[action];
  }

  /**
   * ▶︎ FIX #2 : sauvegarde réelle des permissions via PUT /api/v1/admin/roles/{id}
   * (le backend AdminRoleService.update applique label, description ET permissions).
   */
  savePermissions(): void {
    if (!this.selectedRole) return;
    this.saving = true;

    const payload: AdminRoleRequest = {
      name: this.selectedRole.name,
      label: this.selectedRole.label,
      description: this.selectedRole.description,
      modules: this.modules,
      permissions: this.serializePermissions(this.rolePermissions),
    };

    this.adminService.updateAdminRole(this.selectedRole.id, payload).subscribe({
      next: () => {
        this.saving = false;
        this.toast.success(`Permissions de ${this.selectedRole!.label} enregistrées.`);
      },
      error: (err) => {
        this.saving = false;
        this.toast.error(err.error?.message || 'Erreur lors de la sauvegarde.');
      },
    });
  }

  /**
   * Sérialise les ModulePermission en strings du type
   * "Trajets & Louages:view,create" attendues par le backend.
   * Adapte ce format si ton backend attend une autre structure (objets,
   * codes...). Le contrat actuel côté backend est un List<String>.
   */
  private serializePermissions(perms: ModulePermission[]): string[] {
    return perms
      .map((p) => {
        const actions: string[] = [];
        if (p.view) actions.push('view');
        if (p.create) actions.push('create');
        if (p.edit) actions.push('edit');
        if (p.delete) actions.push('delete');
        return actions.length > 0 ? `${p.module}:${actions.join(',')}` : '';
      })
      .filter((s) => !!s);
  }

  /* ═══════════════════════════════════════════════════
     MODAL CRÉER / MODIFIER
     ═══════════════════════════════════════════════════ */
  openCreateModal(): void {
    this.isCreateMode = true;
    this.modalTitle = 'Créer un nouveau rôle';
    this.editingRoleId = null;
    this.roleForm.reset();
    this.modalPermissions = this.buildEmptyPermissions().map((p) => ({
      ...p,
      view: true,
      create: true,
      edit: true,
      delete: true,
    }));
    this.showModal = true;
  }

  openEditModal(role: RoleDef): void {
    this.isCreateMode = false;
    this.modalTitle = `Modifier le rôle — ${role.label}`;
    this.editingRoleId = role.id;
    this.roleForm.patchValue({ name: role.label, description: role.description });
    this.modalPermissions = this.getDefaultPermissions(role.name).map((p) => ({ ...p }));
    this.showModal = true;
  }

  closeModal(event?: MouseEvent): void {
    if (event && !(event.target as HTMLElement).classList.contains('modal-overlay')) {
      return;
    }
    this.showModal = false;
    this.roleForm.reset();
  }

  toggleModalPermission(idx: number, action: keyof ModulePermission): void {
    const perm = this.modalPermissions[idx];
    (perm as any)[action] = !(perm as any)[action];
  }

  /**
   * ▶︎ FIX #2 : branchement réel sur createAdminRole / updateAdminRole.
   * Le name est dérivé du label (uppercase + underscores) pour matcher
   * la regex backend `^[A-Z_]{3,50}$`.
   */
  submitRole(): void {
    if (this.roleForm.invalid) return;
    this.saving = true;

    const labelValue: string = this.roleForm.value.name;
    const description: string = this.roleForm.value.description;

    const payload: AdminRoleRequest = {
      name: this.deriveRoleName(labelValue),
      label: labelValue,
      description,
      modules: this.modules,
      permissions: this.serializePermissions(this.modalPermissions),
    };

    const request$ = this.isCreateMode
      ? this.adminService.createAdminRole(payload)
      : this.adminService.updateAdminRole(this.editingRoleId!, payload);

    request$.subscribe({
      next: () => {
        this.saving = false;
        this.showModal = false;
        this.toast.success(this.isCreateMode ? 'Rôle créé avec succès.' : 'Rôle mis à jour.');
        this.loadData();
      },
      error: (err) => {
        this.saving = false;
        this.toast.error(
          err.error?.message || 'Erreur — vérifie le nom (lettres maj + _, 3-50 caractères).',
        );
      },
    });
  }

  /**
   * Transforme "Admin Régional" en "ADMIN_REGIONAL" pour matcher la
   * contrainte regex backend ^[A-Z_]{3,50}$.
   */
  private deriveRoleName(label: string): string {
    return label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip accents
      .toUpperCase()
      .replace(/[^A-Z]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 50);
  }

  /* ═══════════════════════════════════════════════════
     ACTIONS RÔLE
     ═══════════════════════════════════════════════════ */
  viewRole(role: RoleDef): void {
    this.selectRole(role);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  /**
   * ▶︎ FIX #2 : deleteRole vraiment supprime (DELETE /api/v1/admin/roles/{id}).
   * Le backend AdminRoleService.delete refuse les rôles système (SUPER_ADMIN,
   * OPERATIONAL_ADMIN, FINANCIAL_ADMIN, MODERATOR, AUDITEUR, REPORTER) et
   * renvoie une erreur 4xx claire.
   *
   * Si tu préfères seulement désactiver (garder l'historique des audit-logs),
   * appelle `deactivateAdminRole(role.id)` à la place.
   */
  deleteRole(role: RoleDef): void {
    if (role.isSystem) {
      this.toast.error(`Le rôle système "${role.label}" ne peut pas être supprimé.`);
      return;
    }
    if (
      !confirm(
        `Supprimer définitivement le rôle "${role.label}" ? ${role.userCount} utilisateur(s) seront impactés. Cette action est irréversible.`,
      )
    ) {
      return;
    }
    this.adminService.deleteAdminRole(role.id).subscribe({
      next: () => {
        this.toast.success(`Rôle ${role.label} supprimé.`);
        this.loadData();
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Erreur lors de la suppression.');
      },
    });
  }

  /** ▶︎ FIX #2 : version "douce" — désactive sans supprimer */
  toggleRoleActive(role: RoleDef, activate: boolean): void {
    const op$ = activate
      ? this.adminService.activateAdminRole(role.id)
      : this.adminService.deactivateAdminRole(role.id);

    op$.subscribe({
      next: () => {
        this.toast.success(`Rôle ${role.label} ${activate ? 'activé' : 'désactivé'}.`);
        this.loadData();
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Erreur.');
      },
    });
  }
}
