import { Injectable } from '@angular/core';
import {
  CanActivate,
  CanActivateChild,
  Router,
  UrlTree,
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';

/**
 * Driver-only KYC gate.
 *
 * Verified drivers (verificationStatus === 'VERIFIED' on user-service) can
 * access the route. Anyone else — PENDING, REJECTED, no profile — is bounced
 * to /driver/documents so they can finish their KYC inscription.
 *
 * Other roles pass through untouched (RoleGuard already blocks them at the
 * /driver root, but we double-check here so this guard is safe to put on
 * any route).
 */
@Injectable({ providedIn: 'root' })
export class DriverKycGuard implements CanActivate, CanActivateChild {
  constructor(
    private userService: UserService,
    private authService: AuthService,
    private router: Router,
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    // Only enforce for drivers — other roles use their own role/admin guards.
    if (this.authService.getUserRole() !== 'DRIVER') {
      return of(true);
    }

    return this.userService.getMyProfile().pipe(
      map((profile) => {
        if (profile?.verificationStatus === 'VERIFIED') {
          return true;
        }
        // Not yet verified — send to the KYC inscription page.
        return this.router.createUrlTree(['/driver/documents']);
      }),
      // If the profile call fails (token issue, network, etc.) fall back to
      // the documents page rather than letting them into the protected area.
      catchError(() => of(this.router.createUrlTree(['/driver/documents']))),
    );
  }

  canActivateChild(): Observable<boolean | UrlTree> {
    return this.canActivate();
  }
}
