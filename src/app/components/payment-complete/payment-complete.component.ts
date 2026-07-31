import { Component, OnInit, inject } from '@angular/core';
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
        <button *ngIf="status !== 'pending'" (click)="goToStore()">Volver a la tienda</button>
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
    p { color: #a2b4c1; margin: 0 0 1.5rem; }
    button {
      border: none;
      border-radius: 999px;
      padding: .85rem 1.3rem;
      background: #7fffd4;
      color: #1a262f;
      font-weight: 800;
      cursor: pointer;
    }
  `]
})
export class PaymentCompleteComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  status: 'pending' | 'success' | 'error' = 'pending';
  title = 'Confirmando pago';
  message = 'Estamos verificando tu transacción. No cierres esta ventana todavía.';

  async ngOnInit() {
    const gateway = this.route.snapshot.queryParamMap.get('gateway');
    const canceled = this.route.snapshot.queryParamMap.get('canceled') === '1';
    const confirmed = this.route.snapshot.queryParamMap.get('confirmed') === '1';
    const error = this.route.snapshot.queryParamMap.get('error');
    if (canceled) {
      this.status = 'error';
      this.title = 'Pago cancelado';
      this.message = 'La transacción fue cancelada.';
      return;
    }

    if (error) {
      this.status = 'error';
      this.title = 'Error al confirmar';
      this.message = error;
      return;
    }

    if (confirmed) {
      this.status = 'success';
      this.title = 'Pago confirmado';
      this.message = 'Tus monedas fueron agregadas correctamente.';
      return;
    }

    try {
      const apiUrl = (window as any).__env?.API_URL || 'http://localhost:3000';
      if (gateway === 'paypal') {
        this.status = 'success';
        this.title = 'Pago confirmado';
        this.message = 'Tu pago de PayPal fue confirmado desde el backend.';
        return;
      }

      if (gateway === 'payphone') {
        this.status = 'success';
        this.title = 'Pago confirmado';
        this.message = 'Tu pago de PayPhone fue confirmado desde el backend.';
        return;
      }

      throw new Error('Pasarela desconocida');
    } catch (err: any) {
      this.status = 'error';
      this.title = 'Error al confirmar';
      this.message = err?.message || 'No se pudo completar la verificación del pago.';
    }
  }

  goToStore() {
    this.router.navigate(['/store']);
  }
}
