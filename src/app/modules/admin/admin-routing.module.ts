// Cible : src/app/modules/admin/admin-routing.module.ts
// FIX #3a : ajout des routes /admin/reservations/:id et /admin/trajets/:id

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UserListComponent } from './user-list/user-list.component';
import { StatisticsComponent } from './statistics/statistics.component';
import { RolesComponent } from './roles/roles.component';
import { TrajetsComponent } from './trajets/trajets.component';
import { BannersComponent } from './banners/banners.component';
import { ActivityLogComponent } from './activity-log/activity-log.component';
import { PaymentsComponent } from './payments/payments.component';
import { SettingsComponent } from './settings/settings.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ReservationsComponent } from './reservations/reservations.component';
import { PromoCodesComponent } from './promo-codes/promo-codes.component';
import { StationsComponent } from './stations/stations.component';
import { FaresComponent } from './fares/fares.component';
import { FeatureTogglesComponent } from './feature-toggles/feature-toggles.component';
import { AdminNotificationsComponent } from './notifications/admin-notifications.component';
import { ApiMonitoringComponent } from './api-monitoring/api-monitoring.component';
import { LitigesComponent } from './litiges/litiges.component';
import { AnnulationsComponent } from './annulations/annulations.component';
import { KycReviewComponent } from './Kyc-review/kyc-review.component';

// ▶︎ FIX #3a : nouveaux composants détail
import { AdminReservationDetailComponent } from './reservation-detail/reservation-detail.component';
import { AdminTrajetDetailComponent } from './trajet-detail/trajet-detail.component';

const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },

  /* ── Litiges & annulations ── */
  { path: 'litiges', component: LitigesComponent },
  { path: 'annulations', component: AnnulationsComponent },

  /* ── Utilisateurs ── */
  { path: 'users', component: UserListComponent },

  /* ── Trajets — IMPORTANT : la route :id doit venir APRÈS la liste ── */
  { path: 'trajets', component: TrajetsComponent },
  { path: 'trajets/:id', component: AdminTrajetDetailComponent }, // ▶︎ FIX #3a

  /* ── Réservations ── */
  { path: 'reservations', component: ReservationsComponent },
  { path: 'reservations/:id', component: AdminReservationDetailComponent }, // ▶︎ FIX #3a

  /* ── Autres ── */
  { path: 'payments', component: PaymentsComponent },
  { path: 'banners', component: BannersComponent },
  { path: 'promo-codes', component: PromoCodesComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'stations', component: StationsComponent },
  { path: 'send-notifications', component: AdminNotificationsComponent },
  { path: 'roles', component: RolesComponent },
  { path: 'statistics', component: StatisticsComponent },
  { path: 'activity-log', component: ActivityLogComponent },
  { path: 'fares', component: FaresComponent },
  { path: 'feature-toggles', component: FeatureTogglesComponent },
  { path: 'api-monitoring', component: ApiMonitoringComponent },
  { path: 'kyc', component: KycReviewComponent },
  { path: 'notifications', component: AdminNotificationsComponent },

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRoutingModule {}
