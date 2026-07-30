import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { clearJwt, isJwtValid } from '../utils/auth-utils';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('jwt');
  const isAuthenticated = isJwtValid(token);

  if (!isAuthenticated) {
    clearJwt();
    router.navigate(['/login']);
    return false;
  }

  return true;
};
