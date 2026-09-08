import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { interval, Subscription, Observable } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import jsPDF from 'jspdf';

import { TrajetService } from '../../../core/services/trajet.service';
import { VoyageService } from '../../../core/services/voyage.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { PaymentService } from '../../../core/services/payment.service';
import { LoyaltyPointsService } from '../../../core/services/loyalty-points.service';
import { DriverService } from '../../../core/services/driver.service';
import { Trajet } from '../../../core/models/trajet.model';
import { Voyage, ReservationVoyageResponse, ReserveVoyageRequest } from '../../../core/models/voyage.model';
import { ReservationResponse } from '../../../core/models/reservation.model';
import { DriverInfo } from '../../../core/models/driver.model';
import { ToastService } from '../../../core/services/toast.service';
import { AvisService } from '../../../core/services/avis.service';
import { environment } from '../../../../environments/environment';

// Stripe types
declare const Stripe: any;

@Component({
  selector: 'app-reservation-detail',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterLink],
  templateUrl: './reservation-detail.component.html',
  styleUrls: ['./reservation-detail.component.css'],
})
export class ReservationDetailComponent implements OnInit, OnDestroy {
  // ── Route & type ──
  type: 'trajet' | 'voyage' = 'trajet';
  id: string = '';

  // ── Trip/voyage data ──
  tripDetails: Trajet | null = null;
  voyageDetails: Voyage | null = null;
  seatsNeeded = 1;
  maxSeats = 0;
  totalPrice = 0;
  loading = true;
  isProcessing = false;

  // ── 3-step state machine ──
  // 'select' → 'waiting_driver' (trajet only) → 'payment' → 'confirmed'
  step: 'select' | 'waiting_driver' | 'payment' | 'confirmed' = 'select';

  // ── Reservation & polling ──
  reservation: ReservationResponse | ReservationVoyageResponse | null = null;
  pollSub: Subscription | null = null;
  countdown = 900;
  countdownSub: Subscription | null = null;

  // ── Payment ──
  promoCode = '';
  promoLoading = false;
  promoMessage = '';
  discountedPrice: number | null = null;
  paymentError = '';
  paymentLoading = false;

  // ── Provider choice ──
  paymentProvider: 'STRIPE' | 'KONNECT' | null = null;
  konnectLoading = false;
  stripeCurrency: 'EUR' | 'USD' | 'GBP' | null = null;

  readonly stripeRates: Record<'EUR' | 'USD' | 'GBP', number> = {
    EUR: 3.4,
    USD: 3.1,
    GBP: 3.95,
  };

  // ── Stripe inline ──
  stripe: any;
  cardElement: any;
  stripeClientSecret = '';
  stripeCardError = '';
  stripeProcessing = false;

  // ── Manual card form ──
  cardNumber = '';
  cardExpiry = '';
  cardCvv = '';
  cardHolderName = '';

  // ── Driver & reviews ──
  driverInfo: DriverInfo | null = null;
  driverId: string | null = null;

  private static readonly LOUAGE_MAX_SEATS = 8;

  get seatRange(): number[] {
    const available =
      this.type === 'voyage'
        ? this.voyageDetails?.availableSeats ?? 0
        : this.tripDetails?.availableSeats ?? 0;
    const cap =
      this.type === 'voyage'
        ? available
        : Math.min(available, ReservationDetailComponent.LOUAGE_MAX_SEATS);
    if (cap < 1) return [1];
    return Array.from({ length: cap }, (_, i) => i + 1);
  }

  get partyTitle(): string {
    return this.type === 'voyage' ? 'Votre Organisateur' : 'Votre chauffeur';
  }

  get partyName(): string {
    if (this.type === 'voyage') {
      return this.voyageDetails?.organizerName?.trim() || 'Organisateur';
    }
    return this.driverInfo?.name?.trim() || 'Chauffeur';
  }

  get partyInitial(): string {
    const name = this.type === 'voyage'
      ? this.voyageDetails?.organizerName
      : this.driverInfo?.name;
    return (name?.charAt(0) || '?').toUpperCase();
  }

  // ── Loyalty ──
  usePoints = false;
  pointsBalance = 0;
  pointsDiscount = 0;
  pointsConversionRate = 100;
  finalPrice = 0;

  // ── Confirmation ──
  qrCodeData = '';
  avisList: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private trajetService: TrajetService,
    private voyageService: VoyageService,
    private reservationService: ReservationService,
    private paymentService: PaymentService,
    private driverService: DriverService,
    private toast: ToastService,
    private loyaltyPointsService: LoyaltyPointsService,
    private avisService: AvisService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.id = this.route.snapshot.params['id'] ?? this.route.snapshot.params['voyageId'] ?? '';
    this.type = this.route.snapshot.queryParams['type'] || 'trajet';

    const queryStep = this.route.snapshot.queryParams['step'];
    const queryReservationId = this.route.snapshot.queryParams['reservationId'];

    if (queryStep === 'pay' && queryReservationId) {
      this.resumePayment(queryReservationId);
    } else {
      this.loadDetails();
    }

    this.loadPointsBalance();
  }

  private resumePayment(reservationId: string): void {
    this.loading = true;

    const fetch$: Observable<any[]> =
      this.type === 'voyage'
        ? this.voyageService.getMyVoyageReservations()
        : this.reservationService.getMyReservations();

    fetch$.subscribe({
      next: (reservations) => {
        const found = reservations.find((r: any) => r.id === reservationId);
        if (!found) {
          this.toast.error('Réservation introuvable');
          this.loading = false;
          this.router.navigate(['/passenger/my-reservations']);
          return;
        }

        this.reservation = found;

        const isPaid =
          found.status === 'CONFIRMED' ||
          found.status === 'PAID' ||
          (found.status || '').toUpperCase() === 'SUCCEEDED';

        const canPay =
          found.status === 'PENDING_PAYMENT' ||
          found.status === 'ACCEPTED' ||
          found.status === 'PAYMENT_PENDING';

        if (isPaid) {
          this.toast.success('Cette réservation est déjà payée.');
          this.loading = false;
          this.router.navigate(['/passenger/my-reservations']);
          return;
        }

        if (!canPay) {
          this.toast.warning('Cette réservation ne peut pas être payée actuellement.');
          this.loading = false;
          this.router.navigate(['/passenger/my-reservations']);
          return;
        }

        const detail$: Observable<any> =
          this.type === 'voyage'
            ? this.voyageService.getVoyageById(this.id)
            : this.trajetService.getTrajetById(this.id);

        detail$.subscribe({
          next: (detail) => {
            if (this.type === 'voyage') {
              this.voyageDetails = detail as Voyage;
              this.maxSeats = detail.availableSeats;
              this.driverId = detail.organizerId ?? null;
            } else {
              this.tripDetails = detail as Trajet;
              this.maxSeats = detail.availableSeats;
              this.driverId = detail.driverId?.toString() ?? null;
            }
            this.seatsNeeded = found.seatsReserved || 1;
            this.totalPrice = found.totalPrice || (this.seatsNeeded * detail.pricePerSeat);
            this.finalPrice = this.totalPrice;
            this.loading = false;
            this.initStripeAndMoveToPayment();
          },
          error: () => {
            this.loading = false;
            this.toast.error('Impossible de charger les détails');
            this.router.navigate(['/passenger/my-reservations']);
          },
        });
      },
      error: () => {
        this.loading = false;
        this.toast.error('Erreur lors de la récupération de la réservation');
        this.router.navigate(['/passenger/my-reservations']);
      },
    });
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.destroyStripe();
  }

  // ═══════════════════════════════════════════════════════
  //  STEP 1: SELECTION
  // ═══════════════════════════════════════════════════════

  loadDetails(): void {
    if (this.type === 'trajet') {
      this.trajetService.getTrajetById(this.id).subscribe({
        next: (t) => {
          this.tripDetails = t;
          this.maxSeats = t.availableSeats;
          this.updateTotal();
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.router.navigate(['/passenger/search']);
        },
      });
    } else {
      this.voyageService.getVoyageById(this.id).subscribe({
        next: (v) => {
          this.voyageDetails = v;
          this.maxSeats = v.availableSeats;
          this.updateTotal();
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.router.navigate(['/passenger/search']);
        },
      });
    }
  }

  updateTotal(): void {
    if (this.seatsNeeded < 1) this.seatsNeeded = 1;
    if (this.seatsNeeded > this.maxSeats) this.seatsNeeded = this.maxSeats;
    const price = this.tripDetails?.pricePerSeat ?? this.voyageDetails?.pricePerSeat ?? 0;
    this.totalPrice = this.seatsNeeded * price;
    this.discountedPrice = null;
    this.promoMessage = '';
    this.pointsDiscount = 0;
    this.usePoints = false;
    this.updateFinalPrice();
  }

  private get voyageMaxSeats(): number {
    return this.voyageDetails?.availableSeats ?? 1;
  }

  incrementSeats(): void {
    if (this.seatsNeeded < this.voyageMaxSeats) {
      this.seatsNeeded += 1;
      this.updateTotal();
    }
  }

  decrementSeats(): void {
    if (this.seatsNeeded > 1) {
      this.seatsNeeded -= 1;
      this.updateTotal();
    }
  }

  onSeatsInputChange(value: number | string | null): void {
    let n = Number(value);
    if (!Number.isFinite(n) || n < 1) n = 1;
    n = Math.floor(n);
    if (n > this.voyageMaxSeats) n = this.voyageMaxSeats;
    this.seatsNeeded = n;
    this.updateTotal();
  }

  togglePoints(): void {
    if (this.usePoints) {
      const payableAfterPromo = this.discountedPrice ?? this.totalPrice;
      const maxPointsValue = payableAfterPromo * this.pointsConversionRate;
      const pointsToUse = Math.min(this.pointsBalance, maxPointsValue);
      this.pointsDiscount = pointsToUse / this.pointsConversionRate;
    } else {
      this.pointsDiscount = 0;
    }
    this.updateFinalPrice();
  }

  updateFinalPrice(): void {
    const basePayable = this.discountedPrice ?? this.totalPrice;
    this.finalPrice = Math.max(0, basePayable - this.pointsDiscount);
  }

  loadPointsBalance(): void {
    this.loyaltyPointsService.getMyPoints().subscribe({
      next: (points) => (this.pointsBalance = points.points),
      error: () => {},
    });
  }

  applyPromo(): void {
    if (!this.promoCode.trim()) return;
    this.promoLoading = true;
    const reservationType = this.type === 'voyage' ? 'VOYAGE' : 'TRAJET';
    this.paymentService
      .validatePromoCode(this.promoCode, this.totalPrice, reservationType)
      .subscribe({
        next: (res) => {
          this.promoLoading = false;
          if (res.valid) {
            this.discountedPrice = res.finalAmount ?? this.totalPrice;
            this.promoMessage = `Code appliqué ! Vous économisez ${(this.totalPrice - (res.finalAmount ?? this.totalPrice)).toFixed(2)} DT`;
            if (this.usePoints) this.togglePoints();
            else this.updateFinalPrice();
          } else {
            this.promoMessage = res.message || 'Code invalide';
            this.discountedPrice = null;
            this.updateFinalPrice();
          }
        },
        error: () => {
          this.promoLoading = false;
          this.promoMessage = 'Impossible de valider le code promo';
        },
      });
  }

  private isVoyageBookable(v: Voyage | null): boolean {
    if (!v) return false;
    if (v.status !== 'OPEN') return false;
    if (v.departureDate && new Date(v.departureDate) < new Date()) return false;
    return true;
  }

  /**
   * 🔑 STEP 1 → STEP 2/3: Crée la réservation, puis :
   * - TRAJET (louage) : attente validation chauffeur avec timer
   * - VOYAGE (organisé) : paiement direct, pas d'attente
   */
  confirmReservation(): void {
    if (this.seatsNeeded < 1) return;
    this.isProcessing = true;

    if (this.type === 'trajet') {
      // ── LOUAGE : timer + attente chauffeur ──
      this.reservationService
        .createReservation({ trajetId: this.id, seatsReserved: this.seatsNeeded })
        .subscribe({
          next: (res) => {
            this.reservation = res;
            this.driverId = this.tripDetails?.driverId?.toString() ?? null;
            this.isProcessing = false;
            this.startWaitingForDriver(); // ⏱ timer + polling
          },
          error: (err) => {
            this.toast.error(err.error?.message || 'Erreur lors de la réservation');
            this.isProcessing = false;
          },
        });
    } else {
      // ── VOYAGE ORGANISÉ : pas de timer, directement paiement ──
      if (!this.id) {
        this.toast.error('ID du voyage manquant');
        this.isProcessing = false;
        return;
      }
      if (!this.isVoyageBookable(this.voyageDetails)) {
        this.toast.error('Ce voyage est déjà parti ou fermé aux réservations.');
        this.isProcessing = false;
        return;
      }

      const req: ReserveVoyageRequest = { voyageId: this.id, seats: this.seatsNeeded };
      this.voyageService.reserveVoyage(req).subscribe({
        next: (res: ReservationVoyageResponse) => {
          this.reservation = res;
          this.driverId = this.voyageDetails?.organizerId ?? null;
          this.isProcessing = false;
          // 🔑 Pas de startWaitingForDriver() — on va directement au paiement
          this.initStripeAndMoveToPayment();
        },
        error: (err) => {
          this.toast.error(err.error?.message || 'Erreur lors de la réservation');
          this.isProcessing = false;
        },
      });
    }
  }

  // ═══════════════════════════════════════════════════════
  //  STEP 2: WAITING FOR DRIVER (TRAJET UNIQUEMENT)
  // ═══════════════════════════════════════════════════════

  /**
   * ⏱ Timer + polling — UNIQUEMENT pour les trajets louage.
   * Les voyages organisés sautent cette étape.
   */
  startWaitingForDriver(): void {
    this.step = 'waiting_driver';
    this.countdown = 900;

    // Countdown timer
    const timer = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(timer);
        this.handleTimeout();
      }
      this.cdr.detectChanges();
    }, 1000);
    this.countdownSub = new Subscription();
    this.countdownSub.add(() => clearInterval(timer));

    // Poll for status changes
    this.pollSub = interval(5000)
      .pipe(
        switchMap(() => this.reservationService.getMyReservations()),
        takeWhile(() => this.step === 'waiting_driver'),
      )
      .subscribe({
        next: (reservations: any[]) => {
          const updated = reservations.find((r) => r.id === this.reservation?.id);
          if (!updated) return;
          this.reservation = updated;

          const accepted =
            updated.status === 'PENDING_PAYMENT' ||
            updated.status === 'ACCEPTED' ||
            updated.status === 'CONFIRMED';
          const refused = updated.status === 'CANCELLED' || updated.status === 'REFUSED';
          const escalated = updated.status === 'ESCALATED';

          if (accepted) {
            this.stopPolling();
            this.toast.success('Réservation acceptée ! Procédez au paiement.');
            this.initStripeAndMoveToPayment();
          } else if (refused) {
            this.stopPolling();
            this.toast.warning(`Demande refusée. ${updated.refusalReason || ''}`);
            this.step = 'select';
          } else if (escalated) {
            this.stopPolling();
            this.toast.warning("Le chauffeur n'a pas répondu à temps.");
            this.step = 'select';
          }
        },
      });
  }

  handleTimeout(): void {
    this.stopPolling();
    this.toast.error('Délai expiré (15 min). Veuillez réessayer.');
    this.step = 'select';
  }

  stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.countdownSub?.unsubscribe();
    this.pollSub = null;
    this.countdownSub = null;
  }

  get countdownDisplay(): string {
    const m = Math.floor(this.countdown / 60);
    const s = this.countdown % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ═══════════════════════════════════════════════════════
  //  STEP 3: PAYMENT
  // ═══════════════════════════════════════════════════════

  private initStripeAndMoveToPayment(): void {
    this.step = 'payment';
    this.paymentProvider = null;
    this.paymentError = '';
    this.paymentLoading = false;
  }

  chooseStripe(): void {
    this.paymentProvider = 'STRIPE';
    this.stripeCurrency = null;
    this.paymentError = '';
  }

  chooseStripeCurrency(currency: 'EUR' | 'USD' | 'GBP'): void {
    this.stripeCurrency = currency;
    this.paymentLoading = true;
    this.paymentError = '';

    this.paymentService
      .initiatePayment({
        reservationId: this.reservation!.id,
        driverId: this.driverId ?? undefined,
        type: this.type,
        provider: 'STRIPE',
        currency: currency,
        successUrl: window.location.origin + '/passenger/my-reservations?payment=success',
        cancelUrl: window.location.origin + '/passenger/reservation/' + this.id + '?type=' + this.type + '&payment=cancelled',
        promoCode: this.promoCode || undefined,
      })
      .subscribe({
        next: (res) => {
          this.paymentLoading = false;
          if ((res.status || '').toUpperCase() === 'SUCCEEDED' || (res.status || '').toUpperCase() === 'CONFIRMED') {
            this.toast.success('Paiement déjà confirmé !');
            this.finalizeConfirmation();
            return;
          }
          if (res.payUrl) {
            this.paymentProvider = 'KONNECT';
            window.location.assign(res.payUrl);
            return;
          }
          if (!res.clientSecret) {
            this.paymentError = 'Initialisation du paiement échouée : pas de clientSecret';
            return;
          }
          this.stripeClientSecret = res.clientSecret;
          setTimeout(() => this.mountStripeCard(), 0);
        },
        error: (err) => {
          this.paymentError = err.error?.message || 'Erreur initialisation paiement';
          this.paymentLoading = false;
        },
      });
  }

  chooseKonnect(): void {
    this.paymentProvider = 'KONNECT';
    this.konnectLoading = true;
    this.paymentError = '';

    this.paymentService
      .initiatePayment({
        reservationId: this.reservation!.id,
        driverId: this.driverId ?? undefined,
        organizerId: this.type === 'voyage' ? (this.driverId ?? undefined) : undefined,
        type: this.type,
        provider: 'KONNECT',
        successUrl: window.location.origin + '/passenger/my-reservations?payment=success',
        cancelUrl: window.location.origin + '/passenger/reservation/' + this.id + '?type=' + this.type + '&payment=cancelled',
        promoCode: this.promoCode || undefined,
      })
      .subscribe({
        next: (res) => {
          if ((res.status || '').toUpperCase() === 'SUCCEEDED' || (res.status || '').toUpperCase() === 'CONFIRMED') {
            this.konnectLoading = false;
            this.toast.success('Paiement déjà confirmé !');
            this.finalizeConfirmation();
            return;
          }
          if (res.clientSecret) {
            this.paymentProvider = 'STRIPE';
            this.konnectLoading = false;
            this.stripeClientSecret = res.clientSecret;
            setTimeout(() => this.mountStripeCard(), 0);
            return;
          }
          if (!res.payUrl) {
            this.konnectLoading = false;
            this.paymentError = 'Initialisation Konnect échouée : pas de payUrl';
            return;
          }
          window.location.assign(res.payUrl);
        },
        error: (err) => {
          this.konnectLoading = false;
          this.paymentError = err.error?.message || 'Erreur initialisation Konnect';
        },
      });
  }

  resetPaymentProvider(): void {
    this.paymentProvider = null;
    this.stripeCurrency = null;
    this.paymentError = '';
    this.stripeClientSecret = '';
    this.destroyStripe();
  }

  private mountStripeCard(): void {
    if (!this.stripeClientSecret) return;

    if (!environment.stripePublicKey || environment.stripePublicKey.includes('YOUR_PUBLISHABLE_KEY')) {
      this.paymentError = 'Stripe publishable key is missing in the environment config.';
      console.error('[reservation-detail] environment.stripePublicKey is not configured');
      return;
    }
    this.stripe = Stripe(environment.stripePublicKey);
    const elements = this.stripe.elements();
    this.cardElement = elements.create('card', {
      style: {
        base: {
          fontSize: '16px',
          color: '#374151',
          '::placeholder': { color: '#9ca3af' },
        },
        invalid: { color: '#dc2626' },
      },
    });

    const cardContainer = document.getElementById('stripe-card-element');
    if (cardContainer) {
      this.cardElement.mount('#stripe-card-element');
      this.cardElement.on('change', (event: any) => {
        this.stripeCardError = event.error ? event.error.message : '';
        this.cdr.detectChanges();
      });
    }
  }

  private destroyStripe(): void {
    if (this.cardElement) {
      this.cardElement.destroy();
      this.cardElement = null;
    }
  }

  formatCardNumber(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    value = value.substring(0, 16);
    const parts = value.match(/.{1,4}/g);
    const formatted = parts ? parts.join(' ') : '';
    input.value = formatted;
    this.cardNumber = formatted;
  }

  formatExpiry(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    if (value.length > 2) {
      value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    input.value = value;
    this.cardExpiry = value;
  }

  isCardFormValid(): boolean {
    const cardNumClean = this.cardNumber.replace(/\s/g, '');
    const expiryValid = /^\d{2}\/\d{2}$/.test(this.cardExpiry);
    return (
      cardNumClean.length >= 13 &&
      cardNumClean.length <= 16 &&
      expiryValid &&
      this.cardCvv.length >= 3 &&
      this.cardCvv.length <= 4 &&
      this.cardHolderName.trim().length > 0
    );
  }

  async submitCardPayment(): Promise<void> {
    if (!this.isCardFormValid()) {
      this.paymentError = 'Veuillez remplir tous les champs correctement.';
      return;
    }
    if (!this.stripe || !this.stripeClientSecret) {
      this.paymentError = 'Paiement non initialisé';
      return;
    }

    this.stripeProcessing = true;
    this.paymentError = '';

    const [expMonth, expYear] = this.cardExpiry.split('/');

    const { paymentMethod, error: pmError } = await this.stripe.createPaymentMethod({
      type: 'card',
      card: {
        number: this.cardNumber.replace(/\s/g, ''),
        exp_month: parseInt(expMonth, 10),
        exp_year: parseInt('20' + expYear, 10),
        cvc: this.cardCvv,
      },
      billing_details: {
        name: this.cardHolderName,
      },
    });

    if (pmError) {
      this.paymentError = pmError.message || 'Erreur de carte';
      this.stripeProcessing = false;
      return;
    }

    const { error, paymentIntent } = await this.stripe.confirmCardPayment(
      this.stripeClientSecret,
      {
        payment_method: paymentMethod.id,
      }
    );

    this.stripeProcessing = false;

    if (error) {
      this.paymentError = error.message;
    } else if (paymentIntent.status === 'succeeded') {
      this.toast.success('Paiement réussi !');
      this.destroyStripe();
      this.finalizeConfirmation();
    } else {
      this.paymentError = 'Statut inattendu : ' + paymentIntent.status;
    }
  }

  async submitStripePayment(): Promise<void> {
    if (!this.stripe || !this.cardElement || !this.stripeClientSecret) {
      this.paymentError = 'Paiement non initialisé';
      return;
    }

    this.stripeProcessing = true;
    this.paymentError = '';

    const { error, paymentIntent } = await this.stripe.confirmCardPayment(
      this.stripeClientSecret,
      {
        payment_method: {
          card: this.cardElement,
          billing_details: { name: 'Passenger' },
        },
      }
    );

    this.stripeProcessing = false;
    this.stripe = Stripe(environment.stripePublicKey);
    if (error) {
      this.paymentError = error.message;
      this.stripeCardError = error.message;
    } else if (paymentIntent.status === 'succeeded') {
      this.toast.success('Paiement réussi !');
      this.destroyStripe();
      this.finalizeConfirmation();
    } else {
      this.paymentError = 'Statut inattendu : ' + paymentIntent.status;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  STEP 4: CONFIRMATION
  // ═══════════════════════════════════════════════════════

  finalizeConfirmation(): void {
    this.step = 'confirmed';

    if (!this.reservation?.id) return;

    this.reservationService.getTicket(this.reservation.id).subscribe({
      next: (ticket) => {
        this.qrCodeData = 'data:image/png;base64,' + ticket.qrImageBase64;
      },
      error: (err) => {
        console.warn('Ticket non disponible pour le moment:', err);
        this.qrCodeData = '';
      },
    });

    if (this.type === 'trajet' && this.driverId) {
      this.driverService.getDriverInfo(String(this.driverId)).subscribe({
        next: (info: DriverInfo) => {
          this.driverInfo = info;
          this.avisService.getAvisForDriver(String(this.driverId)).subscribe({
            next: (a) => (this.avisList = a),
            error: () => {},
          });
        },
        error: () => {},
      });
    }
  }

  // ═══════════════════════════════════════════════════════
  //  UTILS
  // ═══════════════════════════════════════════════════════

  cancelAndGoBack(): void {
    if (this.reservation) {
      this.reservationService.cancelReservation(this.reservation.id).subscribe();
    }
    this.stopPolling();
    this.destroyStripe();
    this.router.navigate(['/passenger/search']);
  }

  goBack(): void {
    if (this.step === 'payment') {
      this.step = 'select';
      this.destroyStripe();
    } else if (this.step === 'waiting_driver') {
      this.step = 'select';
      this.stopPolling();
    } else {
      this.router.navigate(['/passenger/search']);
    }
  }

  openChat(): void {
    this.router.navigate(['/passenger/messages']);
  }

  generateInvoice(): void {
    if (!this.reservation) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Facture Moussefer', 14, 22);
    doc.setFontSize(10);
    doc.text(`Réservation n° ${this.reservation.id}`, 14, 32);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 38);
    doc.text(`Nombre de places: ${this.seatsNeeded}`, 14, 44);
    doc.text(`Total payé: ${this.finalPrice} DT`, 14, 50);

    if (this.type === 'trajet' && this.tripDetails) {
      doc.text(`Trajet: ${this.tripDetails.departureCity} → ${this.tripDetails.arrivalCity}`, 14, 56);
      doc.text(`Date départ: ${new Date(this.tripDetails.departureDate).toLocaleString()}`, 14, 62);
      if (this.driverInfo) {
        doc.text(`Chauffeur: ${this.driverInfo.name}`, 14, 68);
        doc.text(`Téléphone: ${this.driverInfo.phoneNumber}`, 14, 74);
        doc.text(`Véhicule: ${this.driverInfo.vehicleBrand} ${this.driverInfo.vehicleModel}`, 14, 80);
        doc.text(`Plaque: ${this.driverInfo.vehiclePlate}`, 14, 86);
        doc.text(`Couleur: ${this.driverInfo.vehicleColor ?? 'N/A'}`, 14, 92);
      }
    } else if (this.type === 'voyage' && this.voyageDetails) {
      doc.text(`Voyage: ${this.voyageDetails.title}`, 14, 56);
      doc.text(`Destination: ${this.voyageDetails.arrivalCity}`, 14, 62);
      doc.text(`Date départ: ${new Date(this.voyageDetails.departureDate).toLocaleDateString()}`, 14, 68);
    }
    doc.save(`facture_${this.reservation.id}.pdf`);
  }

  protected readonly confirm = confirm;
}
