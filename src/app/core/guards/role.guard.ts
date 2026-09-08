import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const expectedRole = route.data['role'] as string;
    const expectedAdminRoles = (route.data['adminRoles'] as string[] | undefined) || [];

    const userRole = this.authService.getUserRole();
    const userAdminRole = this.authService.getAdminRole();

    if (userRole !== expectedRole) {
      this.router.navigate(['/forbidden']);
      return false;
    }

    if (expectedRole === 'ADMIN' && expectedAdminRoles.length > 0) {
      if (userAdminRole && expectedAdminRoles.includes(userAdminRole)) return true;
      this.router.navigate(['/forbidden']);
      return false;
    }

    return true;
  }
}
