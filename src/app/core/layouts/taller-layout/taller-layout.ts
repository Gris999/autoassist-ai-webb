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
  readonly activeGroup = signal('Gestion Operativa');
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
          items: [{ label: 'Inicio', route: '/tecnico' }],
        },
        {
          title: 'Gestion de Incidentes',
          shortLabel: 'IA',
          items: [
            { label: 'Mis asignaciones', route: '/tecnico/asignaciones' },
          ],
        },
        {
          title: 'Seguimiento',
          shortLabel: 'SM',
          items: [
            { label: 'Seguimiento actual', route: '/tecnico/seguimiento' },
            { label: 'Historial de incidentes', route: '/tecnico/historial' },
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
        title: 'Gestion Operativa',
        shortLabel: 'OT',
        items: [
          { label: 'Inicio del taller', route: '/taller' },
          { label: 'Disponibilidad del taller', route: '/taller/disponibilidad' },
          { label: 'Servicios y cobertura', route: '/taller/servicios' },
          { label: 'Tecnicos', route: '/taller/tecnicos' },
          { label: 'Unidades moviles', route: '/taller/unidades' },
        ],
      },
      {
        title: 'Gestion de Incidentes y Atencion',
        shortLabel: 'IA',
        items: [
          { label: 'Solicitudes disponibles', route: '/taller/solicitudes' },
          { label: 'Historial de incidentes', route: '/taller/historial' },
        ],
      },
      {
        title: 'Autenticacion y Seguridad',
        shortLabel: 'AS',
        items: [{ label: 'Cerrar sesion', action: 'logout' }],
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
