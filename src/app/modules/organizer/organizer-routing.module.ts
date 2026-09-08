import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OrganizerScanQrComponent } from './scan-qr/scan-qr.component';
const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/organizer-dashboard.component').then(
        (m) => m.OrganizerDashboardComponent,
      ),
  },
  {
    path: 'my-voyages',
    loadComponent: () =>
      import('./my-voyages/my-voyages.component').then((m) => m.MyVoyagesComponent),
  },
  {
    path: 'reservations',
    loadComponent: () =>
      import('./reservations/reservations.component').then((m) => m.ReservationsComponent),
  },
  {
    path: 'promo-codes',
    loadComponent: () =>
      import('./promo-codes/promo-code.component').then((m) => m.OrganizerPromoCodesComponent),
  },
  {
    path: 'messages',
    loadComponent: () =>
      import('./messages/messages.component').then((m) => m.OrganizerMessagesComponent),
  },
  {
    path: 'finances',
    loadComponent: () =>
      import('./finances/finances.component').then((m) => m.OrganizerFinancesComponent),
  },
  {
    path: 'clients',
    loadComponent: () =>
      import('./clients/clients.component').then((m) => m.OrganizerClientsComponent),
  },
  {
    path: 'statistics',
    loadComponent: () =>
      import('./statistics/statistics.component').then((m) => m.OrganizerStatisticsComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./settings/settings.component').then((m) => m.OrganizerSettingsComponent),
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'scan-qr', component: OrganizerScanQrComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OrganizerRoutingModule {}
