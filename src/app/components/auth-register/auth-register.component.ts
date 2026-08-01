import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { getBackendBaseUrl } from '../../utils/backend-config';

@Component({
  selector: 'app-auth-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth-register.component.html',
  styleUrls: ['./auth-register.component.css']
})
export class AuthRegisterComponent {
  private router = inject(Router);

  username = '';
  password = '';
  email = '';
  passwordConfirm = '';
  message = '';
  messageType: 'success' | 'error' = 'error';
  isSubmitting = false;

  async doRegister() {
    if (this.isSubmitting) return;
    if (!this.username || !this.password || !this.email || !this.passwordConfirm) {
      this.showAlert('Por favor, llena todos los campos obligatorios.', 'error');
      return;
    }
    if (this.password !== this.passwordConfirm) {
      this.showAlert('Las contraseñas no coinciden.', 'error');
      return;
    }

    try {
      this.isSubmitting = true;
      const res = await fetch(`${getBackendBaseUrl()}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: this.username, email: this.email, password: this.password, passwordConfirm: this.passwordConfirm })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Register failed');

      this.showAlert('Registrado correctamente. Se ha enviado un código de verificación a tu correo.', 'success');
      setTimeout(() => this.router.navigate(['/verify'], { queryParams: { email: this.email } }), 1500);
    } catch (err: any) {
      this.showAlert('Error en registro: ' + (err && err.message ? err.message : String(err)), 'error');
    } finally {
      this.isSubmitting = false;
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
