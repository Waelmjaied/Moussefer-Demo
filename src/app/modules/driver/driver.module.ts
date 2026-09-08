import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";
import { DriverRoutingModule } from "./driver-routing.module";
import { DriverDashboardComponent } from "./dashboard/driver-dashboard.component";
import { MyTrajetsComponent } from "./my-trajets/my-trajets.component";
import { PublishTrajetComponent } from "./publish-trajet/publish-trajet.component";
import { ReservationsComponent } from "./reservations/reservations.component";
import { SettingsComponent } from "./Settings/settings.component";
import { DriverSidebarComponent } from "./driver-sidebar/driver-sidebar.component";
import { DriverPassengersComponent } from "./passengers/passengers.component";
import { DriverMessagesComponent } from "./messages/messages.component";
import { DriverHistoryComponent } from "./history/history.component";
import { DriverReviewsComponent } from "./reviews/reviews.component";
import { DriverCollectiveRequestsComponent } from "./collective-requests/collective-requests.component";
import { DriverRevenuesComponent } from "./revenues/revenues.component";
import { DriverDocumentsComponent } from './documents/driver-documents.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    DriverRoutingModule,
    DriverDashboardComponent,
    MyTrajetsComponent,
    PublishTrajetComponent,
    ReservationsComponent,
    SettingsComponent,
    DriverSidebarComponent,
    DriverPassengersComponent,
    DriverMessagesComponent,
    DriverHistoryComponent,
    DriverReviewsComponent,
    DriverCollectiveRequestsComponent,
    DriverRevenuesComponent,
    DriverDocumentsComponent
  ],
})
export class DriverModule {}
