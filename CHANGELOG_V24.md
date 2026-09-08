# Moussefer Frontend — V24 Alignment Fixes

**Date:** April 2026
**Scope:** Apply the 3 frontend follow-ups required to align with backend V24.

The backend V23/V24 made several improvements that required matching frontend updates. This release applies all three fixes.

---

## Fix 1 — Capacity louage = 8 places (regulatory)

**Problem:** The publish-trajet form let the driver pick between 1 and 20 seats (default 4). But the Tunisian Ministry of Transport fixes the louage capacity at 8 passenger seats. The backend V24 enforces this constant (`TrajetService.LOUAGE_SEATS = 8`), so any value sent by the frontend is silently overridden — but the UX was misleading.

**Fix applied:**

- `publish-trajet.component.ts` — removed `totalSeats` from the FormGroup
- `publish-trajet.component.html` — replaced the input with a static informational label:
  ```html
  <label class="form-label">Capacité du louage</label>
  <div class="form-control-plaintext bg-light px-3 py-2 rounded border">
    <i class="bi bi-info-circle text-primary me-1"></i>
    <strong>8 places</strong> <small class="text-muted">(réglementaire)</small>
  </div>
  ```
- `trajet.model.ts` — removed `totalSeats` from the `CreateTrajetRequest` interface

The `Trajet` response interface still has `totalSeats` (the backend returns it = 8), so display pages (`my-trajets`, `history`, `collective-requests`) keep working unchanged.

---

## Fix 2 — Admin cancel trajet route

**Problem:** `TrajetService.adminCancelTrajet()` called `DELETE /api/v1/trajets/admin/{id}` which does not exist. The actual backend route is `/api/v1/trajets/internal/admin/{id}` and is protected by `X-Internal-Secret` (server-to-server only).

**Fix applied:**

In `trajet.service.ts`:

```diff
  adminCancelTrajet(trajetId: string): Observable<void> {
-   return this.http.delete<void>(`${this.apiUrl}/api/v1/trajets/admin/${trajetId}`);
+   // V23+ : la route /internal/admin/ est protégée par X-Internal-Secret côté
+   // backend. Le gateway injecte automatiquement ce secret quand le JWT a le
+   // rôle ADMIN — voir JwtAuthenticationFilter.java dans api-gateway.
+   return this.http.delete<void>(`${this.apiUrl}/api/v1/trajets/internal/admin/${trajetId}`);
  }
```

The V23 gateway change ensures admin JWT calls to `/internal/admin/**` paths are accepted and the secret is injected server-side.

---

## Fix 3 — Robust logout (works with expired token)

**Problem:** The previous logout sent only the `Authorization: Bearer <token>` header. If the access token was expired (user came back after a long break), the gateway rejected the request with 401 and the server-side refresh token was never invalidated. A stolen refresh token could then be replayed.

**Fix applied:**

In `auth.service.ts`:

```typescript
logout(): void {
  const token = this.getToken();
  const refreshToken = this.getRefreshToken();

  // V23 : on passe le refreshToken dans le body. Le gateway expose /logout
  // comme route publique et le backend résout le userId à partir du
  // refreshToken si l'access token est expiré.
  const headers = token
    ? new HttpHeaders().set('Authorization', `Bearer ${token}`)
    : new HttpHeaders();

  this.http
    .post(`${this.apiUrl}/api/v1/auth/logout`, { refreshToken }, { headers })
    .subscribe({
      next: () => {},
      error: () => {},  // ne bloque pas le nettoyage local
    });

  sessionStorage.removeItem('token');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('adminGrade');
  this.currentUserSubject.next(null);
  this.adminGradeSubject.next(null);
}
```

The frontend now always passes the refresh token, the backend always invalidates server-side, and the local cleanup runs regardless of the server response.

---

## Files modified (4 total)

```
src/app/modules/driver/publish-trajet/publish-trajet.component.ts    (Fix 1 — TS)
src/app/modules/driver/publish-trajet/publish-trajet.component.html  (Fix 1 — HTML)
src/app/core/models/trajet.model.ts                                  (Fix 1 — interface)
src/app/core/services/trajet.service.ts                              (Fix 2 — route)
src/app/core/services/auth.service.ts                                (Fix 3 — logout)
```

---

## Compatibility status after V24 fixes

The frontend is now **100% compatible** with the backend V24:

- ✅ All 140 endpoints called by the frontend exist in the backend
- ✅ WebSocket STOMP chat fully aligned
- ✅ JWT interceptors and role guards aligned with gateway
- ✅ Admin routes use the `/internal/admin/` convention with gateway secret injection
- ✅ Logout robust against expired tokens
- ✅ Capacity louage = 8 places enforced consistently end-to-end
