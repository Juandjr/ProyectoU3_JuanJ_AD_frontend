import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { clearJwt } from '../../utils/auth-utils';

@Component({
  selector: 'app-auth-mfa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-container">
      <div class="auth-box">
        <header class="auth-header">
          <div class="mfa-shield">🛡</div>
          <h3>Verificación en Dos Pasos</h3>
          <p class="subtitle">Ingresa el código de tu app autenticadora (Google/Microsoft Authenticator)</p>
        </header>

        <div *ngIf="message" class="alert" [class.success]="messageType === 'success'" [class.error]="messageType === 'error'">
          <span>{{ message }}</span>
          <button type="button" class="alert-close" (click)="message = ''">×</button>
        </div>

        <div class="code-input-wrapper">
          <input
            id="mfaCode"
            [(ngModel)]="code"
            placeholder="000000"
            maxlength="6"
            class="code-input"
            (keyup.enter)="verify()"
            autofocus
          />
        </div>

        <button class="btn btn-primary" (click)="verify()">Verificar Código</button>

        <div class="switch-auth">
          ¿Quieres usar otra cuenta? <a href="javascript:void(0)" (click)="onLoginClick()">Volver al inicio de sesión</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 2rem;
      background: #1a262f;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .auth-box {
      width: 100%;
      max-width: 400px;
      padding: 2.5rem;
      border-radius: 18px;
      background: #23323c;
      border: 2px solid #2e414e;
      box-shadow: 0 20px 60px rgba(15,23,42,0.35);
    }

    .mfa-shield {
      font-size: 3rem;
      text-align: center;
      display: block;
      margin-bottom: 0.75rem;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    h3 {
      margin: 0;
      color: #7fffd4;
      font-size: 1.6rem;
      font-weight: 800;
      text-align: center;
    }

    .subtitle {
      margin-top: 0.5rem;
      color: #a2b4c1;
      font-size: 0.875rem;
      text-align: center;
      line-height: 1.5;
    }

    .auth-header { margin-bottom: 1.5rem; }

    .code-input-wrapper {
      display: flex;
      justify-content: center;
      margin: 1.5rem 0;
    }

    .code-input {
      width: 200px;
      padding: 1rem;
      border: 2px solid #2e414e;
      border-radius: 14px;
      background: rgba(26,38,47,0.95);
      color: #f8fafc;
      font-size: 2rem;
      font-weight: 800;
      text-align: center;
      letter-spacing: 8px;
      transition: border-color 0.2s;
    }

    .code-input:focus {
      outline: none;
      border-color: #7fffd4;
    }

    .btn {
      width: 100%;
      padding: 0.95rem;
      border-radius: 999px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-primary {
      background: #7fffd4;
      color: #1a262f;
      border: 2px solid #58dbb1;
      box-shadow: 0 8px 0px #3db390;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      background: #9effe1;
    }

    .alert {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      border-radius: 12px;
      padding: 0.9rem 1rem;
      margin-bottom: 1.25rem;
    }

    .alert.error { background: #131921; border: 1px solid rgba(248,113,113,0.25); color: #fecaca; }
    .alert.success { background: #23323c; border: 1px solid #58dbb1; color: #7fffd4; }
    .alert-close { background: transparent; border: none; color: inherit; font-size: 1.1rem; cursor: pointer; }

    .switch-auth {
      margin-top: 1.5rem;
      text-align: center;
      font-size: 0.875rem;
      color: #a2b4c1;
    }

    .switch-auth a { color: #7fffd4; text-decoration: none; font-weight: 700; }
    .switch-auth a:hover { color: #c8f7e8; text-decoration: underline; }
  `]
})
export class AuthMfaComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  email = '';
  code = '';
  message = '';
  messageType: 'success' | 'error' = 'error';

  constructor() {
    this.route.queryParams.subscribe(p => {
      this.email = p['email'] || '';
    });
  }

  async verify() {
    if (!this.code || this.code.length < 6) {
      this.message = 'Ingresa el código completo de 6 dígitos';
      this.messageType = 'error';
      return;
    }

    try {
      const apiUrl = (window as any).__env?.API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/api/auth/mfa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email, code: this.code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código inválido');
      clearJwt();
      localStorage.setItem('jwt', data.token);
      this.router.navigate(['/start']);
    } catch (err: any) {
      this.message = err.message || String(err);
      this.messageType = 'error';
      this.code = '';
    }
  }

  onLoginClick() {
    this.router.navigate(['/login']);
  }
}
