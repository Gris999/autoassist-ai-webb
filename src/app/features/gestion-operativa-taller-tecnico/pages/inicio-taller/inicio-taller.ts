import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';

import { IncidenteDisponible } from '../../../gestion-incidentes-atencion/models/incidente-atencion.model';
import { IncidentesService } from '../../../gestion-incidentes-atencion/services/incidentes.service';
import { TokenService } from '../../../../core/services/token.service';
import { DisponibilidadTecnicoResponse } from '../../models/technician-management.model';
import { WorkshopAvailability } from '../../models/workshop-availability.model';
import { WorkshopOperationalService } from '../../services/workshop-operational.service';

interface QuickAccess {
  title: string;
  description: string;
  helper: string;
  route?: string;
  status?: 'available' | 'upcoming';
}

@Component({
  selector: 'app-inicio-taller',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './inicio-taller.html',
  styleUrl: './inicio-taller.scss',
})
export class InicioTaller implements OnInit {
  private readonly incidentesService = inject(IncidentesService);
  private readonly workshopOperationalService = inject(WorkshopOperationalService);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly incidentes = signal<IncidenteDisponible[]>([]);
  readonly availabilityLoading = signal(true);
  readonly availabilitySaving = signal(false);
  readonly availabilityError = signal('');
  readonly workshopAvailability = signal<WorkshopAvailability | null>(null);
  readonly technicianAvailability = signal<DisponibilidadTecnicoResponse | null>(null);
  readonly metricsOpen = signal(true);
  readonly quickAccessOpen = signal(true);
  readonly activityOpen = signal(true);
  readonly isTechnicianHome = computed(() => this.router.url.startsWith('/tecnico'));
  readonly homeCopy = computed(() => {
    if (this.isTechnicianHome()) {
      return {
        kicker: 'Inicio tecnico',
        title: 'Panel del tecnico',
        subtitle: 'Disponibilidad y accesos reales del panel tecnico.',
        primaryLabel: 'Ver mis asignaciones',
        primaryRoute: '/tecnico/asignaciones',
        secondaryLabel: 'Mi disponibilidad',
      };
    }

    return {
      kicker: 'Inicio',
      title: 'Resumen del taller',
      subtitle: 'Solicitudes, disponibilidad y accesos rapidos.',
      primaryLabel: 'Ver incidentes disponibles',
      primaryRoute: '/taller/solicitudes',
      secondaryLabel: 'Ajustar disponibilidad',
    };
  });

  readonly metricCards = computed(() => {
    const incidentes = this.incidentes();

    if (this.isTechnicianHome()) {
      return [
        {
          label: 'Asignaciones pendientes',
          value: incidentes.length,
          helper: 'por revisar',
        },
        {
          label: 'Prioridad alta',
          value: incidentes.filter((item) => Number(item.id_prioridad) === 1).length,
          helper: 'requieren atencion',
        },
      ];
    }

    return [
      {
        label: 'Solicitudes pendientes',
        value: incidentes.length,
        helper: 'listas para responder',
      },
      {
        label: 'Prioridad alta',
        value: incidentes.filter((item) => Number(item.id_prioridad) === 1).length,
        helper: 'casos urgentes',
      },
      {
        label: 'Cobertura activa',
        value: this.workshopAvailability()?.disponible ? 1 : 0,
        helper: 'segun disponibilidad actual',
      },
    ];
  });

  readonly quickAccessCards = computed<QuickAccess[]>(() => {
    if (this.isTechnicianHome()) {
      return [
        {
          title: 'Mi disponibilidad',
          description: 'Consulta y actualiza tu disponibilidad real para nuevas asignaciones.',
          helper: 'Gestion Operativa',
          status: 'available',
        },
        {
          title: 'Mis asignaciones',
          description: 'Consulta la vista habilitada para revisar asignaciones del tecnico.',
          helper: 'Gestion de Incidentes',
          route: '/tecnico/asignaciones',
          status: 'available',
        },
        {
          title: 'Historial de incidentes',
          description: 'Revisa la trazabilidad disponible del servicio desde el panel tecnico.',
          helper: 'Seguimiento',
          route: '/tecnico/historial',
          status: 'available',
        },
      ];
    }

    return [
      {
        title: 'Disponibilidad del taller',
        description: 'Define el estado operativo, cobertura y horarios de atencion.',
        helper: 'Gestion Operativa',
        route: '/taller/disponibilidad',
        status: 'available',
      },
      {
        title: 'Tecnicos y especialidades',
        description: 'Administra el personal tecnico del taller y las especialidades asociadas a cada perfil.',
        helper: 'Gestion Operativa',
        route: '/taller/tecnicos',
        status: 'available',
      },
      {
        title: 'Servicios y cobertura',
        description: 'Configura servicios de auxilio y tipos de vehiculo atendidos.',
        helper: 'Gestion Operativa',
        route: '/taller/servicios',
        status: 'available',
      },
      {
        title: 'Solicitudes disponibles',
        description: 'Revisa solicitudes pendientes y entra al detalle solo con identificador valido.',
        helper: 'Gestion de Incidentes',
        route: '/taller/solicitudes',
        status: 'available',
      },
    ];
  });

  readonly recentActivity = computed(() => {
    const firstIncident = this.incidentes()[0];
    if (!firstIncident) {
      return this.isTechnicianHome()
        ? 'Aun no hay asignaciones visibles. Esta vista evita simular incidentes hasta contar con datos reales.'
        : 'Aun no hay actividad reciente. Cuando ingresen solicitudes nuevas apareceran aqui.';
    }

    return `${firstIncident.titulo || 'Incidente sin titulo'} - Estado ${firstIncident.estado_servicio_actual || 'N/D'} - Prioridad ${firstIncident.prioridad || 'N/D'}`;
  });

  readonly availabilityMessage = computed(() => {
    if (this.isTechnicianHome()) {
      const technicianAvailability = this.technicianAvailability();

      if (!technicianAvailability) {
        return 'Consultando disponibilidad actual del tecnico...';
      }

      if (!technicianAvailability.estado) {
        return 'Tu perfil tecnico esta deshabilitado temporalmente.';
      }

      return technicianAvailability.disponible
        ? 'Disponible para recibir nuevas asignaciones.'
        : 'No disponible temporalmente para nuevas asignaciones.';
    }

    const availability = this.workshopAvailability();

    if (!availability) {
      return 'Consultando disponibilidad actual...';
    }

    return availability.disponible
      ? 'Disponible para recibir solicitudes'
      : 'No disponible temporalmente';
  });

  toggleSection(section: 'metrics' | 'quick' | 'activity'): void {
    if (section === 'metrics') {
      this.metricsOpen.update((value) => !value);
      return;
    }

    if (section === 'quick') {
      this.quickAccessOpen.update((value) => !value);
      return;
    }

    this.activityOpen.update((value) => !value);
  }

  ngOnInit(): void {
    if (!this.isTechnicianHome()) {
      this.loadAvailability();
      this.incidentesService.getIncidentesDisponibles().subscribe({
        next: (response) => {
          this.incidentes.set(response ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.errorMessage.set(
            'No pudimos cargar el resumen operativo del taller.'
          );
          this.loading.set(false);
        },
      });
    } else {
      this.loadTechnicianAvailability();
      this.incidentes.set([]);
      this.loading.set(false);
    }
  }

  onAvailabilityChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const nextValue = target.checked;
    const isTechnicianHome = this.isTechnicianHome();
    const currentTechnicianAvailability = this.technicianAvailability();
    const currentWorkshopAvailability = this.workshopAvailability();
    const currentAvailability = isTechnicianHome
      ? currentTechnicianAvailability
      : currentWorkshopAvailability;

    if (!currentAvailability || this.availabilitySaving()) {
      target.checked = currentAvailability?.disponible ?? false;
      return;
    }

    if (isTechnicianHome && !currentTechnicianAvailability?.estado && nextValue) {
      target.checked = false;
      this.availabilityError.set(
        'Tu perfil tecnico esta deshabilitado y no puede marcarse como disponible.'
      );
      return;
    }

    this.availabilitySaving.set(true);
    this.availabilityError.set('');

    if (isTechnicianHome) {
      this.workshopOperationalService
        .updateTechnicianAvailability({ disponible: nextValue })
        .subscribe({
          next: (response: DisponibilidadTecnicoResponse) => {
            this.technicianAvailability.set(response);
            this.availabilitySaving.set(false);
          },
          error: (error: { status?: number; error?: { detail?: string } }) => {
            this.availabilitySaving.set(false);
            target.checked = currentTechnicianAvailability?.disponible ?? false;

            if (error?.status === 401) {
              this.tokenService.clearSession();
              this.router.navigate(['/login']);
              return;
            }

            if (error?.status === 403) {
              this.availabilityError.set(
                'No tienes permisos para cambiar tu disponibilidad tecnica.'
              );
              return;
            }

            this.availabilityError.set(
              error?.error?.detail ??
                'No se pudo guardar tu disponibilidad tecnica. Intenta nuevamente.'
            );
          },
        });
      return;
    }

    this.workshopOperationalService
      .updateAvailability({ disponible: nextValue })
      .subscribe({
        next: (response: WorkshopAvailability) => {
          this.workshopAvailability.set(response);
          this.availabilitySaving.set(false);
        },
        error: (error: { status?: number; error?: { detail?: string } }) => {
          this.availabilitySaving.set(false);
          target.checked = currentWorkshopAvailability?.disponible ?? false;

          if (error?.status === 401) {
            this.tokenService.clearSession();
            this.router.navigate(['/login']);
            return;
          }

          if (error?.status === 403) {
            this.availabilityError.set(
              'No tienes permisos para cambiar la disponibilidad del taller.'
            );
            return;
          }

          this.availabilityError.set(
            error?.error?.detail ??
              'No se pudo guardar la disponibilidad. Intenta nuevamente.'
          );
        },
      });
  }

  scrollToAvailability(): void {
    const availabilityCard = document.getElementById('availability-card');
    availabilityCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private loadAvailability(): void {
    this.availabilityLoading.set(true);
    this.availabilityError.set('');

    this.workshopOperationalService.getAvailability().subscribe({
      next: (response) => {
        this.workshopAvailability.set(response);
        this.availabilityLoading.set(false);
      },
      error: (error) => {
        this.availabilityLoading.set(false);

        if (error?.status === 401) {
          this.tokenService.clearSession();
          this.router.navigate(['/login']);
          return;
        }

        if (error?.status === 403) {
          this.availabilityError.set(
            'No tienes permisos para consultar la disponibilidad del taller.'
          );
          return;
        }

        this.availabilityError.set(
          'No pudimos cargar la disponibilidad actual del taller.'
        );
      },
    });
  }

  private loadTechnicianAvailability(): void {
    this.availabilityLoading.set(true);
    this.availabilityError.set('');

    this.workshopOperationalService.getTechnicianAvailability().subscribe({
      next: (response) => {
        this.technicianAvailability.set(response);
        this.availabilityLoading.set(false);
      },
      error: (error) => {
        this.availabilityLoading.set(false);

        if (error?.status === 401) {
          this.tokenService.clearSession();
          this.router.navigate(['/login']);
          return;
        }

        if (error?.status === 403) {
          this.availabilityError.set(
            'No tienes permisos para consultar tu disponibilidad tecnica.'
          );
          return;
        }

        this.availabilityError.set(
          error?.error?.detail ??
            'No pudimos cargar la disponibilidad actual del tecnico.'
        );
      },
    });
  }
}
