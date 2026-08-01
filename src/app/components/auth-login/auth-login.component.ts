import { Component, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { clearJwt } from '../../utils/auth-utils';
import { GameSocketService } from '../../services/game-socket.service';
import { getBackendBaseUrl } from '../../utils/backend-config';

@Component({
  selector: 'app-auth-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth-login.component.html',
  styleUrls: ['./auth-login.component.css']
})
export class AuthLoginComponent implements AfterViewInit {
  private router = inject(Router);
  private gameSocket = inject(GameSocketService);
  private googleInitialized = false;

  username = '';
  password = '';
  message = '';
  messageType: 'success' | 'error' = 'error';

  ngAfterViewInit() {
    this.gameSocket.disconnect();
    clearJwt();
    this.initGoogleOAuth();
  }

  async initGoogleOAuth() {
    if (this.googleInitialized) return;

    let attempts = 0;
    while (!(window as any).google && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!(window as any).google) {
      console.warn('El SDK de Google Identity Services no se pudo cargar.');
      return;
    }

    try {
      const configRes = await fetch(`${getBackendBaseUrl()}/api/auth/config`);
      if (!configRes.ok) throw new Error('No se pudo cargar la configuración de Google OAuth');
      const config = await configRes.json();
      const clientId = config.clientId;

      if (!clientId) {
        this.showAlert('Autenticación con Google no disponible: falta configuración del client ID.', 'error');
        return;
      }

      (window as any).google.accounts.id.initialize({
        client_id: clientId,
        callback: this.handleGoogleCredential.bind(this)
      });
      this.googleInitialized = true;

      const googleBtnEl = document.getElementById('googleBtn');
      if (googleBtnEl) {
        (window as any).google.accounts.id.renderButton(
          googleBtnEl,
          { theme: 'outline', size: 'large', width: 320, text: 'signin_with' }
        );
      }
    } catch (err) {
      console.error('Error al inicializar Google OAuth:', err);
    }
  }

  async handleGoogleCredential(response: any) {
    const idToken = response.credential;
    try {
      const res = await fetch(`${getBackendBaseUrl()}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google Login failed');

      if (data.requiresMfa) {
        clearJwt();
        this.router.navigate(['/login-mfa'], { queryParams: { email: data.email } });
        return;
      }

      localStorage.setItem('jwt', data.token);
      this.router.navigate(['/start']);
    } catch (err: any) {
      this.showAlert('Error de autenticación con Google: ' + (err.message || String(err)), 'error');
    }
  }

  async doLogin() {
    if (!this.username || !this.password) {
      this.showAlert('Por favor, completa todos los campos.', 'error');
      return;
    }

    try {
      const res = await fetch(`${getBackendBaseUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: this.username, password: this.password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      if (data.requiresMfa) {
        clearJwt();
        this.router.navigate(['/login-mfa'], { queryParams: { email: data.email } });
        return;
      }

      localStorage.setItem('jwt', data.token);
      this.router.navigate(['/start']);
    } catch (err: any) {
      this.showAlert(err && err.message ? err.message : String(err), 'error');
    }
  }

  onRegisterClick() { this.router.navigate(['/register']); }
  onForgotPasswordClick() { this.router.navigate(['/forgot-password']); }
  showAlert(message: string, type: 'success' | 'error' = 'error') { this.message = message; this.messageType = type; }
  closeMessage() { this.message = ''; }
}
