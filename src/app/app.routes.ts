import { Routes } from '@angular/router';
import { AuthLoginComponent } from './components/auth-login/auth-login.component';
import { AuthRegisterComponent } from './components/auth-register/auth-register.component';
import { AuthVerifyComponent } from './components/auth-verify/auth-verify.component';
import { AuthMfaComponent } from './components/auth-mfa/auth-mfa.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { StartScreenComponent } from './components/start-screen/start-screen.component';
import { GameCanvasComponent } from './components/game-canvas/game-canvas.component';
import { ScoreboardComponent } from './components/scoreboard/scoreboard.component';
import { ProfileComponent } from './components/profile/profile.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: AuthLoginComponent },
  { path: 'login-mfa', component: AuthMfaComponent },
  { path: 'register', component: AuthRegisterComponent },
  { path: 'verify', component: AuthVerifyComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'start', component: StartScreenComponent, canActivate: [authGuard] },
  { path: 'game', component: GameCanvasComponent, canActivate: [authGuard] },
  { path: 'scoreboard', component: ScoreboardComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'store', loadComponent: () => import('./components/store/store.component').then(m => m.StoreComponent), canActivate: [authGuard] },
  { path: '**', redirectTo: '/login' }
];
