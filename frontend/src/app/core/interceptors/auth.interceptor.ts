import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

// Adjunta el JWT propio (emitido por nuestro backend tras validar el ID Token de Cognito) a las
// peticiones dirigidas a environment.apiUrl. Se omiten las peticiones que ya traen su propio
// header Authorization (ej. el login, que envía el ID Token de Cognito) y las de terceros
// (OpenStreetMap/Nominatim) que no deben recibir nuestro token.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.appToken();

  const esPeticionPropia = req.url.startsWith(environment.apiUrl);
  const yaTieneAuthorization = req.headers.has('Authorization');

  if (!token || !esPeticionPropia || yaTieneAuthorization) {
    return next(req);
  }

  const clonada = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  });

  return next(clonada);
};
