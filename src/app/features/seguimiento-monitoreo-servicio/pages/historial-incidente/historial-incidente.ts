import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, startWith } from 'rxjs';

import { TokenService } from '../../../../core/services/token.service';
import {
  HistorialIncidenteEvento,
  IncidenteHistorialDetail,
  IncidenteHistorialListItem,
} from '../../models/incident-history.model';
import { IncidentHistoryService } from '../../services/incident-history.service';

@Component({
  selector: 'app-historial-incidente',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './historial-incidente.html',
  styleUrl: './historial-incidente.scss',
})
export class HistorialIncidente implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);
  private readonly incidentHistoryService = inject(IncidentHistoryService);

  readonly loadingList = signal(true);
  readonly loadingDetail = signal(false);
  readonly errorMessage = signal('');
  readonly detailErrorMessage = signal('');
  readonly incidents = signal<IncidenteHistorialListItem[]>([]);
  readonly selectedIncidentId = signal<number | null>(null);
  readonly selectedIncident = signal<IncidenteHistorialDetail | null>(null);

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    estado: ['todos'],
    actor: ['todos'],
    evento: ['todos'],
  });

  private readonly filterValue = toSignal(
    this.filterForm.valueChanges.pipe(startWith(this.filterForm.getRawValue())),
    { initialValue: this.filterForm.getRawValue() }
  );

  readonly panelKicker = computed(() => {
    if (this.router.url.startsWith('/admin')) {
      return 'Seguimiento y monitoreo del servicio';
    }

    return this.router.url.startsWith('/tecnico')
      ? 'Panel tecnico'
      : 'Panel taller';
  });

  readonly filteredIncidents = computed(() => {
    const filters = this.filterValue();
    const search = (filters.search ?? '').trim().toLowerCase();
    const estado = (filters.estado ?? 'todos').trim().toUpperCase();

    return this.incidents().filter((incident) => {
      if (estado !== 'TODOS' && incident.estado_servicio_actual.toUpperCase() !== estado) {
        return false;
      }

      if (!search) {
        return true;
      }

      const haystack = [
        incident.id_incidente,
        incident.titulo,
        incident.tipo_incidente,
        incident.estado_servicio_actual,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });
  });

  readonly filteredHistoryEvents = computed(() => {
    const detail = this.selectedIncident();
    if (!detail) {
      return [];
    }

    const filters = this.filterValue();
    const actor = (filters.actor ?? 'todos').trim().toLowerCase();
    const evento = (filters.evento ?? 'todos').trim().toUpperCase();

    return detail.historial.filter((entry) => {
      if (evento !== 'TODOS' && entry.tipo_evento.toUpperCase() !== evento) {
        return false;
      }

      if (actor !== 'todos') {
        const haystack = [
          entry.actor,
          entry.nombre_taller,
          entry.nombre_tecnico,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(actor);
      }

      return true;
    });
  });

  readonly totalEventos = computed(() => this.filteredHistoryEvents().length);
  readonly totalCambiosEstado = computed(
    () =>
      this.filteredHistoryEvents().filter(
        (entry) => entry.tipo_evento.toUpperCase() === 'CAMBIO_ESTADO'
      ).length
  );
  readonly totalAsignaciones = computed(
    () =>
      this.filteredHistoryEvents().filter(
        (entry) =>
          entry.tipo_evento.toUpperCase().includes('ASIGNACION') ||
          !!entry.nombre_taller ||
          !!entry.nombre_tecnico ||
          !!entry.placa_unidad_movil
      ).length
  );
  readonly tiempoTranscurridoLabel = computed(() => {
    const detail = this.selectedIncident();
    const events = this.filteredHistoryEvents();

    if (!detail || events.length === 0) {
      return 'Sin datos';
    }

    const first = new Date(detail.fecha_reporte).getTime();
    const last = new Date(events[events.length - 1].fecha_hora).getTime();
    const minutes = Math.max(Math.round((last - first) / 60000), 0);

    return `${minutes} min`;
  });
  readonly availableActors = computed(() => {
    const detail = this.selectedIncident();
    if (!detail) {
      return [];
    }

    return Array.from(
      new Set(
        detail.historial
          .flatMap((entry) => [entry.actor, entry.nombre_taller, entry.nombre_tecnico])
          .filter((value): value is string => !!value && value.trim().length > 0)
      )
    );
  });
  readonly availableEventTypes = computed(() => {
    const detail = this.selectedIncident();
    if (!detail) {
      return [];
    }

    return Array.from(new Set(detail.historial.map((entry) => entry.tipo_evento)));
  });

  ngOnInit(): void {
    this.loadHistoryList();
  }

  loadHistoryList(): void {
    const currentSelectedId = this.selectedIncidentId();

    this.loadingList.set(true);
    this.errorMessage.set('');

    this.incidentHistoryService
      .getIncidentHistoryList()
      .pipe(finalize(() => this.loadingList.set(false)))
      .subscribe({
        next: (incidents) => {
          this.incidents.set(incidents);

          if (incidents.length === 0) {
            this.selectedIncidentId.set(null);
            this.selectedIncident.set(null);
            this.detailErrorMessage.set('');
            return;
          }

          const nextIncident =
            incidents.find((incident) => incident.id_incidente === currentSelectedId) ??
            incidents[0];

          this.selectIncident(nextIncident.id_incidente);
        },
        error: (error) => {
          this.handleListHttpError(
            error,
            'No se pudo cargar el historial de incidentes disponible para este usuario.'
          );
        },
      });
  }

  selectIncident(idIncidente: number): void {
    this.selectedIncidentId.set(idIncidente);
    this.loadingDetail.set(true);
    this.detailErrorMessage.set('');

    this.incidentHistoryService
      .getIncidentHistoryById(idIncidente)
      .pipe(finalize(() => this.loadingDetail.set(false)))
      .subscribe({
        next: (detail) => {
          this.selectedIncident.set(detail);
        },
        error: (error) => {
          this.selectedIncident.set(null);
          this.handleDetailHttpError(
            error,
            'No se pudo cargar el detalle del historial del incidente.'
          );
        },
      });
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) {
      return 'No disponible';
    }

    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  formatIncidentCode(idIncidente: number): string {
    return `INC-${String(idIncidente).padStart(6, '0')}`;
  }

  getStatusBadgeClass(value: string | null | undefined): string {
    switch ((value ?? '').toUpperCase()) {
      case 'FINALIZADO':
        return 'status-badge status-badge--done';
      case 'EN_CAMINO':
        return 'status-badge status-badge--route';
      case 'ASIGNADO':
        return 'status-badge status-badge--assigned';
      case 'CANCELADO':
        return 'status-badge status-badge--cancelled';
      case 'EN_ATENCION':
      case 'EN_PROCESO':
        return 'status-badge status-badge--progress';
      default:
        return 'status-badge status-badge--pending';
    }
  }

  getEventToneClass(entry: HistorialIncidenteEvento): string {
    const eventType = entry.tipo_evento.toUpperCase();

    if (eventType.includes('ASIGNACION')) {
      return 'timeline-dot timeline-dot--assigned';
    }

    if (eventType.includes('UBICACION')) {
      return 'timeline-dot timeline-dot--location';
    }

    if (eventType.includes('CAMBIO_ESTADO')) {
      return 'timeline-dot timeline-dot--status';
    }

    return 'timeline-dot';
  }

  getEventSummary(entry: HistorialIncidenteEvento): string {
    const parts = [
      entry.nombre_taller ? `Taller ${entry.nombre_taller}` : '',
      entry.nombre_tecnico ? `Tecnico ${entry.nombre_tecnico}` : '',
      entry.placa_unidad_movil ? `Unidad ${entry.placa_unidad_movil}` : '',
    ].filter(Boolean);

    return parts.join(' · ') || 'Sin actores operativos vinculados.';
  }

  clearEventFilters(): void {
    this.filterForm.patchValue({
      actor: 'todos',
      evento: 'todos',
    });
  }

  private handleListHttpError(error: unknown, fallbackMessage: string): void {
    const httpError = error as {
      status?: number;
      error?: { detail?: string };
    };

    if (httpError?.status === 401) {
      this.tokenService.clearSession();
      void this.router.navigate(['/login']);
      return;
    }

    if (httpError?.status === 403) {
      this.errorMessage.set(
        'No tienes permisos suficientes para consultar historial de incidentes.'
      );
      return;
    }

    this.errorMessage.set(httpError?.error?.detail ?? fallbackMessage);
  }

  private handleDetailHttpError(error: unknown, fallbackMessage: string): void {
    const httpError = error as {
      status?: number;
      error?: { detail?: string };
    };

    if (httpError?.status === 401) {
      this.tokenService.clearSession();
      void this.router.navigate(['/login']);
      return;
    }

    if (httpError?.status === 403) {
      this.detailErrorMessage.set(
        'No tienes permisos suficientes para consultar este historial.'
      );
      return;
    }

    if (httpError?.status === 404) {
      this.detailErrorMessage.set(
        'El incidente no existe o no esta disponible para este usuario.'
      );
      return;
    }

    this.detailErrorMessage.set(httpError?.error?.detail ?? fallbackMessage);
  }
}
