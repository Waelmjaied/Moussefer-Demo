import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

/**
 * Mock Konnect checkout page — used ONLY when the backend's
 * payment.konnect.mock-enabled flag is true. It simulates the experience of
 * being redirected to Konnect's hosted page so we can demo the multi-provider
 * flow end-to-end without a real Konnect sandbox account.
 *
 * <p>Flow:
 * <ol>
 *   <li>User picks Konnect → backend creates a Payment row with a fake
 *       paymentRef (prefix "mock_") and returns a payUrl pointing here.</li>
 *   <li>This page reads {@code payment_ref} + {@code amount} from query params.</li>
 *   <li>User clicks "Simuler succès" → we GET the backend's Konnect webhook
 *       endpoint with the paymentRef, which marks the Payment SUCCEEDED,
 *       transitions the reservation, and triggers invoice generation.</li>
 *   <li>User clicks "Simuler échec" → we just redirect to the cancel URL.</li>
 * </ol>
 *
 * <p>For the PFE oral, this page makes the demo work without depending on a
 * Konnect signup. The real Konnect flow uses the SAME backend code path —
 * only the network calls differ.
 */
@Component({
  selector: 'app-konnect-mock',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="min-height:100vh;background:linear-gradient(135deg,#dcfae6 0%,#e0f2fe 100%);
                display:flex;align-items:center;justify-content:center;padding:24px">
      <div style="max-width:520px;width:100%;background:#fff;border-radius:16px;
                  box-shadow:0 10px 30px rgba(0,0,0,.08);padding:32px">

        <!-- Header banner: explicit MOCK warning -->
        <div style="background:#fffbe6;border:1px solid #fde68a;border-radius:10px;
                    padding:10px 14px;font-size:12px;color:#92400e;margin-bottom:20px;
                    display:flex;align-items:center;gap:8px">
          <span style="font-size:18px">⚠️</span>
          <span><strong>Mode démo Konnect</strong> — aucune vraie transaction. Pour la
          défense PFE en l'absence de compte sandbox Konnect.</span>
        </div>

        <div style="text-align:center;margin-bottom:24px">
          <div style="font-size:32px;line-height:1;margin-bottom:8px">🇹🇳</div>
          <h2 style="font-size:20px;font-weight:700;color:#101828;margin:0">Konnect Payment</h2>
          <p style="font-size:13px;color:#667085;margin:4px 0 0">
            Paiement sécurisé via Konnect (Banque Centrale de Tunisie autorisée)
          </p>
        </div>

        <!-- Payment recap -->
        <div style="background:#f9fafb;border-radius:10px;padding:14px 18px;margin-bottom:20px;
                    font-size:13px;color:#344054">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span>Référence :</span>
            <span style="font-family:monospace;color:#667085">{{ paymentRef }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span>Réservation :</span>
            <span style="font-family:monospace;color:#667085">{{ orderId | slice:0:12 }}…</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:600;
                      color:#101828;border-top:1px solid #e4e7ec;padding-top:8px;margin-top:8px">
            <span>Montant :</span>
            <span>{{ amountTnd | number:'1.3-3' }} TND</span>
          </div>
        </div>

        <!-- Method "selector" — purely cosmetic, just for demo realism -->
        <div style="font-size:12px;font-weight:600;color:#667085;text-transform:uppercase;
                    margin-bottom:8px">Mode de paiement</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:24px">
          <div style="padding:10px;border:2px solid #12b76a;border-radius:8px;
                      background:#f6fef9;text-align:center;font-size:11px;color:#027a48">
            💳<br>Carte bancaire
          </div>
          <div style="padding:10px;border:1px solid #e4e7ec;border-radius:8px;
                      text-align:center;font-size:11px;color:#667085">
            📮<br>e-Dinar (D17)
          </div>
          <div style="padding:10px;border:1px solid #e4e7ec;border-radius:8px;
                      text-align:center;font-size:11px;color:#667085">
            👛<br>Flouci
          </div>
        </div>

        @if (processing) {
          <div style="text-align:center;padding:20px">
            <div class="spinner-border" style="color:#12b76a;width:36px;height:36px;border-width:3px"></div>
            <p style="font-size:13px;color:#667085;margin:12px 0 0">Confirmation du paiement…</p>
          </div>
        } @else {
          <button
            (click)="simulateSuccess()"
            style="width:100%;padding:14px;background:#12b76a;color:#fff;border:none;border-radius:10px;
                   font-size:15px;font-weight:600;cursor:pointer;margin-bottom:10px">
            ✓ Simuler un paiement réussi
          </button>
          <button
            (click)="simulateFailure()"
            style="width:100%;padding:12px;background:#fff;color:#dc2626;border:1px solid #fecaca;
                   border-radius:10px;font-size:13px;font-weight:500;cursor:pointer">
            ✗ Simuler une annulation / un échec
          </button>
        }

        <p style="font-size:11px;color:#98a2b3;text-align:center;margin:24px 0 0">
          En mode démo, aucune vraie transaction n'est effectuée chez Konnect.<br>
          Pour activer le mode production : <code>KONNECT_MOCK_ENABLED=false</code>
        </p>
      </div>
    </div>
  `,
})
export class KonnectMockComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);

  paymentRef = '';
  orderId = '';
  amountMillimes = 0;
  amountTnd = 0;
  processing = false;

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    this.paymentRef = qp.get('payment_ref') || '';
    this.orderId = qp.get('order_id') || '';
    this.amountMillimes = Number(qp.get('amount')) || 0;
    this.amountTnd = this.amountMillimes / 1000;
  }

  /**
   * Trigger the backend's Konnect webhook directly — same endpoint Konnect
   * itself would call in production. Backend re-verifies the status via
   * KonnectClient (which also returns a fake "completed" in mock mode), then
   * marks the Payment SUCCEEDED + emits invoice/notification events.
   */
  simulateSuccess(): void {
    if (!this.paymentRef) return;
    this.processing = true;
    const url = `${environment.apiUrl}/api/v1/payments/konnect/webhook?payment_ref=${encodeURIComponent(this.paymentRef)}`;
    this.http.get(url, { responseType: 'text' }).subscribe({
      next: () => {
        // Mirror the real Konnect redirect: passenger lands on my-reservations
        // with ?payment=success which their UI uses to show the confirmation.
        this.router.navigate(['/passenger/my-reservations'], {
          queryParams: { payment: 'success' },
        });
      },
      error: (err) => {
        this.processing = false;
        console.error('[KonnectMock] webhook call failed:', err);
        // Fall back to redirecting with an error param so the user sees something
        this.router.navigate(['/passenger/my-reservations'], {
          queryParams: { payment: 'error' },
        });
      },
    });
  }

  simulateFailure(): void {
    // Backend keeps the Payment row in PENDING; user is just bounced back.
    // The idempotent retry in PaymentService will let them try again later.
    this.router.navigate(['/passenger/my-reservations'], {
      queryParams: { payment: 'cancelled' },
    });
  }
}
