import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';
import { ReceptionComponent } from './modules/public/reception/reception.component';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./modules/auth/auth.module').then((m) => m.AuthModule),
  },

  {
    path: 'passenger',
    loadChildren: () =>
      import('./modules/passenger/passenger.module').then((m) => m.PassengerModule),
   // canActivate: [AuthGuard, RoleGuard],
    data: { role: 'PASSENGER' },
  },
  {
    path: 'driver',
    loadChildren: () => import('./modules/driver/driver.module').then((m) => m.DriverModule),
    //canActivate: [AuthGuard, RoleGuard],
    data: { role: 'DRIVER' },
  },
  {
    path: 'organizer',
    loadChildren: () =>
      import('./modules/organizer/organizer.module').then((m) => m.OrganizerModule),
  // canActivate: [AuthGuard, RoleGuard],
    data: { role: 'ORGANIZER' },
  },
  {
    path: 'admin',
    loadChildren: () => import('./modules/admin/admin.module').then((m) => m.AdminModule),
  // canActivate: [AuthGuard, RoleGuard],
    data: {
      role: 'ADMIN',
      adminRoles: ['SUPER_ADMIN', 'MODERATOR', 'OPERATIONAL_ADMIN', 'REPORTER', 'AUDITEUR', 'FINANCIAL_ADMIN'],
    },
  },

  {
    path: 'chat',
    loadChildren: () => import('./modules/chat/chat.module').then((m) => m.ChatModule),
   //canActivate: [AuthGuard],
  },

  // ✅ Public home (A)
  { path: '', component: ReceptionComponent, pathMatch: 'full' },

  // ✅ New: Forbidden + Not Found
  {
    path: 'forbidden',
    loadComponent: () =>
      import('./modules/shared/forbidden/forbidden.component').then((m) => m.ForbiddenComponent),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./modules/shared/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
