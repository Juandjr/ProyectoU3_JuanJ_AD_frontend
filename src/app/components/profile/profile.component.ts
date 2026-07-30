import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { clearJwt } from '../../utils/auth-utils';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="profile-container">

      <div *ngIf="user" class="profile-content">

        <!-- Header -->
        <div class="profile-header">
          <div class="avatar-circle">{{ user.username[0]?.toUpperCase() }}</div>
          <div class="user-info">
            <h1>{{ user.username }}</h1>
            <p class="user-email">{{ user.email }}</p>
            <span class="badge" [class.badge-active]="user.status === 'active'">
              {{ user.status === 'active' ? '✓ Activo' : '⚠ Inactivo' }}
            </span>
            <span class="badge badge-provider">{{ user.oauthProvider === 'google' ? '🔑 Google' : '🔒 Local' }}</span>
          </div>
          <div class="member-since">
            <span class="label">Miembro desde</span>
            <span class="date">{{ formatDate(user.createdAt) }}</span>
          </div>
        </div>

        <!-- Stats Grid -->
        <div class="stats-section">
          <h2 class="section-title">📊 Estadísticas de Juego</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon">🎮</div>
              <div class="stat-value">{{ stats.gamesPlayed }}</div>
              <div class="stat-label">Partidas Jugadas</div>
            </div>
            <div class="stat-card stat-highlight">
              <div class="stat-icon">🏆</div>
              <div class="stat-value">{{ stats.highestScore }}</div>
              <div class="stat-label">Puntaje Récord</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">⭐</div>
              <div class="stat-value">{{ stats.totalScore }}</div>
              <div class="stat-label">Puntaje Total</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">📈</div>
              <div class="stat-value">{{ stats.averageScore }}</div>
              <div class="stat-label">Promedio</div>
            </div>
          </div>
        </div>

        <!-- Recent Results -->
        <div class="recent-section" *ngIf="recentResults.length > 0">
          <h2 class="section-title">🕑 Últimas Partidas</h2>
          <div class="results-list">
            <div class="result-row" *ngFor="let r of recentResults; let i = index">
              <span class="result-rank">#{{ i + 1 }}</span>
              <span class="result-score">{{ r.score }} pts</span>
              <span class="result-date">{{ formatDate(r.date) }}</span>
            </div>
          </div>
        </div>

        <!-- MFA Section -->
        <div class="mfa-section">
          <h2 class="section-title">🔐 Autenticación de Dos Factores (MFA)</h2>
          <div class="mfa-card">
            <div class="mfa-status-row">
              <div>
                <div class="mfa-status-label">Estado</div>
                <div class="mfa-status-value" [class.mfa-on]="user.mfaEnabled" [class.mfa-off]="!user.mfaEnabled">
                  {{ user.mfaEnabled ? '🛡 MFA Activado' : '⚠ MFA Desactivado' }}
                </div>
                <p class="mfa-desc" *ngIf="!user.mfaEnabled">Protege tu cuenta añadiendo una segunda capa de verificación.</p>
                <p class="mfa-desc" *ngIf="user.mfaEnabled">Cada vez que inicies sesión, necesitarás el código de tu app autenticadora.</p>
              </div>
              <div>
                <button *ngIf="!user.mfaEnabled && !qrCode" class="btn btn-mfa-enable" (click)="startMfaSetup()">
                  Activar MFA
                </button>
                <button *ngIf="user.mfaEnabled" class="btn btn-mfa-disable" (click)="disableMfa()">
                  Desactivar MFA
                </button>
              </div>
            </div>

            <!-- QR Setup Flow -->
            <div *ngIf="qrCode" class="mfa-setup">
              <div class="qr-instructions">
                <p>1. Abre <strong>Google Authenticator</strong> o <strong>Microsoft Authenticator</strong> en tu celular.</p>
                <p>2. Escanea el código QR o usa la clave manual.</p>
                <p>3. Introduce el código generado por la app para confirmar.</p>
              </div>
              <div class="qr-container">
                <img [src]="qrCode" alt="QR Code MFA" class="qr-image" />
                <div class="manual-key">
                  <span class="manual-key-label">Clave manual:</span>
                  <code class="manual-key-code">{{ manualKey }}</code>
                </div>
              </div>
              <div class="mfa-confirm-row">
                <input
                  [(ngModel)]="mfaCode"
                  placeholder="Código de 6 dígitos"
                  maxlength="6"
                  class="mfa-input"
                  style="text-align:center; letter-spacing:4px; font-size:1.2rem;"
                />
                <button class="btn btn-mfa-confirm" (click)="confirmMfa()">Confirmar</button>
                <button class="btn btn-cancel" (click)="cancelSetup()">Cancelar</button>
              </div>
            </div>
        </div>

      </div>

      <!-- Alert outside of profile-content so it is visible if data loading fails -->
      <div *ngIf="alertMsg" class="alert" [class.success]="alertType === 'success'" [class.error]="alertType === 'error'" style="margin-top: 1.5rem;">
        <span>{{ alertMsg }}</span>
        <button type="button" (click)="alertMsg = ''" style="background:transparent; border:none; color:inherit; font-size:1.2rem; cursor:pointer;">×</button>
      </div>

    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');

    .profile-container {
      min-height: 100vh;
      background: #1a262f;
      padding: 2rem;
      font-family: 'Inter', 'Segoe UI', sans-serif;
      color: #f8fafc;
      overflow-x: auto;
      width: 100%;
      box-sizing: border-box;
    }

    .profile-content {
      max-width: 900px;
      min-width: 800px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .profile-header {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      background: #23323c;
      border: 1px solid #2e414e;
      border-radius: 20px;
      padding: 1.75rem 2rem;
    }

    .avatar-circle {
      width: 72px; height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, #7fffd4, #3db390);
      display: flex; align-items: center; justify-content: center;
      font-size: 2rem; font-weight: 800; color: #1a262f;
      flex-shrink: 0;
    }

    .user-info h1 { margin: 0; font-size: 1.6rem; font-weight: 800; color: #f8fafc; }
    .user-email { color: #a2b4c1; margin: 0.25rem 0 0.5rem; font-size: 0.9rem; }

    .badge {
      display: inline-block;
      padding: 0.2rem 0.65rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      margin-right: 0.5rem;
      background: rgba(255,255,255,0.06);
      color: #a2b4c1;
      border: 1px solid rgba(255,255,255,0.1);
    }

    .badge-active { background: rgba(127,255,212,0.12); color: #7fffd4; border-color: rgba(127,255,212,0.3); }
    .badge-provider { background: rgba(147,197,253,0.1); color: #93c5fd; border-color: rgba(147,197,253,0.2); }

    .member-since { margin-left: auto; text-align: right; }
    .member-since .label { display: block; font-size: 0.75rem; color: #a2b4c1; margin-bottom: 0.25rem; }
    .member-since .date { font-size: 0.9rem; color: #7fffd4; font-weight: 700; }

    .section-title {
      font-size: 1.1rem; font-weight: 800; color: #7fffd4;
      margin: 0 0 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #2e414e;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
    }

    .stat-card {
      background: #23323c;
      border: 1px solid #2e414e;
      border-radius: 16px;
      padding: 1.5rem;
      text-align: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .stat-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }

    .stat-highlight { border-color: rgba(127,255,212,0.3); background: rgba(127,255,212,0.05); }
    .stat-icon { font-size: 1.75rem; margin-bottom: 0.5rem; }
    .stat-value { font-size: 2rem; font-weight: 800; color: #7fffd4; margin-bottom: 0.25rem; }
    .stat-label { font-size: 0.8rem; color: #a2b4c1; font-weight: 600; }

    .results-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .result-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: #23323c;
      border: 1px solid #2e414e;
      border-radius: 10px;
      padding: 0.75rem 1rem;
    }

    .result-rank { color: #a2b4c1; font-size: 0.85rem; width: 30px; }
    .result-score { color: #7fffd4; font-weight: 800; font-size: 1rem; flex: 1; }
    .result-date { color: #a2b4c1; font-size: 0.8rem; }

    .mfa-card {
      background: #23323c;
      border: 1px solid #2e414e;
      border-radius: 16px;
      padding: 1.5rem;
    }

    .mfa-status-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .mfa-status-label { font-size: 0.8rem; color: #a2b4c1; margin-bottom: 0.3rem; text-transform: uppercase; letter-spacing: 1px; }
    .mfa-status-value { font-size: 1.05rem; font-weight: 800; margin-bottom: 0.4rem; }
    .mfa-on { color: #7fffd4; }
    .mfa-off { color: #fca5a5; }
    .mfa-desc { font-size: 0.85rem; color: #a2b4c1; margin: 0; max-width: 480px; }

    .btn { padding: 0.7rem 1.4rem; border-radius: 999px; font-size: 0.9rem; font-weight: 700; cursor: pointer; border: none; transition: all 0.2s; }
    .btn-mfa-enable { background: #7fffd4; color: #1a262f; }
    .btn-mfa-enable:hover { background: #9effe1; transform: translateY(-1px); }
    .btn-mfa-disable { background: rgba(248,113,113,0.15); color: #fca5a5; border: 1px solid rgba(248,113,113,0.3); }
    .btn-mfa-disable:hover { background: rgba(248,113,113,0.25); }
    .btn-mfa-confirm { background: #7fffd4; color: #1a262f; }
    .btn-cancel { background: #2e414e; color: #a2b4c1; }

    .mfa-setup { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #2e414e; }
    .qr-instructions p { color: #a2b4c1; font-size: 0.875rem; margin: 0.3rem 0; }
    .qr-instructions strong { color: #7fffd4; }
    .qr-container { display: flex; align-items: center; gap: 2rem; margin: 1.5rem 0; }
    .qr-image { width: 160px; height: 160px; border-radius: 12px; border: 2px solid #2e414e; }
    .manual-key-label { display: block; font-size: 0.75rem; color: #a2b4c1; margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 1px; }
    .manual-key-code { background: #1a262f; color: #7fffd4; padding: 0.5rem 0.75rem; border-radius: 8px; font-family: monospace; font-size: 0.85rem; word-break: break-all; display: block; border: 1px solid #2e414e; }

    .mfa-confirm-row { display: flex; align-items: center; gap: 0.75rem; }
    .mfa-input {
      flex: 1; max-width: 200px;
      padding: 0.7rem 1rem;
      background: #1a262f;
      border: 1px solid #2e414e;
      border-radius: 12px;
      color: #f8fafc;
      font-size: 1.2rem;
      box-sizing: border-box;
    }
    .mfa-input:focus { outline: none; border-color: #7fffd4; }

    .alert {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.9rem 1rem; border-radius: 12px;
      font-weight: 600;
    }
    .alert.success { background: rgba(127,255,212,0.1); color: #7fffd4; border: 1px solid rgba(127,255,212,0.3); }
    .alert.error { background: rgba(248,113,113,0.1); color: #fca5a5; border: 1px solid rgba(248,113,113,0.3); }
    .alert button { background: transparent; border: none; color: inherit; font-size: 1.1rem; cursor: pointer; }

    @media (max-width: 640px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .profile-header { flex-direction: column; text-align: center; }
      .member-since { margin-left: 0; text-align: center; }
      .mfa-status-row { flex-direction: column; align-items: flex-start; }
      .qr-container { flex-direction: column; align-items: center; }
    }
  `]
})
export class ProfileComponent implements OnInit {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  user: any = null;
  stats: any = { gamesPlayed: 0, highestScore: 0, totalScore: 0, averageScore: 0 };
  recentResults: any[] = [];

  // MFA
  qrCode = '';
  manualKey = '';
  mfaCode = '';

  // Alert
  alertMsg = '';
  alertType: 'success' | 'error' = 'success';

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
    await this.loadProfile();
  }

  async loadProfile() {
    try {
      const res = await fetch(`${this.apiUrl}/api/profile`, { headers: this.headers });
      if (res.status === 401) {
        clearJwt();
        this.router.navigate(['/login']);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      this.user = data.user;
      this.stats = data.stats;
      this.recentResults = data.recentResults || [];
      this.cdr.detectChanges();
    } catch (err: any) {
      console.error('Error al cargar el perfil:', err);
      this.showAlert(err.message || 'Error al cargar el perfil', 'error');
      this.cdr.detectChanges();
    }
  }

  async startMfaSetup() {
    try {
      const res = await fetch(`${this.apiUrl}/api/auth/mfa/setup`, { method: 'POST', headers: this.headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      this.qrCode = data.qrCode;
      this.manualKey = data.manualKey;
    } catch (err: any) {
      this.showAlert(err.message || 'Error al iniciar configuración MFA', 'error');
    }
  }

  async confirmMfa() {
    if (!this.mfaCode || this.mfaCode.length < 6) {
      this.showAlert('Ingresa el código de 6 dígitos de tu app autenticadora', 'error');
      return;
    }
    try {
      const res = await fetch(`${this.apiUrl}/api/auth/mfa/confirm`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ code: this.mfaCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      this.showAlert('¡MFA activado correctamente! Tu cuenta ahora está protegida.', 'success');
      this.qrCode = '';
      this.manualKey = '';
      this.mfaCode = '';
      await this.loadProfile();
    } catch (err: any) {
      this.showAlert(err.message || 'Error al confirmar MFA', 'error');
    }
  }

  async disableMfa() {
    if (!confirm('¿Estás seguro de que deseas desactivar MFA?')) return;
    try {
      const res = await fetch(`${this.apiUrl}/api/auth/mfa/disable`, { method: 'POST', headers: this.headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      this.showAlert('MFA desactivado.', 'success');
      await this.loadProfile();
    } catch (err: any) {
      this.showAlert(err.message || 'Error al desactivar MFA', 'error');
    }
  }

  cancelSetup() {
    this.qrCode = '';
    this.manualKey = '';
    this.mfaCode = '';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-EC', { year: 'numeric', month: 'short', day: 'numeric' });
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
