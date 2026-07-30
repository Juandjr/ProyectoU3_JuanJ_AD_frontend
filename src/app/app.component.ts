import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NavbarComponent } from './components/navbar/navbar.component';

const AUTH_ROUTES = ['/login', '/register', '/verify', '/forgot-password', '/reset-password', '/login-mfa'];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, NavbarComponent],
  template: `
    <div class="app-shell">
      <app-navbar *ngIf="showNavbar"></app-navbar>
      <main class="app-main" [style.padding-top]="showNavbar ? '64px' : '0'">
        <router-outlet></router-outlet>
      </main>
    </div>
  `
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  showNavbar = false;

  ngOnInit() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      const url = e.urlAfterRedirects || e.url || '';
      const path = url.split('?')[0];
      const isAuth = AUTH_ROUTES.some(r => path === r || path.startsWith(r));
      this.showNavbar = !isAuth && !!localStorage.getItem('jwt');
    });
  }
}