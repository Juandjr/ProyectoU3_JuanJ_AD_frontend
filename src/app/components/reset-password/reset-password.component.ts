import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-container">
      <div class="auth-box">
        <header class="auth-header">
          <h3>Nueva Contraseña</h3>
          <p class="subtitle">Ingresa tu nueva contraseña para restaurar el acceso</p>
        </header>

        <div *ngIf="message" class="alert" [class.success]="messageType === 'success'" [class.error]="messageType === 'error'">
          <span>{{ message }}</span>
          <button type="button" class="alert-close" (click)="closeMessage()">×</button>
        </div>

        <div class="input-group">
          <label for="password">Nueva Contraseña</label>
          <input id="password" type="password" [(ngModel)]="password" placeholder="Mínimo 6 caracteres" />
        </div>

        <div class="input-group">
          <label for="passwordConfirm">Confirmar Contraseña</label>
          <input id="passwordConfirm" type="password" [(ngModel)]="passwordConfirm" placeholder="Repite la contraseña" />
        </div>

        <button class="btn btn-primary" (click)="reset()">Restablecer Contraseña</button>

        <div class="switch-auth">
          ¿Recordaste tu contraseña? <a href="javascript:void(0)" (click)="onLoginClick()">Inicia sesión aquí</a>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['../auth-login/auth-login.component.css']
})
export class ResetPasswordComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  email = '';
  token = '';
  password = '';
  passwordConfirm = '';
  message = '';
  messageType: 'success' | 'error' = 'error';

  constructor() {
    this.route.queryParams.subscribe(params => {
      this.email = params['email'] || '';
      this.token = params['token'] || '';
    });
  }

  async reset() {
    if (!this.email || !this.token) {
      this.showAlert('Enlace de recuperación inválido o incompleto.', 'error');
      return;
    }

    if (!this.password || !this.passwordConfirm) {
      this.showAlert('Por favor, completa todos los campos.', 'error');
      return;
    }

    if (this.password !== this.passwordConfirm) {
      this.showAlert('Las contraseñas no coinciden.', 'error');
      return;
    }

    if (this.password.length < 6) {
      this.showAlert('La contraseña debe tener al menos 6 caracteres.', 'error');
      return;
    }

    try {
      const apiUrl = (window as any).__env?.API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email, token: this.token, newPassword: this.password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');

      this.showAlert('Contraseña restablecida correctamente. Redirigiendo...', 'success');
      setTimeout(() => this.router.navigate(['/login']), 1500);
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
