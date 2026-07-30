import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="navbar">
      <div class="navbar-brand">
        <span class="brand-icon">🔥</span>
        <span class="brand-name">Survival</span>
      </div>
      <div class="navbar-links">
        <a routerLink="/start" routerLinkActive="active" class="nav-link">
          <span class="nav-icon">🏠</span>
          <span class="nav-text">Inicio</span>
        </a>
        <a routerLink="/scoreboard" routerLinkActive="active" class="nav-link">
          <span class="nav-icon">🏆</span>
          <span class="nav-text">Puntajes</span>
        </a>
        <a routerLink="/store" routerLinkActive="active" class="nav-link">
          <span class="nav-icon">🛒</span>
          <span class="nav-text">Tienda</span>
        </a>
        <a routerLink="/profile" routerLinkActive="active" class="nav-link">
          <span class="nav-icon">👤</span>
          <span class="nav-text">Perfil</span>
        </a>
      </div>
      <div class="navbar-actions">
        <span class="username-badge" *ngIf="username">{{ username }}</span>
        <button class="btn-logout" (click)="logout()">
          <span>🚪</span> Salir
        </button>
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 2rem;
      height: 64px;
      background: linear-gradient(90deg, #0f1a22 0%, #1a262f 50%, #0f1a22 100%);
      border-bottom: 1px solid #2e414e;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .navbar-brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
    }

    .brand-icon {
      font-size: 1.5rem;
    }

    .brand-name {
      font-size: 1.3rem;
      font-weight: 800;
      color: #7fffd4;
      letter-spacing: 1px;
    }

    .navbar-links {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 1rem;
      border-radius: 10px;
      text-decoration: none;
      color: #a2b4c1;
      font-size: 0.9rem;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .nav-link:hover {
      background: rgba(127,255,212,0.08);
      color: #7fffd4;
      transform: translateY(-1px);
    }

    .nav-link.active {
      background: rgba(127,255,212,0.12);
      color: #7fffd4;
      box-shadow: 0 0 0 1px rgba(127,255,212,0.2);
    }

    .nav-icon {
      font-size: 1rem;
    }

    .navbar-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .username-badge {
      font-size: 0.85rem;
      color: #7fffd4;
      font-weight: 700;
      padding: 0.3rem 0.75rem;
      background: rgba(127,255,212,0.1);
      border-radius: 20px;
      border: 1px solid rgba(127,255,212,0.25);
    }

    .btn-logout {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.45rem 1.1rem;
      border-radius: 999px;
      background: rgba(248,113,113,0.1);
      color: #fca5a5;
      border: 1px solid rgba(248,113,113,0.25);
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-logout:hover {
      background: rgba(248,113,113,0.2);
      color: #fecaca;
      transform: translateY(-1px);
    }
  `]
})
export class NavbarComponent {
  private router = inject(Router);
  username = '';

  constructor() {
    this.loadUsername();
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      this.loadUsername();
    });
  }

  loadUsername() {
    try {
      const token = localStorage.getItem('jwt');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.username = payload.username || '';
      }
    } catch {
      this.username = '';
    }
  }

  logout() {
    localStorage.removeItem('jwt');
    this.router.navigate(['/login']);
  }
}
