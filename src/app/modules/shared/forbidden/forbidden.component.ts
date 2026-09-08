import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-forbidden',
  imports: [CommonModule, RouterModule],
  template: `
    <div style="max-width: 720px; margin: 48px auto; padding: 0 16px;">
      <h1>403 - Access Denied</h1>
      <p>You are authenticated but you don’t have permission to access this page.</p>
      <a routerLink="/">Go back to Home</a>
    </div>
  `,
})
export class ForbiddenComponent {}
