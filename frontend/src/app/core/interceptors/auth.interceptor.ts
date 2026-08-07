import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

// Adjunta el JWT propio (emitido por nuestro backend tras validar el ID Token de Cognito) a las
// peticiones dirigidas a environment.apiUrl. Se omiten las peticiones que ya traen su propio
// header Authorization (ej. el login, que envía el ID Token de Cognito) y las de terceros
// (OpenStreetMap/Nominatim) que no deben recibir nuestro token.
// Maneja 401 (token expirado) → logout + redirect a /login
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.appToken();

  const esPeticionPropia = req.url.startsWith(environment.apiUrl);
  const yaTieneAuthorization = req.headers.has('Authorization');

  if (!token || !esPeticionPropia || yaTieneAuthorization) {
    return next(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          authService.logout();
          router.navigate(['/login']);
        }
        return throwError(() => error);
      })
    );
  }

  const clonada = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  });

  return next(clonada).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
