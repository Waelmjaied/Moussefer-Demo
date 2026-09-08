import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { PassengerRoutingModule } from './passenger-routing.module';
import { SharedModule } from '../shared/shared.module';

// Components
import { TrajetSearchComponent } from './trajets/trajet-search.component';
import { VoyageSearchComponent } from './voyages/voyage-search.component';
import { ReservationDetailComponent } from './reservation-detail/reservation-detail.component';
import { MyReservationsComponent } from './my-reservations/my-reservations.component';
import { CollectiveDemandComponent } from './collective-demand/collective-demand.component';
import { PassengerPaymentsComponent } from './payments/payments.component';
import { PassengerMessagesComponent } from './messages/messages.component';
import { PassengerSettingsComponent } from './settings/settings.component';
import { PassengerProfileComponent } from './profile/profile.component';
import { PassengerDashboardComponent } from './dashboard/passenger-dashboard.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    PassengerRoutingModule,
    SharedModule,
    TrajetSearchComponent,
    VoyageSearchComponent,
    ReservationDetailComponent,
    MyReservationsComponent,
    CollectiveDemandComponent,
    PassengerPaymentsComponent,
    PassengerMessagesComponent,
    PassengerSettingsComponent,
    PassengerProfileComponent,
    PassengerDashboardComponent,
  ],
})
export class PassengerModule {}
