import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { clearJwt } from '../../utils/auth-utils';

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="store-container">
      
      <div class="store-header">
        <h1>Tienda de Aspectos</h1>
        <div class="coins-display">
          <span class="coin-icon">💰</span>
          <span class="coin-amount">{{ coins }}</span>
          <span class="coin-label">Monedas</span>
          <button class="btn-buy-coins" (click)="showCoinPackages = true">+</button>
        </div>
      </div>

      <!-- Alerts -->
      <div *ngIf="alertMsg" class="alert" [class.success]="alertType === 'success'" [class.error]="alertType === 'error'">
        <span>{{ alertMsg }}</span>
        <button (click)="alertMsg = ''">×</button>
      </div>

      <!-- Cosmetics Grid -->
      <div class="items-grid" *ngIf="items.length > 0; else noItems">
        <div class="item-card" *ngFor="let item of items" [class.card-equipped]="item.equipped">
          <div class="equipped-badge" *ngIf="item.equipped">⚔️ Equipado</div>
          <div class="item-image" [style.borderColor]="item.color || '#2e414e'">{{ item.imageUrl || '🎁' }}</div>
          <h3 class="item-name">{{ item.name }}</h3>
          <p class="item-desc">{{ item.description }}</p>
          <div class="item-color-preview">
            <span class="color-dot" [style.background]="item.color"></span>
            <span class="color-label">Color del personaje</span>
          </div>
          <div class="item-footer">
            <span class="item-price" *ngIf="!item.owned">💰 {{ item.price }}</span>
            <span class="item-owned" *ngIf="item.owned && !item.equipped">✓ Obtenido</span>
            <span class="item-equipped-label" *ngIf="item.equipped">Equipado</span>
            
            <button class="btn-buy" *ngIf="!item.owned" [disabled]="coins < item.price || isBuying" (click)="buyItem(item)">
              Comprar
            </button>
            <button class="btn-equip" *ngIf="item.owned && !item.equipped" (click)="equipItem(item)">
              Equipar
            </button>
            <button class="btn-unequip" *ngIf="item.equipped" (click)="unequipItem()">
              Desequipar
            </button>
          </div>
        </div>
      </div>
      <ng-template #noItems>
        <div class="no-items">Cargando tienda...</div>
      </ng-template>

      <!-- Buy Coins Modal -->
      <div class="modal-overlay" *ngIf="showCoinPackages">
        <div class="modal-content">
          <h2>Comprar Monedas</h2>
          <p>Selecciona el paquete que deseas adquirir:</p>
          
          <div class="packages-grid">
            <div class="package-card" *ngFor="let pkg of packages">
              <div class="pkg-coins">💰 {{ pkg.coins }}</div>
              <div class="pkg-price">\${{ pkg.priceUsd.toFixed(2) }}</div>
              <div class="pkg-actions">
                <button class="btn-payphone" (click)="buyCoins(pkg.id, 'payphone')" [disabled]="isProcessingPayment">PayPhone</button>
                <button class="btn-paypal" (click)="buyCoins(pkg.id, 'paypal')" [disabled]="isProcessingPayment">PayPal</button>
              </div>
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn-cancel" (click)="showCoinPackages = false">Cerrar</button>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');

    .store-container {
      min-height: 100vh;
      background: #1a262f;
      padding: 2rem;
      font-family: 'Inter', 'Segoe UI', sans-serif;
      color: #f8fafc;
      overflow-x: auto;
      box-sizing: border-box;
    }

    .store-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 1000px;
      margin: 0 auto 2rem auto;
      background: #23323c;
      padding: 1.5rem 2rem;
      border-radius: 16px;
      border: 1px solid #2e414e;
    }
    
    .store-header h1 {
      margin: 0;
      color: #7fffd4;
      font-weight: 800;
    }

    .coins-display {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #1a262f;
      padding: 0.75rem 1.25rem;
      border-radius: 999px;
      border: 1px solid #3db390;
    }

    .coin-icon { font-size: 1.25rem; }
    .coin-amount { font-size: 1.25rem; font-weight: 800; color: #f8fafc; }
    .coin-label { font-size: 0.9rem; color: #a2b4c1; margin-right: 0.5rem; }
    
    .btn-buy-coins {
      background: #3db390;
      color: #1a262f;
      border: none;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      font-size: 1.5rem;
      font-weight: 800;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s;
    }
    .btn-buy-coins:hover { transform: scale(1.1); background: #7fffd4; }

    .items-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
      max-width: 1000px;
      margin: 0 auto;
    }

    .item-card {
      background: #23323c;
      border: 1px solid #2e414e;
      border-radius: 16px;
      position: relative;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .item-card:hover { transform: translateY(-5px); box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
    .card-equipped { border-color: #7fffd4 !important; box-shadow: 0 0 20px rgba(127,255,212,0.15); }

    .equipped-badge {
      position: absolute; top: 12px; right: 12px;
      background: rgba(127,255,212,0.15); color: #7fffd4;
      padding: 0.25rem 0.75rem; border-radius: 999px;
      font-size: 0.8rem; font-weight: 700;
      border: 1px solid rgba(127,255,212,0.3);
    }

    .item-image {
      font-size: 4rem;
      text-align: center;
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 2rem 0;
      margin-bottom: 1rem;
      border: 2px solid transparent;
    }

    .item-color-preview {
      display: flex; align-items: center; gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .color-dot { width: 16px; height: 16px; border-radius: 50%; display: inline-block; border: 2px solid rgba(255,255,255,0.2); }
    .color-label { font-size: 0.8rem; color: #a2b4c1; }

    .item-name { margin: 0 0 0.5rem 0; font-weight: 700; color: #f8fafc; font-size: 1.2rem; }
    .item-desc { margin: 0 0 1.5rem 0; color: #a2b4c1; font-size: 0.9rem; flex-grow: 1; }

    .item-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: auto;
    }

    .item-price { font-weight: 800; color: #fcd34d; font-size: 1.1rem; }
    .item-owned { font-weight: 700; color: #3db390; font-size: 0.95rem; }

    .btn-buy, .btn-equip {
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-buy { background: #7fffd4; color: #1a262f; }
    .btn-buy:hover:not(:disabled) { background: #9effe1; }
    .btn-buy:disabled { background: #475569; color: #94a3b8; cursor: not-allowed; }
    
    .btn-equip { background: transparent; color: #3db390; border: 1px solid #3db390; }
    .btn-equip:hover { background: rgba(61,179,144,0.1); }
    .btn-unequip { padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 700; border: 1px solid #fca5a5; background: transparent; color: #fca5a5; cursor: pointer; transition: all 0.2s; }
    .btn-unequip:hover { background: rgba(248,113,113,0.1); }
    .item-equipped-label { font-weight: 700; color: #7fffd4; font-size: 0.95rem; }

    .no-items { text-align: center; color: #a2b4c1; margin-top: 3rem; font-size: 1.2rem; }

    .alert {
      max-width: 1000px; margin: 0 auto 1.5rem auto;
      padding: 1rem 1.5rem; border-radius: 12px;
      display: flex; justify-content: space-between; font-weight: 600;
    }
    .alert.success { background: rgba(127,255,212,0.1); color: #7fffd4; border: 1px solid rgba(127,255,212,0.3); }
    .alert.error { background: rgba(248,113,113,0.1); color: #fca5a5; border: 1px solid rgba(248,113,113,0.3); }
    .alert button { background: transparent; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; }

    /* Modal */
    .modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.7);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
    }
    .modal-content {
      background: #1a262f; border: 1px solid #2e414e; border-radius: 20px;
      padding: 2rem; max-width: 600px; width: 90%;
    }
    .modal-content h2 { margin: 0 0 0.5rem 0; color: #7fffd4; }
    .modal-content p { color: #a2b4c1; margin: 0 0 1.5rem 0; }

    .packages-grid {
      display: flex; flex-direction: column; gap: 1rem;
      margin-bottom: 2rem;
    }
    .package-card {
      display: flex; align-items: center; justify-content: space-between;
      background: #23323c; border: 1px solid #2e414e; border-radius: 12px;
      padding: 1rem 1.5rem;
    }
    .pkg-coins { font-weight: 800; font-size: 1.2rem; color: #fcd34d; }
    .pkg-price { font-weight: 700; color: #f8fafc; font-size: 1.1rem; }
    .pkg-actions { display: flex; gap: 0.5rem; }
    
    .btn-payphone { background: #f26522; color: #fff; border: none; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 700; cursor: pointer; }
    .btn-payphone:hover:not(:disabled) { background: #ff7f41; }
    .btn-paypal { background: #003087; color: #fff; border: none; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 700; cursor: pointer; }
    .btn-paypal:hover:not(:disabled) { background: #0045c4; }
    
    .btn-payphone:disabled, .btn-paypal:disabled { opacity: 0.5; cursor: not-allowed; }

    .modal-actions { text-align: right; }
    .btn-cancel { background: transparent; border: 1px solid #475569; color: #a2b4c1; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; cursor: pointer; }
    .btn-cancel:hover { background: rgba(255,255,255,0.05); }
  `]
})
export class StoreComponent implements OnInit {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  coins = 0;
  items: any[] = [];
  alertMsg = '';
  alertType: 'success' | 'error' = 'success';
  
  isBuying = false;
  showCoinPackages = false;
  isProcessingPayment = false;

  packages = [
    { id: 'package_1', coins: 100, priceUsd: 1.00 },
    { id: 'package_2', coins: 500, priceUsd: 4.00 },
    { id: 'package_3', coins: 1200, priceUsd: 9.00 }
  ];

  get apiUrl(): string {
    return (window as any).__env?.API_URL || 'http://localhost:3000';
  }

  get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('jwt') || ''}`
    };
  }

  async ngOnInit() {
    await this.loadStore();
  }

  async loadStore() {
    try {
      const res = await fetch(`${this.apiUrl}/api/store/items`, { headers: this.headers });
      if (res.status === 401) {
        clearJwt();
        this.router.navigate(['/login']);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      this.items = data.items || [];
      this.coins = data.coins || 0;
      this.cdr.detectChanges();
    } catch (err: any) {
      this.showAlert(err.message || 'Error cargando tienda', 'error');
    }
  }

  async buyItem(item: any) {
    if (this.coins < item.price) {
      this.showAlert('No tienes suficientes monedas', 'error');
      return;
    }
    
    this.isBuying = true;
    try {
      const res = await fetch(`${this.apiUrl}/api/store/buy`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ itemId: item.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      this.coins = data.newCoinBalance;
      item.owned = true;
      this.showAlert(`¡Has comprado ${item.name}!`, 'success');
    } catch (err: any) {
      this.showAlert(err.message || 'Error en la compra', 'error');
    } finally {
      this.isBuying = false;
      this.cdr.detectChanges();
    }
  }

  async buyCoins(packageId: string, gateway: 'paypal' | 'payphone') {
    this.isProcessingPayment = true;
    try {
      const endpoint = gateway === 'paypal' ? '/api/payments/paypal/create' : '/api/payments/payphone/create';
      const res = await fetch(`${this.apiUrl}${endpoint}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ packageId })
      });
      const data = await res.json().catch(() => ({}));
      const errorMessage = typeof data?.error === 'string'
        ? data.error
        : data?.error?.message || data?.error?.detail || 'Error al iniciar el pago';
      if (!res.ok) throw new Error(errorMessage);

      // Both give us a link/URL to redirect to for approval
      let approvalLink = '';
      if (gateway === 'paypal') approvalLink = data.approvalLink;
      if (gateway === 'payphone') approvalLink = data.payWithCard;

      if (approvalLink) {
        const popup = window.open(approvalLink, 'PaymentWindow', 'width=500,height=700,left=200,top=100');
        this.showAlert('Se ha abierto una ventana de pago. Una vez que termines, se actualizará tu saldo.', 'success');
        this.showCoinPackages = false;
        
        if (popup) {
          const timer = setInterval(() => {
            if (popup.closed) {
              clearInterval(timer);
              this.loadStore(); // Reload the store and coins when the popup closes
            }
          }, 1000);
        }
      } else {
         throw new Error('No se recibió el enlace de pago');
      }

    } catch (err: any) {
      const message = typeof err?.message === 'string' && err.message
        ? err.message
        : 'Error al iniciar pago';
      this.showAlert(message, 'error');
    } finally {
      this.isProcessingPayment = false;
      this.cdr.detectChanges();
    }
  }

  async equipItem(item: any) {
    try {
      const res = await fetch(`${this.apiUrl}/api/store/equip`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ itemId: item.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Unequip all other items locally, equip this one
      this.items.forEach(i => i.equipped = false);
      item.equipped = true;
      this.showAlert(`¡Has equipado ${item.name}!`, 'success');
    } catch (err: any) {
      this.showAlert(err.message || 'Error equipando', 'error');
    } finally {
      this.cdr.detectChanges();
    }
  }

  async unequipItem() {
    try {
      const res = await fetch(`${this.apiUrl}/api/store/equip`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ itemId: null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      this.items.forEach(i => i.equipped = false);
      this.showAlert('Aspecto desequipado. Volverás a tu color predeterminado.', 'success');
    } catch (err: any) {
      this.showAlert(err.message || 'Error desequipando', 'error');
    } finally {
      this.cdr.detectChanges();
    }
  }

  showAlert(msg: string, type: 'success' | 'error') {
    this.alertMsg = msg;
    this.alertType = type;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.alertMsg = '';
      this.cdr.detectChanges();
    }, 5000);
  }
}
