import { Component, OnInit, OnDestroy, Renderer2 } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { HeaderComponent } from './modules/shared/components/header/header.component';
import { FooterComponent } from './modules/shared/components/footer/footer.component';
import { IdleTimeoutService } from './core/services/IdleTimeoutService';
import { NgIf } from '@angular/common';
import { ToastComponent } from './modules/shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, NgIf, ToastComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'moussefer-frontend';
  private routerSubscription?: Subscription;

  constructor(
    private router: Router,
    private renderer: Renderer2,
    private idleTimeout: IdleTimeoutService,
  ) {}

  ngOnInit() {
    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        // Utilisation de la nouvelle méthode de vérification
        if (this.isAuthOrLandingPage()) {
          this.renderer.addClass(document.body, 'no-scroll');
        } else {
          this.renderer.removeClass(document.body, 'no-scroll');
        }
      });
  }

  ngOnDestroy() {
    this.routerSubscription?.unsubscribe();
  }

  /**
   * Vérifie si la page actuelle est une page d'authentification
   * OU la page de réception (Landing Page)
   */
  isAuthOrLandingPage(): boolean {
    const url = this.router.url.split('?')[0]; // On ignore les paramètres de recherche
    const restrictedRoutes = [
      '/auth/login',
      '/auth/register',
      '/', // Page d'accueil racine
      '/reception', // Si ton composant est sur ce path
    ];
    return restrictedRoutes.includes(url);
  }

  // Garde ce nom pour ne pas casser ton HTML si tu l'utilises déjà
  isAuthPage(): boolean {
    return this.isAuthOrLandingPage();
  }
  get isAdminRoute(): boolean {
    return this.router.url.startsWith('/admin');
  }
  get isDriverRoute(): boolean {
    return this.router.url.startsWith('/driver');
  }

  get isOrganizerRoute(): boolean {
    return this.router.url.startsWith('/organizer');
  }

  get isPassengerDashboard(): boolean {
    const url = this.router.url;
    return (
      url.startsWith('/passenger') &&
      !url.startsWith('/passenger/trajets') &&
      !url.startsWith('/passenger/reservation')
    );
  }

  get isPassengerRoute(): boolean {
    return this.router.url.startsWith('/passenger');
  }

  // helper to keep the template clean
  get hideHeaderAndFooter(): boolean {
    return (
      this.isAuthPage() ||
      this.isAdminRoute ||
      this.isDriverRoute ||
      this.isOrganizerRoute ||
      this.isPassengerDashboard
    );
  }
  get isPassengerSearchRoute(): boolean {
    return this.router.url.startsWith('/passenger/trajets');
  }
}
