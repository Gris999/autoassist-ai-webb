import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../../features/autenticacion-seguridad/services/auth.service';
import { TokenService } from '../../services/token.service';

interface NavGroup {
  title: string;
  items: Array<{
    label: string;
    route: string;
  }>;
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss',
})
export class AdminLayout {
  private readonly authService = inject(AuthService);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);

  readonly activeGroup = signal('Autenticacion y Seguridad');
  readonly homeRoute = '/admin/inicio';

  readonly navGroups: NavGroup[] = [
    {
      title: 'Autenticacion y Seguridad',
      items: [
        { label: 'Roles de usuario', route: '/admin/roles' },
        { label: 'Bitacora del sistema', route: '/admin/bitacora' },
      ],
    },
    {
      title: 'Gestion de Clientes',
      items: [
        { label: 'Clientes registrados', route: '/admin' },
        { label: 'Vehiculos registrados', route: '/admin' },
        { label: 'Pagos', route: '/admin' },
        { label: 'Calificaciones', route: '/admin' },
      ],
    },
    {
      title: 'Gestion Operativa de Taller y Tecnico',
      items: [
        { label: 'Talleres registrados', route: '/admin' },
        { label: 'Tecnicos registrados', route: '/admin' },
        { label: 'Servicios ofrecidos', route: '/admin' },
        { label: 'Tipos de vehiculo atendidos', route: '/admin' },
        { label: 'Disponibilidad de talleres', route: '/admin' },
        { label: 'Disponibilidad de tecnicos', route: '/admin' },
        { label: 'Unidades moviles', route: '/admin' },
      ],
    },
    {
      title: 'Gestion de Incidentes y Atencion',
      items: [
        { label: 'Incidentes reportados', route: '/admin' },
        { label: 'Incidentes disponibles', route: '/admin' },
        { label: 'Solicitudes', route: '/admin' },
        { label: 'Asignaciones', route: '/admin' },
        { label: 'Estado del servicio', route: '/admin' },
        { label: 'Incidentes asignados', route: '/admin' },
      ],
    },
    {
      title: 'Seguimiento y Monitoreo del Servicio',
      items: [
        { label: 'Estado de servicios', route: '/admin' },
        { label: 'Asignaciones de auxilio', route: '/admin' },
        { label: 'Notificaciones enviadas', route: '/admin' },
        { label: 'Historial de incidentes', route: '/admin/historial-incidentes' },
        { label: 'Ubicaciones registradas', route: '/admin' },
        { label: 'Llegadas al incidente', route: '/admin' },
      ],
    },
    {
      title: 'Inteligencia y Gestion Estrategica',
      items: [
        { label: 'Analisis IA', route: '/admin' },
        { label: 'Informacion adicional solicitada', route: '/admin' },
        { label: 'Asignaciones inteligentes', route: '/admin' },
        { label: 'Metricas de incidentes', route: '/admin/metricas-incidentes' },
        { label: 'Comisiones', route: '/admin/comisiones' },
      ],
    },
  ];

  toggleGroup(groupTitle: string): void {
    this.activeGroup.update((current) =>
      current === groupTitle ? '' : groupTitle
    );
  }

  logout(): void {
    this.authService
      .logout()
      .pipe(
        finalize(() => {
          this.tokenService.clearSession();
          this.router.navigate(['/login']);
        })
      )
      .subscribe({
        error: () => {
          // Local cleanup still happens in finalize.
        },
      });
  }
}
