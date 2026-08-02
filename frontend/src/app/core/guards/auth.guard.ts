import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { CognitoService } from '../services/cognito.service';

// Revalida la sesión de Cognito (no solo el flag isLoggedIn en localStorage) antes de dejar entrar a una ruta protegida.
export const authGuard: CanActivateFn = async () => {
  const cognitoService = inject(CognitoService);
  const authService = inject(AuthService);
  const router = inject(Router);

  const sesionValida = await firstValueFrom(cognitoService.sesionValida());

  if (sesionValida) {
    return true;
  }

  authService.logout();
  return router.createUrlTree(['/login']);
};
