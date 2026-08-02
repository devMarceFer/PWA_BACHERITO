import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { moduloGuard } from './core/guards/modulo.guard';

export const routes: Routes = [

  {
    path: '',
    loadComponent: () => import('./features/splash_screen/splash').then(m => m.SplashComponent)
  },

  {
    path: 'bienvenida',
    loadComponent: () => import('./features/auth/bienvenida/bienvenida').then(m => m.BienvenidaComponent)
  },

  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.LoginComponent)
  },

  {
    path: 'cognito/crear',
    loadComponent: () => import('./features/cognito/crear/crear').then(m => m.CrearComponent)
  },

  {
    path: 'cognito/validar',
    loadComponent: () => import('./features/cognito/validar/validar').then(m => m.ValidarComponent)
  },

  {
    path: 'home',
    canActivate: [authGuard], // 🛡️ Protegido
    loadComponent: () => import('./features/home/home').then(m => m.HomeComponent) // <-- Apunta temporalmente a pages/
  },

  {
    path: 'ayuda',
    canActivate: [authGuard], // 🛡️ Protegido
    loadComponent: () => import('./features/ayuda/ayuda').then(m => m.AyudaComponent) // <-- Apunta temporalmente a pages/
  },

  {
    path: 'perfil',
    canActivate: [authGuard], // 🛡️ Protegido
    loadComponent: () => import('./features/perfil/perfil').then(m => m.PerfilComponent)
  },

  {
    path: 'reporta',
    canActivate: [authGuard, moduloGuard('SEGUIMIENTO_BACHE')], // 🛡️ Protegido
    loadComponent: () => import('./features/reportar/seguimiento/seguimiento').then(m => m.SeguimientoComponent)
  },

  {
    path: 'reporta/nuevo',
    canActivate: [authGuard, moduloGuard('REPORTAR_BACHE')], // 🛡️ Protegido
    loadComponent: () => import('./features/reportar/reportar/reportar').then(m => m.ReportarComponent)
  },

  {
    path: 'admin/grupos',
    canActivate: [authGuard, moduloGuard('ASIGNAR_GRUPO')], // 🛡️ Protegido
    loadComponent: () => import('./features/admin/asignar-grupo/asignar-grupo').then(m => m.AsignarGrupoComponent)
  },

  {
    path: 'admin/grupos/:id',
    canActivate: [authGuard, moduloGuard('ASIGNAR_GRUPO')], // 🛡️ Protegido
    loadComponent: () => import('./features/admin/grupo-detalle/grupo-detalle').then(m => m.GrupoDetalleComponent)
  },

  {
    path: 'mis-tareas',
    canActivate: [authGuard, moduloGuard('MIS_TAREAS')], // 🛡️ Protegido
    loadComponent: () => import('./features/mis-tareas/mis-tareas').then(m => m.MisTareasComponent)
  },

  {
    // Visible para cualquier usuario autenticado (no solo MIS_TAREAS): un usuario con solo
    // REPORTAR_BACHE también necesita poder subir sus reportes offline, y esta es la única
    // pantalla que lo hace desde que se quitó el auto-sync. Las tarjetas que sí requieren el
    // módulo MIS_TAREAS (Descargar Recursos) se ocultan dentro del propio componente.
    path: 'sincronizacion',
    canActivate: [authGuard], // 🛡️ Protegido
    loadComponent: () => import('./features/sincronizacion/sincronizacion').then(m => m.SincronizacionComponent)
  },

   // Comodín para redirigir cualquier error de ruta al inicio del flujo
  { path: '**', redirectTo: '' }
];
