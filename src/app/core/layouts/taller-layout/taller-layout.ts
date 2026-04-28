import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../../features/autenticacion-seguridad/services/auth.service';
import { TokenService } from '../../services/token.service';

interface NavGroup {
  title: string;
  shortLabel: string;
  items: Array<{
    label: string;
    route?: string;
    action?: 'logout';
    disabled?: boolean;
    note?: string;
  }>;
}

@Component({
  selector: 'app-taller-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './taller-layout.html',
  styleUrl: './taller-layout.scss',
})
export class TallerLayout {
  private readonly authService = inject(AuthService);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);
  readonly activeGroup = signal('Gestion Operativa de Taller y Tecnico');
  readonly sidebarCollapsed = signal(false);
  readonly isTechnicianPanel = computed(() => this.router.url.startsWith('/tecnico'));
  readonly panelLabel = computed(() =>
    this.isTechnicianPanel() ? 'Panel tecnico' : 'Panel taller'
  );
  readonly searchPlaceholder = computed(() =>
    this.isTechnicianPanel() ? 'Buscar asignacion o incidente' : 'Buscar incidente o tecnico'
  );

  readonly workshopProfile = computed(() => {
    const user = this.tokenService.getCurrentUser();
    if (!user) {
      return {
        initials: this.isTechnicianPanel() ? 'TE' : 'T',
        name: this.isTechnicianPanel() ? 'Panel del tecnico' : 'Panel del taller',
        subtitle: 'Cuenta habilitada',
      };
    }

    const initials = `${user.nombres?.[0] ?? ''}${user.apellidos?.[0] ?? ''}`
      .trim()
      .toUpperCase();

    return {
      initials: initials || (this.isTechnicianPanel() ? 'TE' : 'T'),
      name: `${user.nombres} ${user.apellidos}`.trim(),
      subtitle: user.email,
    };
  });

  readonly navGroups = computed<NavGroup[]>(() => {
    if (this.isTechnicianPanel()) {
      return [
        {
          title: 'Gestion Operativa',
          shortLabel: 'GO',
          items: [
            { label: 'Inicio', route: '/tecnico' },
            { label: 'Mi disponibilidad', route: '/tecnico' },
          ],
        },
        {
          title: 'Gestion de Incidentes',
          shortLabel: 'IA',
          items: [
            { label: 'Mis asignaciones', route: '/tecnico/asignaciones' },
            { label: 'Detalle del incidente', route: '/tecnico/incidentes/11', note: 'Desde asignaciones' },
          ],
        },
        {
          title: 'Seguimiento',
          shortLabel: 'SM',
          items: [
            { label: 'Seguimiento actual', route: '/tecnico/seguimiento' },
            { label: 'Historial del incidente', route: '/tecnico/historial' },
          ],
        },
        {
          title: 'Inteligencia',
          shortLabel: 'IE',
          items: [
            { label: 'Analisis IA y CU26', route: '/tecnico/incidentes/11', note: 'En detalle' },
          ],
        },
        {
          title: 'Seguridad',
          shortLabel: 'AS',
          items: [
            { label: 'Cerrar sesion', action: 'logout' },
          ],
        },
      ];
    }

    return [
      {
        title: 'Gestion Operativa de Taller y Tecnico',
        shortLabel: 'OT',
        items: [
          { label: 'Inicio del taller', route: '/taller' },
          { label: 'Disponibilidad del taller', route: '/taller/disponibilidad' },
          { label: 'Servicios ofrecidos', route: '/taller/servicios', note: 'En la misma pantalla' },
          { label: 'Tipos de vehiculo', route: '/taller/servicios', note: 'En la misma pantalla' },
          { label: 'Tecnicos', route: '/taller/tecnicos' },
          {
            label: 'Disponibilidad del tecnico',
            route: '/taller/tecnicos',
            note: 'En la misma pantalla',
          },
          { label: 'Especialidades', route: '/taller/tecnicos', note: 'En la misma pantalla' },
          { label: 'Unidades moviles', route: '/taller/unidades' },
        ],
      },
      {
        title: 'Gestion de Incidentes y Atencion',
        shortLabel: 'IA',
        items: [
          { label: 'Incidentes disponibles', route: '/taller/solicitudes' },
          { label: 'Responder solicitud', route: '/taller/solicitudes', note: 'En detalle de solicitud' },
          { label: 'Asignar recursos', route: '/taller/solicitudes/recursos', note: 'Solicitudes aceptadas' },
          { label: 'Estado del servicio', route: '/taller/solicitudes/recursos', note: 'Solicitudes aceptadas' },
        ],
      },
      {
        title: 'Seguimiento y Monitoreo del Servicio',
        shortLabel: 'SM',
        items: [
          { label: 'Historial', route: '/taller/historial' },
          { label: 'Trazabilidad ubicacion/llegada', route: '/taller/historial', note: 'CU23/CU24' },
        ],
      },
      {
        title: 'Inteligencia y Gestion Estrategica',
        shortLabel: 'IE',
        items: [
          { label: 'Analisis IA del incidente', route: '/taller/solicitudes', note: 'CU26 en detalle' },
          { label: 'Seleccion marketplace', route: '/taller/solicitudes', note: 'CU27 visible' },
        ],
      },
      {
        title: 'Autenticacion y Seguridad',
        shortLabel: 'AS',
        items: [
          { label: 'Perfil del taller', route: '/taller', note: 'Resumen de acceso' },
          { label: 'Cerrar sesion', action: 'logout' },
        ],
      },
    ];
  });

  toggleSidebar(): void {
    this.sidebarCollapsed.update((value) => !value);
  }

  toggleGroup(groupTitle: string): void {
    this.activeGroup.update((current) =>
      current === groupTitle ? '' : groupTitle
    );
  }

  handleAction(action?: 'logout'): void {
    if (action === 'logout') {
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
}
