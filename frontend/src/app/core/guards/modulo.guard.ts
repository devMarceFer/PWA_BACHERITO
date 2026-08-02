import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Bloquea el acceso a una pantalla si el backend no autorizó el módulo correspondiente
// para este usuario (GADMAPPS.V_AUTORIZACION_USUARIOS), calculado en el login.
export function moduloGuard(nombreModulo: string): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.tieneAcceso(nombreModulo) ? true : router.createUrlTree(['/home']);
  };
}
