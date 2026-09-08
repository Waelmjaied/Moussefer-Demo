import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PublishTrajetComponent } from './publish-trajet/publish-trajet.component';
import { MyTrajetsComponent } from './my-trajets/my-trajets.component';
import { ReservationsComponent } from './reservations/reservations.component';
import { SettingsComponent } from './Settings/settings.component';
import { DriverDashboardComponent } from './dashboard/driver-dashboard.component';
import { DriverPassengersComponent } from './passengers/passengers.component';
import { DriverMessagesComponent } from './messages/messages.component';
import { DriverHistoryComponent } from './history/history.component';
import { DriverReviewsComponent } from './reviews/reviews.component';
import { DriverCollectiveRequestsComponent } from './collective-requests/collective-requests.component';
import { DriverRevenuesComponent } from './revenues/revenues.component';

import { DriverScanQrComponent } from './scan-qr/scan-qr.component';

import { DriverKycGuard } from '../../core/guards/driver-kyc.guard';
import { DriverDocumentsComponent } from './documents/driver-documents.component';

/**
 * Driver routing — split into two tiers:
 *
 *  ALWAYS ACCESSIBLE (logged-in drivers, verified or not):
 *    - documents : KYC inscription, where unverified drivers must finish first
 *    - Settings  : profile page, shows real KYC document statuses
 *
 *  REQUIRES VERIFIED (DriverKycGuard checks verificationStatus === 'VERIFIED'):
 *    - publish, my-trajets, reservations, passengers, messages, history,
 *      reviews, collective-requests, revenues, scan-qr, dashboard
 *
 *  Unverified drivers hitting a guarded route are bounced to
 *  /driver/documents automatically.
 *
 *  Default landing for /driver/ is /driver/publish — verified drivers go
 *  straight to "Publier un trajet"; unverified drivers bounce via the
 *  guard to /driver/documents.
 */
const routes: Routes = [
  { path: '', redirectTo: 'publish', pathMatch: 'full' },

  // Always accessible (no KYC requirement)
  { path: 'documents', component: DriverDocumentsComponent },
  { path: 'Settings', component: SettingsComponent },

  // Verified-only
  { path: 'dashboard', component: DriverDashboardComponent, canActivate: [DriverKycGuard] },
  { path: 'publish', component: PublishTrajetComponent, canActivate: [DriverKycGuard] },
  { path: 'my-trajets', component: MyTrajetsComponent, canActivate: [DriverKycGuard] },
  { path: 'reservations', component: ReservationsComponent, canActivate: [DriverKycGuard] },
  { path: 'passengers', component: DriverPassengersComponent, canActivate: [DriverKycGuard] },
  { path: 'messages', component: DriverMessagesComponent, canActivate: [DriverKycGuard] },
  { path: 'history', component: DriverHistoryComponent, canActivate: [DriverKycGuard] },
  { path: 'reviews', component: DriverReviewsComponent, canActivate: [DriverKycGuard] },
  {
    path: 'collective-requests',
    component: DriverCollectiveRequestsComponent,
    canActivate: [DriverKycGuard],
  },
  { path: 'revenues', component: DriverRevenuesComponent, canActivate: [DriverKycGuard] },
  { path: 'scan-qr', component: DriverScanQrComponent, canActivate: [DriverKycGuard] },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DriverRoutingModule {}
