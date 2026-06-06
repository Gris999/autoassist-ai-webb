import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

import { IncidenteDisponible } from '../../models/incidente-atencion.model';
import { IncidentesService } from '../../services/incidentes.service';

@Component({
  selector: 'app-solicitudes-disponibles',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './solicitudes-disponibles.html',
  styleUrl: './solicitudes-disponibles.scss',
})
export class SolicitudesDisponibles implements OnInit {
  private readonly incidentesService = inject(IncidentesService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  loading = true;
  errorMessage = '';
  successMessage = '';
  incidentes: IncidenteDisponible[] = [];

  readonly prioridadLabels: Record<string, string> = {
    '1': 'Alta',
    '2': 'Media',
    '3': 'Baja',
  };

  get isTechnicianView(): boolean {
    return this.router.url.startsWith('/tecnico');
  }

  get isTechnicianAssignmentsView(): boolean {
    return this.router.url.startsWith('/tecnico/asignaciones');
  }

  get isTechnicianTrackingView(): boolean {
    return this.router.url.startsWith('/tecnico/seguimiento');
  }

  get pageTitle(): string {
    if (this.isTechnicianAssignmentsView) {
      return 'Mis asignaciones';
    }

    return this.isTechnicianView ? 'Seguimiento actual' : 'Solicitudes disponibles';
  }

  get pageSubtitle(): string {
    if (this.isTechnicianAssignmentsView) {
      return 'Pendiente de integracion con una fuente real de asignaciones';
    }

    return this.isTechnicianView
      ? 'Pendiente de integracion con una fuente real de seguimiento tecnico'
      : `${this.incidentes.length} disponibles`;
  }

  getPriorityLabel(priority: unknown): string {
    const key = `${priority ?? ''}`;
    return this.prioridadLabels[key] || key || 'N/D';
  }

  ngOnInit(): void {
    if (this.isTechnicianAssignmentsView) {
      this.loading = false;
      return;
    }

    if (this.isTechnicianTrackingView) {
      this.loading = false;
      return;
    }

    this.cargarIncidentes();
  }

  get canShowTechnicianPlaceholder(): boolean {
    return this.isTechnicianAssignmentsView || this.isTechnicianTrackingView;
  }

  cargarIncidentes(): void {
    if (this.isTechnicianView) {
      this.loading = false;
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.incidentesService.getIncidentesDisponibles().subscribe({
      next: (response) => {
        this.incidentes = response ?? [];
        const missingRequestIds = this.incidentes.filter(
          (incidente) => !incidente.id_solicitud_taller,
        ).length;

        if (missingRequestIds > 0) {
          this.successMessage = '';
          this.errorMessage =
            missingRequestIds === 1
              ? 'Hay 1 incidente sin id_solicitud_taller. Ese registro no podra abrir el detalle del taller.'
              : `Hay ${missingRequestIds} incidentes sin id_solicitud_taller. Esos registros no podran abrir el detalle del taller.`;
        } else {
          this.errorMessage = '';
        }

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        const httpError = error as {
          status?: number;
          error?: { detail?: string };
        };

        if (httpError?.status === 401) {
          this.errorMessage = 'Tu sesion ya no es valida. Vuelve a iniciar sesion para consultar incidentes disponibles.';
        } else if (httpError?.status === 403) {
          this.errorMessage = 'No tienes permisos suficientes para consultar incidentes disponibles del taller.';
        } else if (httpError?.status === 405) {
          this.errorMessage = 'El backend rechazo el metodo HTTP de esta consulta. La pantalla ya debe usar GET; recarga la aplicacion e intenta nuevamente.';
        } else {
          this.errorMessage =
            httpError?.error?.detail || 'No se pudieron cargar los incidentes disponibles.';
        }

        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  canOpenDetalle(incidente: IncidenteDisponible): boolean {
    return !this.isTechnicianView && !!incidente.id_solicitud_taller;
  }

  abrirDetalle(incidente: IncidenteDisponible): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.isTechnicianView) {
      return;
    }

    if (!incidente.id_solicitud_taller) {
      this.errorMessage = 'No se encontro el identificador de solicitud para abrir el detalle.';
      this.cdr.detectChanges();
      return;
    }

    void this.router.navigate(['/taller/solicitudes', incidente.id_solicitud_taller], {
      state: { incidentePreview: incidente },
    });
  }
}
