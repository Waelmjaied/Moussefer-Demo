import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminRoutingModule } from './admin-routing.module';

import { RolesComponent } from './roles/roles.component';
import { TrajetsComponent } from './trajets/trajets.component';
import { StatisticsComponent } from './statistics/statistics.component';
import { ReservationsComponent } from './reservations/reservations.component';
import { PromoCodesComponent } from './promo-codes/promo-codes.component';
import { BannersComponent } from './banners/banners.component';
import { ActivityLogComponent } from './activity-log/activity-log.component';
import { PaymentsComponent } from './payments/payments.component';
import { SettingsComponent } from './settings/settings.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { StationsComponent } from './stations/stations.component';
import { FaresComponent } from './fares/fares.component';
import { FeatureTogglesComponent } from './feature-toggles/feature-toggles.component';
import { AdminNotificationsComponent } from './notifications/admin-notifications.component';
import { UserDetailModalComponent } from './user-detail-modal/user-detail-modal.component';
import { SuspendModalComponent } from './suspend-modal/suspend-modal.component';
import { VerifyModalComponent } from './verify-modal/verify-modal.component';
import { UserListComponent } from './user-list/user-list.component';
import { KycReviewComponent } from './Kyc-review/kyc-review.component';


@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AdminRoutingModule,
    UserListComponent,
    RolesComponent,
    TrajetsComponent,
    StatisticsComponent,
    ReservationsComponent,
    PromoCodesComponent,
    BannersComponent,
    ActivityLogComponent,
    PaymentsComponent,
    SettingsComponent,
    DashboardComponent,
    StationsComponent,
    FaresComponent,
    FeatureTogglesComponent,
    AdminNotificationsComponent,
    UserDetailModalComponent,
    SuspendModalComponent,
    VerifyModalComponent,
    KycReviewComponent, 
  ],
})
export class AdminModule {}
