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
    route?: string;
    disabled?: boolean;
    note?: string;
    action?: 'logout';
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

  readonly activeGroup = signal('Resumen y Seguridad');
  readonly homeRoute = '/admin/inicio';

  readonly navGroups: NavGroup[] = [
    {
      title: 'Resumen y Seguridad',
      items: [
        { label: 'Inicio admin', route: '/admin/inicio' },
        { label: 'Roles de usuario', route: '/admin/roles' },
        { label: 'Bitacora del sistema', route: '/admin/bitacora' },
      ],
    },
    {
      title: 'Seguimiento y Monitoreo del Servicio',
      items: [
        { label: 'Historial de incidentes', route: '/admin/historial-incidentes' },
        { label: 'Trazabilidad de ubicacion/llegada', route: '/admin/historial-incidentes' },
      ],
    },
    {
      title: 'Inteligencia y Gestion Estrategica',
      items: [
        { label: 'Metricas de incidentes', route: '/admin/metricas-incidentes' },
        { label: 'Comisiones', route: '/admin/comisiones' },
        {
          label: 'CU26 mas informacion / CU27 seleccion',
          route: '/admin/historial-incidentes',
          note: 'Visible en historial y detalle',
        },
      ],
    },
    {
      title: 'Cobertura actual del panel web',
      items: [
        {
          label: 'Gestion de clientes en web admin',
          disabled: true,
          note: 'Se opera desde otros frontends',
        },
        {
          label: 'Gestion operativa taller/tecnico',
          disabled: true,
          note: 'Se opera desde panel taller',
        },
        {
          label: 'Cerrar sesion',
          action: 'logout',
        },
      ],
    },
  ];

  handleAction(action?: 'logout'): void {
    if (action === 'logout') {
      this.logout();
    }
  }

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
