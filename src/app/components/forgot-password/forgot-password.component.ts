import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-container">
      <div class="auth-box">
        <header class="auth-header">
          <h3>Recuperar Contraseña</h3>
          <p class="subtitle">Enviaremos un enlace de recuperación a tu correo</p>
        </header>

        <div *ngIf="message" class="alert" [class.success]="messageType === 'success'" [class.error]="messageType === 'error'">
          <span>{{ message }}</span>
          <button type="button" class="alert-close" (click)="closeMessage()">×</button>
        </div>

        <div class="input-group">
          <label for="email">Correo Electrónico</label>
          <input id="email" [(ngModel)]="email" placeholder="Introduce tu correo registrado" />
        </div>

        <button class="btn btn-primary" (click)="sendRequest()">Enviar Enlace</button>

        <div class="switch-auth">
          ¿Recordaste tu contraseña? <a href="javascript:void(0)" (click)="onLoginClick()">Inicia sesión aquí</a>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['../auth-login/auth-login.component.css']
})
export class ForgotPasswordComponent {
  private router = inject(Router);

  email = '';
  message = '';
  messageType: 'success' | 'error' = 'error';

  async sendRequest() {
    if (!this.email) {
      this.showAlert('Por favor, introduce tu correo electrónico.', 'error');
      return;
    }

    try {
      const apiUrl = (window as any).__env?.API_URL || 'http://localhost:3000';
      const frontendUrl = window.location.origin;
      const res = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email, frontendUrl })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      this.showAlert(data.message || 'Solicitud enviada correctamente. Revisa tu bandeja de entrada.', 'success');
    } catch (err: any) {
      this.showAlert(err && err.message ? err.message : String(err), 'error');
    }
  }

  onLoginClick() {
    this.router.navigate(['/login']);
  }

  showAlert(message: string, type: 'success' | 'error' = 'error') {
    this.message = message;
    this.messageType = type;
  }

  closeMessage() {
    this.message = '';
  }
}
