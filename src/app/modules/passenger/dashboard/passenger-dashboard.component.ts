import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { PassengerSidebarComponent } from '../passenger-sidebar/passenger-sidebar.component';

@Component({
  selector: 'app-passenger-dashboard',
  standalone: true,
  imports: [CommonModule, RouterOutlet, PassengerSidebarComponent],
  template: `
    <app-passenger-sidebar>
      <router-outlet></router-outlet>
    </app-passenger-sidebar>
  `,
})
export class PassengerDashboardComponent {}
