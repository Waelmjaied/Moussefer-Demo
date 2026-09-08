// Cible : src/main.ts
// FIX double-click loading bug — provider explicite de change detection.
// Sans ce provider, Angular 21 émet un warning et certains callbacks async
// (STOMP, SockJS, libs tierces) peuvent ne pas déclencher la CD.

import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter, withRouterConfig } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';

import { routes } from './app/app.routes';
import { JwtInterceptor } from './app/core/interceptors/jwt.interceptor';
import { RefreshTokenInterceptor } from './app/core/interceptors/refresh-token.interceptor';

registerLocaleData(localeFr);

bootstrapApplication(AppComponent, {
  providers: [
    // ▶︎ FIX double-click : déclare explicitement la stratégie zone-based.
    //   - eventCoalescing : coalesce les évènements DOM pour éviter les
    //     ticks CD redondants (perf + stabilité).
    //   - runCoalescing : coalesce les micro-tâches Zone (idem).
    provideZoneChangeDetection({
      eventCoalescing: true,
      runCoalescing: true,
    }),

    provideRouter(
      routes,
      // ▶︎ FIX bonus : permet à la même route d'être ré-évaluée si les
      //   paramètres changent (utile quand on navigue de
      //   /voyages/abc vers /voyages/def sans démonter le composant).
      withRouterConfig({ onSameUrlNavigation: 'reload', paramsInheritanceStrategy: 'always' }),
    ),

    provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: RefreshTokenInterceptor, multi: true },

    { provide: LOCALE_ID, useValue: 'fr' },
  ],
}).catch((err) => console.error(err));
