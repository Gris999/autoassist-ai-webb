import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-inicio-admin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './inicio-admin.html',
  styleUrl: './inicio-admin.scss',
})
export class InicioAdmin {
  readonly cards = [
    {
      title: 'Roles y seguridad',
      description: 'Gestiona roles y revisa bitacora de acciones del sistema.',
      route: '/admin/roles',
      cta: 'Abrir roles',
      status: 'activo',
    },
    {
      title: 'Bitacora del sistema',
      description: 'Audita eventos y acciones relevantes por usuario/modulo.',
      route: '/admin/bitacora',
      cta: 'Abrir bitacora',
      status: 'activo',
    },
    {
      title: 'Historial y trazabilidad',
      description: 'Consulta el timeline de incidentes, estado, ubicacion y llegada del tecnico.',
      route: '/admin/historial-incidentes',
      cta: 'Abrir historial',
      status: 'activo',
    },
    {
      title: 'Metricas de incidentes',
      description: 'Visualiza metrica operativa para evaluacion y seguimiento ejecutivo.',
      route: '/admin/metricas-incidentes',
      cta: 'Abrir metricas',
      status: 'activo',
    },
    {
      title: 'Comisiones de plataforma',
      description: 'Revisa el estado de comisiones y su generacion operativa.',
      route: '/admin/comisiones',
      cta: 'Abrir comisiones',
      status: 'activo',
    },
    {
      title: 'Gestion de clientes y pagos',
      description: 'Este alcance se opera desde otros frontends del ecosistema.',
      cta: 'Sin modulo en este panel',
      status: 'externo',
    },
  ];
}
