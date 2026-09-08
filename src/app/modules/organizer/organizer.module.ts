import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { OrganizerRoutingModule } from './organizer-routing.module';
import { SharedModule } from '../shared/shared.module';

import { MyVoyagesComponent } from './my-voyages/my-voyages.component';
import { ReservationsComponent } from './reservations/reservations.component';
import { OrganizerPromoCodesComponent} from './promo-codes/promo-code.component';
import { OrganizerDashboardComponent } from './dashboard/organizer-dashboard.component';


@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    OrganizerRoutingModule,


  ],
})
export class OrganizerModule {}
