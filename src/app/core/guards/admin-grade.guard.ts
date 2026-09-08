import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { PermissionService } from '../services/permission.service';

@Injectable({ providedIn: 'root' })
export class AdminGradeGuard {
  constructor(
    private permissionService: PermissionService,
    private router: Router,
  ) {}

  canActivate(route: any): boolean {
    const requiredRoles = route.data['requiredAdminRoles'] as string[];
    if (!requiredRoles || requiredRoles.length === 0) return true;
    if (this.permissionService.hasAdminRole(requiredRoles)) return true;
    this.router.navigate(['/admin/dashboard']);
    return false;
  }
}
