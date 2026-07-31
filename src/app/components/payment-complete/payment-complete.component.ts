import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-payment-complete',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="payment-wrap">
      <div class="payment-card" [class.ok]="status === 'success'" [class.err]="status === 'error'">
        <div class="icon">{{ status === 'success' ? '✓' : status === 'error' ? '!' : '…' }}</div>
        <h1>{{ title }}</h1>
        <p>{{ message }}</p>
      </div>
    </div>
  `,
  styles: [`
    .payment-wrap {
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: linear-gradient(180deg, #0f1a22 0%, #1a262f 100%);
      color: #f8fafc;
      padding: 2rem;
      font-family: 'Segoe UI', sans-serif;
    }
    .payment-card {
      width: min(560px, 100%);
      padding: 2rem;
      border-radius: 20px;
      background: #23323c;
      border: 1px solid #2e414e;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,.35);
    }
    .payment-card.ok { border-color: rgba(127,255,212,.5); }
    .payment-card.err { border-color: rgba(248,113,113,.5); }
    .icon {
      width: 72px;
      height: 72px;
      margin: 0 auto 1rem;
      border-radius: 50%;
      display: grid;
      place-items: center;
      font-size: 2rem;
      background: rgba(127,255,212,.12);
      color: #7fffd4;
    }
    .payment-card.err .icon { background: rgba(248,113,113,.12); color: #fca5a5; }
    h1 { margin: 0 0 .5rem; font-size: 1.6rem; }
    p { color: #a2b4c1; margin: 0; }
  `]
})
export class PaymentCompleteComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private closeTimer: number | null = null;

  status: 'pending' | 'success' | 'error' = 'pending';
  title = 'Confirmando pago';
  message = 'Estamos verificando tu transacción. No cierres esta ventana todavía.';

  ngOnInit(): void {
    const gateway = this.route.snapshot.queryParamMap.get('gateway');
    const canceled = this.route.snapshot.queryParamMap.get('canceled') === '1';
    const confirmed = this.route.snapshot.queryParamMap.get('confirmed') === '1';
    const error = this.route.snapshot.queryParamMap.get('error');

    if (canceled) {
      this.setState('error', 'Pago cancelado', 'La transacción fue cancelada.');
      return;
    }

    if (error) {
      this.setState('error', 'Error al confirmar', error);
      return;
    }

    if (confirmed || gateway === 'paypal' || gateway === 'payphone') {
      const message = gateway === 'paypal'
        ? 'Tu pago de PayPal fue confirmado correctamente.'
        : gateway === 'payphone'
          ? 'Tu pago de PayPhone fue confirmado correctamente.'
          : 'Tus monedas fueron agregadas correctamente.';
      this.setState('success', 'Pago confirmado', message);
      return;
    }

    this.setState('error', 'Error al confirmar', 'No se pudo identificar la transacción.');
  }

  ngOnDestroy(): void {
    if (this.closeTimer !== null) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  private setState(status: 'success' | 'error', title: string, message: string): void {
    this.status = status;
    this.title = title;
    this.message = message;
    this.scheduleClose();
  }

  private scheduleClose(): void {
    if (this.closeTimer !== null) {
      window.clearTimeout(this.closeTimer);
    }

    this.closeTimer = window.setTimeout(() => {
      try {
        if (window.opener && !window.opener.closed) {
          window.close();
          return;
        }
      } catch {
        // Ignore cross-window access errors and fall back to routing.
      }

      this.router.navigate(['/store']);
    }, 2500);
  }
}
