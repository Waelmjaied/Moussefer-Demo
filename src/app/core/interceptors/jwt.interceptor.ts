// Cible : src/app/core/interceptors/jwt.interceptor.ts
// FIX cleanup : retire le `console.log` qui exposait toutes les URLs +
// headers (incluant l'Authorization) en prod. Garde le comportement
// fonctionnel inchangé.

import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Détection : URL complète (http://...) OU relative (/api/...)
    const isApiCall =
      req.url.includes('/api/') ||
      req.url.startsWith('http://localhost') ||
      req.url.startsWith('http://127.0.0.1');

    if (!isApiCall) {
      return next.handle(req);
    }

    const token = this.authService.getToken();
    const userId = this.authService.getUserId();
    const userRole = this.authService.getUserRole();

    const headers: Record<string, string> = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (userId) {
      headers['X-User-Id'] = userId;
    }
    if (userRole) {
      headers['X-User-Role'] = userRole;
    }

    // ▶︎ FIX : log uniquement en dev — pas en prod (fuite de tokens).
    if (!environment.production) {
      console.debug('[JwtInterceptor]', req.method, req.url, Object.keys(headers));
    }

    if (Object.keys(headers).length > 0) {
      req = req.clone({ setHeaders: headers });
    }

    return next.handle(req);
  }
}
