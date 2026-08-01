import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { getBackendBaseUrl } from '../../utils/backend-config';

@Component({
  selector: 'app-auth-verify',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-container">
      <div class="auth-box">
        <header class="auth-header">
          <h3>Verificación de Cuenta</h3>
          <p class="subtitle">Ingresa el código enviado a tu correo</p>
        </header>
        <div *ngIf="message" class="alert" [class.success]="messageType === 'success'" [class.error]="messageType === 'error'">
          <span>{{ message }}</span>
          <button type="button" class="alert-close" (click)="closeMessage()">×</button>
        </div>
        <div class="input-group">
          <label for="email">Correo Electrónico</label>
          <input id="email" [(ngModel)]="email" placeholder="tu@correo.com" [disabled]="emailLocked" />
        </div>
        <div class="input-group">
          <label for="code">Código de Verificación</label>
          <input id="code" [(ngModel)]="code" placeholder="6 dígitos" maxlength="6" style="text-align:center; letter-spacing:4px; font-size:1.25rem;" />
        </div>
        <button class="btn btn-primary" (click)="doVerify()" [disabled]="isSubmitting">{{ isSubmitting ? 'Verificando...' : 'Verificar Código' }}</button>
        <button class="btn btn-secondary" style="margin-top:1rem; border-radius:999px;" (click)="resendCode()" [disabled]="resendDisabled || isSubmitting">{{ resendText }}</button>
        <div class="switch-auth">¿Ya tienes tu cuenta activa? <a href="javascript:void(0)" (click)="onLoginClick()">Inicia sesión aquí</a></div>
      </div>
    </div>
  `,
  styleUrls: ['../auth-login/auth-login.component.css']
})
export class AuthVerifyComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  email = '';
  code = '';
  message = '';
  messageType: 'success' | 'error' = 'error';
  emailLocked = false;
  resendDisabled = false;
  resendText = 'Reenviar Código';
  isSubmitting = false;

  constructor() {
    this.route.queryParams.subscribe(params => {
      if (params['email']) {
        this.email = params['email'];
        this.emailLocked = true;
      }
    });
  }

  async doVerify() {
    if (this.isSubmitting) return;
    if (!this.email || !this.code) return this.showAlert('Por favor, ingresa tu correo y el código recibido.', 'error');
    try {
      this.isSubmitting = true;
      const res = await fetch(`${getBackendBaseUrl()}/api/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email, code: this.code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      localStorage.setItem('jwt', data.token);
      this.showAlert('¡Cuenta activada correctamente! Redirigiendo...', 'success');
      setTimeout(() => this.router.navigate(['/start']), 1500);
    } catch (err: any) {
      this.showAlert(err && err.message ? err.message : String(err), 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  async resendCode() {
    if (this.isSubmitting || this.resendDisabled) return;
    if (!this.email) return this.showAlert('Por favor, ingresa tu correo primero.', 'error');
    this.resendDisabled = true;
    this.resendText = 'Enviando...';
    try {
      const res = await fetch(`${getBackendBaseUrl()}/api/auth/resend-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Resend failed');
      this.showAlert('Se ha enviado un nuevo código a tu correo.', 'success');
      let countdown = 30;
      const interval = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
          clearInterval(interval);
          this.resendDisabled = false;
          this.resendText = 'Reenviar Código';
        } else {
          this.resendText = `Reenviar en ${countdown}s`;
        }
      }, 1000);
    } catch (err: any) {
      this.resendDisabled = false;
      this.resendText = 'Reenviar Código';
      this.showAlert(err && err.message ? err.message : String(err), 'error');
    }
  }

  onLoginClick() { this.router.navigate(['/login']); }
  showAlert(message: string, type: 'success' | 'error' = 'error') { this.message = message; this.messageType = type; }
  closeMessage() { this.message = ''; }
}
