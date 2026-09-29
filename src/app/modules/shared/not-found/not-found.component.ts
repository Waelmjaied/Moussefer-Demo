import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-not-found',
  imports: [CommonModule, RouterModule],
  template: `
    <div class="not-found-container">
      <div class="not-found-card">
        <span class="badge">404 Error</span>
        <h1>Page not found</h1>
        <p>The page you are looking for doesn’t exist or has been moved.</p>

        <div class="actions">
          <a routerLink="/" class="btn-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Go back to Home
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .not-found-container {
        min-height: 80vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px 16px;
        font-family: system-ui,
        -apple-system,
        BlinkMacSystemFont,
        'Segoe UI',
        Roboto,
        sans-serif;
      }

      .not-found-card {
        max-width: 520px;
        width: 100%;
        text-align: center;
      }

      .badge {
        display: inline-block;
        padding: 6px 14px;
        font-size: 0.85rem;
        font-weight: 600;
        color: #6366f1;
        background: rgba(99, 102, 241, 0.1);
        border-radius: 9999px;
        margin-bottom: 16px;
      }

      h1 {
        font-size: 2.25rem;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: -0.025em;
        margin: 0 0 12px 0;
        line-height: 1.2;
      }

      p {
        font-size: 1.05rem;
        color: #64748b;
        margin: 0 0 32px 0;
        line-height: 1.6;
      }

      .actions {
        display: flex;
        justify-content: center;
      }

      .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 24px;
        font-size: 0.95rem;
        font-weight: 600;
        color: #ffffff;
        background-color: #0f172a;
        border-radius: 12px;
        text-decoration: none;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
      }

      .btn-primary:hover {
        background-color: #1e293b;
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(15, 23, 42, 0.18);
      }

      .btn-primary:active {
        transform: translateY(0);
      }

      /* Support Dark Mode out-of-the-box */
      @media (prefers-color-scheme: dark) {
        h1 {
          color: #de0d0d;
        }

        p {
          color: #94a3b8;
        }

        .badge {
          color: #818cf8;
          background: rgba(129, 140, 248, 0.15);
        }

        .btn-primary {
          background-color: #f8fafc;
          color: #0f172a;
        }

        .btn-primary:hover {
          background-color: #e2e8f0;
        }
      }
    `,
  ],
})
export class NotFoundComponent {}
