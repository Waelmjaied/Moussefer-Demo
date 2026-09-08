import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-not-found',
  imports: [CommonModule, RouterModule],
  template: `
    <div style="max-width: 720px; margin: 48px auto; padding: 0 16px;">
      <h1>404 - Page Not Found</h1>
      <p>The page you are looking for doesn’t exist.</p>
      <a routerLink="/">Go back to Home</a>
    </div>
  `,
})
export class NotFoundComponent {}
