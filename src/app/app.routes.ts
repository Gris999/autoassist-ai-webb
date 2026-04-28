import { Routes } from '@angular/router';

import { AdminLayout } from './core/layouts/admin-layout/admin-layout';
import { authGuard } from './core/guards/auth.guard';
import { Login } from './features/autenticacion-seguridad/pages/login/login';
import { RegisterWorkshop } from './features/autenticacion-seguridad/pages/register-workshop/register-workshop';
import { BitacoraSistema } from './features/administracion/pages/bitacora-sistema/bitacora-sistema';
import { ComisionesPlataforma } from './features/administracion/pages/comisiones-plataforma/comisiones-plataforma';
import { GestionarRoles } from './features/administracion/pages/gestionar-roles/gestionar-roles';
import { InicioAdmin } from './features/administracion/pages/inicio-admin/inicio-admin';
import { MetricasIncidentes } from './features/administracion/pages/metricas-incidentes/metricas-incidentes';
import { DetalleSolicitud } from './features/gestion-incidentes-atencion/pages/detalle-solicitud/detalle-solicitud';
import { SolicitudesDisponibles } from './features/gestion-incidentes-atencion/pages/solicitudes-disponibles/solicitudes-disponibles';
import { DisponibilidadTaller } from './features/gestion-operativa-taller-tecnico/pages/disponibilidad-taller/disponibilidad-taller';
import { GestionarServiciosCobertura } from './features/gestion-operativa-taller-tecnico/pages/gestionar-servicios-cobertura/gestionar-servicios-cobertura';
import { GestionarTecnicos } from './features/gestion-operativa-taller-tecnico/pages/gestionar-tecnicos/gestionar-tecnicos';
import { GestionarUnidades } from './features/gestion-operativa-taller-tecnico/pages/gestionar-unidades/gestionar-unidades';
import { InicioTaller } from './features/gestion-operativa-taller-tecnico/pages/inicio-taller/inicio-taller';
import { Home } from './features/publico/pages/home/home';
import { HistorialIncidente } from './features/seguimiento-monitoreo-servicio/pages/historial-incidente/historial-incidente';
import { TallerLayout } from './core/layouts/taller-layout/taller-layout';

export const routes: Routes = [
  {
    path: '',
    component: Home,
  },
  {
    path: 'login',
    component: Login,
  },
  {
    path: 'registro/taller',
    component: RegisterWorkshop,
  },
  {
    path: 'taller',
    component: TallerLayout,
    canActivate: [authGuard],
    data: {
      allowedRoles: ['taller'],
    },
    children: [
      {
        path: '',
        component: InicioTaller,
      },
      {
        path: 'disponibilidad',
        component: DisponibilidadTaller,
      },
      {
        path: 'servicios',
        component: GestionarServiciosCobertura,
      },
      {
        path: 'tecnicos',
        component: GestionarTecnicos,
      },
      {
        path: 'unidades',
        component: GestionarUnidades,
      },
      {
        path: 'solicitudes',
        component: SolicitudesDisponibles,
      },
      {
        path: 'historial',
        component: HistorialIncidente,
      },
      {
        path: 'solicitudes/:id',
        component: DetalleSolicitud,
      },
    ],
  },
  {
    path: 'tecnico',
    component: TallerLayout,
    canActivate: [authGuard],
    data: {
      allowedRoles: ['tecnico', 'técnico'],
    },
    children: [
      {
        path: '',
        component: InicioTaller,
      },
      {
        path: 'asignaciones',
        component: SolicitudesDisponibles,
      },
      {
        path: 'seguimiento',
        component: SolicitudesDisponibles,
      },
      {
        path: 'historial',
        component: HistorialIncidente,
      },
      {
        path: 'incidentes/:id',
        component: DetalleSolicitud,
      },
      {
        path: 'solicitudes',
        redirectTo: 'asignaciones',
        pathMatch: 'full',
      },
      {
        path: 'solicitudes/:id',
        component: DetalleSolicitud,
      },
    ],
  },
  {
    path: 'admin',
    component: AdminLayout,
    canActivate: [authGuard],
    data: {
      allowedRoles: ['admin', 'administrador'],
    },
    children: [
      {
        path: '',
        redirectTo: 'inicio',
        pathMatch: 'full',
      },
      {
        path: 'inicio',
        component: InicioAdmin,
      },
      {
        path: 'roles',
        component: GestionarRoles,
      },
      {
        path: 'bitacora',
        component: BitacoraSistema,
      },
      {
        path: 'historial-incidentes',
        component: HistorialIncidente,
      },
      {
        path: 'metricas-incidentes',
        component: MetricasIncidentes,
      },
      {
        path: 'comisiones',
        component: ComisionesPlataforma,
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
