import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Public pages (no sidebar)
import { TrajetSearchComponent } from './trajets/trajet-search.component';
import { VoyageSearchComponent } from './voyages/voyage-search.component';
import { ReservationDetailComponent } from './reservation-detail/reservation-detail.component';
import { KonnectMockComponent } from './konnect-mock/konnect-mock.component';

// Dashboard pages (with profile sidebar)
import { PassengerDashboardComponent } from './dashboard/passenger-dashboard.component';
import { PassengerProfileComponent } from './profile/profile.component';
import { MyReservationsComponent } from './my-reservations/my-reservations.component';
import { PassengerMessagesComponent } from './messages/messages.component';
import { CollectiveDemandComponent } from './collective-demand/collective-demand.component';
import { PassengerPaymentsComponent } from './payments/payments.component';
import { PassengerSettingsComponent } from './settings/settings.component';
import { DisputesComponent } from './disputes/disputes.component';
import { VoyageDetailComponent } from './voyages/voyage-detail.component';
import { PassengerLoyaltyComponent } from './loyalty/loyalty.component';

const routes: Routes = [
  // ── Public pages (header/footer visible, no sidebar) ──
  { path: 'search', component: TrajetSearchComponent },
  { path: 'voyages', component: VoyageSearchComponent },
  { path: 'reservation/:id', component: ReservationDetailComponent },
  // Konnect mock checkout page — only relevant when KONNECT_MOCK_ENABLED=true
  // on the backend. The backend's fake payUrl redirects here.
  { path: 'konnect-mock', component: KonnectMockComponent },
  { path: 'collective-demand', component: CollectiveDemandComponent },

  // ── Dashboard shell (profile sidebar, no global header) ──
  {
    path: '',
    component: PassengerDashboardComponent,
    children: [
      { path: '', redirectTo: 'search', pathMatch: 'full' },
      { path: 'passenger', component: TrajetSearchComponent },
      { path: 'profile', component: PassengerProfileComponent },
      { path: 'my-reservations', component: MyReservationsComponent },
      { path: 'messages', component: PassengerMessagesComponent },

      { path: 'payments', component: PassengerPaymentsComponent },
      { path: 'settings', component: PassengerSettingsComponent },
      { path: 'disputes', component: DisputesComponent },
      { path: 'voyages', component: VoyageSearchComponent },
      { path: 'voyages/:id', component: VoyageDetailComponent },
      { path: 'loyalty', component: PassengerLoyaltyComponent },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PassengerRoutingModule {}
