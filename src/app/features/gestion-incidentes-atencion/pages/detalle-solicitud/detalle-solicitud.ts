import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import {
  ActualizarEstadoIncidenteResponse,
  AsignacionServicioResponse,
  EstadoIncidenteTallerResponse,
  IncidenteDisponible,
  SolicitudAtencionDetalle,
  TecnicoDisponible,
  UnidadMovilDisponible,
} from '../../models/incidente-atencion.model';
import { IncidentesService } from '../../services/incidentes.service';

interface EstadoServicioTallerOption {
  id_estado_servicio: number;
  nombre: string;
  descripcion: string;
  orden_flujo: number;
}

// Temporal hasta contar con endpoint de catalogo de estados de servicio.
const ESTADOS_SERVICIO_TALLER: EstadoServicioTallerOption[] = [
  {
    id_estado_servicio: 2,
    nombre: 'ASIGNADO',
    descripcion: 'Servicio asignado',
    orden_flujo: 2,
  },
  {
    id_estado_servicio: 3,
    nombre: 'EN_CAMINO',
    descripcion: 'Tecnico en camino',
    orden_flujo: 3,
  },
  {
    id_estado_servicio: 4,
    nombre: 'EN_PROCESO',
    descripcion: 'Atencion en proceso',
    orden_flujo: 4,
  },
  {
    id_estado_servicio: 5,
    nombre: 'FINALIZADO',
    descripcion: 'Servicio finalizado',
    orden_flujo: 5,
  },
];

@Component({
  selector: 'app-detalle-solicitud',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './detalle-solicitud.html',
  styleUrl: './detalle-solicitud.scss',
})
export class DetalleSolicitud implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly incidentesService = inject(IncidentesService);

  readonly loading = signal(true);
  readonly requestId = signal<number | null>(null);
  readonly detail = signal<SolicitudAtencionDetalle | null>(null);
  readonly previewIncident = signal<IncidenteDisponible | null>(null);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly responseLoading = signal(false);
  readonly responseError = signal('');
  readonly responseSuccess = signal('');
  readonly confirmRejectOpen = signal(false);
  readonly assignmentOptionsLoading = signal(false);
  readonly assignmentLoading = signal(false);
  readonly assignmentError = signal('');
  readonly assignmentSuccess = signal('');
  readonly assignmentSummary = signal<AsignacionServicioResponse | null>(null);
  readonly assignmentLocked = signal(false);
  readonly statusLoading = signal(false);
  readonly statusSaving = signal(false);
  readonly statusError = signal('');
  readonly statusSuccess = signal('');
  readonly currentServiceState = signal<EstadoIncidenteTallerResponse | null>(null);
  readonly tecnicos = signal<TecnicoDisponible[]>([]);
  readonly unidadesMoviles = signal<UnidadMovilDisponible[]>([]);
  readonly detailSourceMismatch = signal(false);

  readonly assignmentForm = this.fb.group({
    id_tecnico: [null as number | null, Validators.required],
    id_unidad_movil: [null as number | null, Validators.required],
    tiempo_estimado_min: [null as number | null, Validators.min(0)],
    observaciones: [''],
  });

  readonly statusForm = this.fb.group({
    id_estado_servicio: [null as number | null, Validators.required],
    detalle: [''],
  });

  readonly displayData = computed(
    () => this.detail() ?? this.toPreviewDetail(this.previewIncident())
  );
  readonly isTechnicianView = computed(() => this.router.url.startsWith('/tecnico'));
  readonly canRespondRequest = computed(() => {
    const detail = this.detail();
    return (
      !this.isTechnicianView() &&
      !!detail &&
      detail.id_solicitud_taller > 0 &&
      detail.estado_solicitud === 'PENDIENTE'
    );
  });
  readonly isAccepted = computed(() => this.detail()?.estado_solicitud === 'ACEPTADA');
  readonly isRejected = computed(() => this.detail()?.estado_solicitud === 'RECHAZADA');
  readonly showAssignmentSection = computed(
    () => !this.isTechnicianView() && this.isAccepted()
  );
  readonly canAssignResources = computed(
    () =>
      this.showAssignmentSection() &&
      !this.assignmentSummary() &&
      !this.assignmentLocked()
  );
  readonly canUpdateStatus = computed(() => !!this.currentServiceState());
  readonly availableNextStates = computed(() => {
    const current = this.currentServiceState();
    if (!current) {
      return [];
    }

    return ESTADOS_SERVICIO_TALLER.filter(
      (state) => state.orden_flujo === current.orden_flujo_actual + 1
    );
  });
  readonly assignedTechnicianName = computed(() => {
    const summary = this.assignmentSummary();
    if (!summary) {
      return 'No disponible';
    }

    const tecnico = this.tecnicos().find(
      (item) => item.id_tecnico === summary.id_tecnico
    );
    return tecnico
      ? `${tecnico.nombres} ${tecnico.apellidos}`.trim()
      : `Tecnico #${summary.id_tecnico}`;
  });
  readonly assignedVehicleLabel = computed(() => {
    const summary = this.assignmentSummary();
    if (!summary?.id_unidad_movil) {
      return 'No disponible';
    }

    const unidad = this.unidadesMoviles().find(
      (item) => item.id_unidad_movil === summary.id_unidad_movil
    );
    return unidad
      ? `${unidad.placa} - ${unidad.tipo_unidad}`
      : `Unidad #${summary.id_unidad_movil}`;
  });

  ngOnInit(): void {
    const previewState = history.state?.incidentePreview as IncidenteDisponible | undefined;
    if (previewState?.id_incidente) {
      this.previewIncident.set(previewState);
    }

    this.route.paramMap.subscribe((params) => {
      const rawId = params.get('id');
      const parsedId = Number(rawId);

      if (!rawId || Number.isNaN(parsedId) || parsedId <= 0) {
        this.loading.set(false);
        this.errorMessage.set('La solicitud indicada no es valida.');
        return;
      }

      this.requestId.set(parsedId);
      if (this.isTechnicianView()) {
        this.loadTechnicianIncident(parsedId);
        return;
      }

      this.loadDetail(parsedId);
    });
  }

  loadDetail(idSolicitudTaller: number): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.detailSourceMismatch.set(false);

    this.incidentesService
      .getDetalleSolicitudAtencion(idSolicitudTaller)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (detail) => {
          this.detail.set(detail);
          this.previewIncident.set(null);
          this.resetOperationalMessages();
          this.assignmentSummary.set(null);
          this.assignmentLocked.set(false);
          this.assignmentForm.reset({
            id_tecnico: null,
            id_unidad_movil: null,
            tiempo_estimado_min: null,
            observaciones: '',
          });
          this.statusForm.reset({
            id_estado_servicio: null,
            detalle: '',
          });

          if (detail.estado_solicitud === 'ACEPTADA') {
            this.loadAssignmentOptions(detail.id_incidente);
            this.loadCurrentState(detail.id_incidente);
          } else {
            this.tecnicos.set([]);
            this.unidadesMoviles.set([]);
            this.currentServiceState.set(null);
          }
        },
        error: (error) => {
          const preview = this.previewIncident();
          this.loading.set(false);

          if (preview && preview.id_incidente === idSolicitudTaller) {
            this.detailSourceMismatch.set(true);
            this.errorMessage.set(
              'No se pudo cargar el detalle de solicitud. El listado actual entrega id_incidente, pero este endpoint requiere id_solicitud_taller.'
            );
            return;
          }

          this.errorMessage.set(
            error?.error?.detail ||
              'No se pudo cargar el detalle de la solicitud de atencion.'
          );
        },
      });
  }

  acceptRequest(): void {
    this.respondToRequest('aceptar');
  }

  requestRejectConfirmation(): void {
    this.confirmRejectOpen.set(true);
    this.responseError.set('');
    this.responseSuccess.set('');
  }

  cancelRejectConfirmation(): void {
    this.confirmRejectOpen.set(false);
  }

  confirmReject(): void {
    this.respondToRequest('rechazar');
  }

  assignResources(): void {
    const detail = this.detail();

    if (!detail) {
      this.assignmentError.set('Primero debes cargar una solicitud valida.');
      return;
    }

    if (detail.estado_solicitud !== 'ACEPTADA') {
      this.assignmentError.set(
        'La solicitud debe estar aceptada antes de asignar tecnico y unidad movil.'
      );
      return;
    }

    if (this.assignmentForm.invalid) {
      this.assignmentForm.markAllAsTouched();
      this.assignmentError.set(
        'Selecciona tecnico y unidad movil antes de registrar la asignacion.'
      );
      return;
    }

    const rawValue = this.assignmentForm.getRawValue();
    if (
      rawValue.tiempo_estimado_min !== null &&
      rawValue.tiempo_estimado_min !== undefined &&
      rawValue.tiempo_estimado_min <= 0
    ) {
      this.assignmentError.set('El tiempo estimado debe ser mayor a 0.');
      return;
    }

    this.assignmentLoading.set(true);
    this.assignmentError.set('');
    this.assignmentSuccess.set('');

    this.incidentesService
      .asignarRecursosIncidente(detail.id_incidente, {
        id_tecnico: rawValue.id_tecnico!,
        id_unidad_movil: rawValue.id_unidad_movil!,
        tiempo_estimado_min: rawValue.tiempo_estimado_min,
        observaciones: rawValue.observaciones?.trim() || null,
      })
      .pipe(finalize(() => this.assignmentLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.assignmentSummary.set(response);
          this.assignmentLocked.set(true);
          this.assignmentSuccess.set(
            'Recursos asignados correctamente. Ya puedes actualizar el estado del servicio.'
          );
          this.loadCurrentState(detail.id_incidente);
        },
        error: (error) => {
          this.assignmentError.set(
            error?.error?.detail || 'No se pudo registrar la asignacion de recursos.'
          );
        },
      });
  }

  updateServiceStatus(): void {
    const detail = this.detail();
    const currentState = this.currentServiceState();

    if (!detail || !currentState) {
      this.statusError.set(
        'Debes contar con una asignacion activa antes de actualizar el estado.'
      );
      return;
    }

    if (this.statusForm.invalid) {
      this.statusForm.markAllAsTouched();
      this.statusError.set('Selecciona un nuevo estado para continuar.');
      return;
    }

    const rawValue = this.statusForm.getRawValue();
    if (rawValue.id_estado_servicio === currentState.id_estado_servicio_actual) {
      this.statusError.set('El nuevo estado no puede ser igual al estado actual.');
      return;
    }

    this.statusSaving.set(true);
    this.statusError.set('');
    this.statusSuccess.set('');

    this.incidentesService
      .actualizarEstadoIncidenteTaller(detail.id_incidente, {
        id_estado_servicio: rawValue.id_estado_servicio!,
        detalle: rawValue.detalle?.trim() || null,
      })
      .pipe(finalize(() => this.statusSaving.set(false)))
      .subscribe({
        next: (response) => {
          this.applyStatusUpdate(response);
          this.statusSuccess.set('Estado del servicio actualizado correctamente.');
          this.statusForm.reset({
            id_estado_servicio: null,
            detalle: '',
          });
        },
        error: (error) => {
          this.statusError.set(
            error?.error?.detail || 'No se pudo actualizar el estado del servicio.'
          );
        },
      });
  }

  getPriorityBadgeClass(priority: string | undefined): string {
    switch ((priority ?? '').toUpperCase()) {
      case 'ALTA':
        return 'badge badge--priority-high';
      case 'MEDIA':
        return 'badge badge--priority-medium';
      case 'BAJA':
        return 'badge badge--priority-low';
      default:
        return 'badge';
    }
  }

  getStatusBadgeClass(value: string | undefined): string {
    switch ((value ?? '').toUpperCase()) {
      case 'PENDIENTE':
        return 'badge badge--pending';
      case 'ACEPTADA':
        return 'badge badge--accepted';
      case 'RECHAZADA':
        return 'badge badge--rejected';
      case 'REPORTADO':
        return 'badge badge--reported';
      case 'ASIGNADO':
        return 'badge badge--assigned';
      case 'EN_CAMINO':
        return 'badge badge--on-route';
      case 'EN_PROCESO':
        return 'badge badge--in-progress';
      case 'FINALIZADO':
        return 'badge badge--done';
      default:
        return 'badge';
    }
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

  goBack(): void {
    void this.router.navigate([this.isTechnicianView() ? '/tecnico/asignaciones' : '/taller/solicitudes']);
  }

  private respondToRequest(action: 'aceptar' | 'rechazar'): void {
    const requestId = this.requestId();
    const currentDetail = this.detail();

    if (!requestId || !currentDetail?.id_solicitud_taller) {
      this.responseError.set('No se identifico la solicitud a responder.');
      return;
    }

    if (currentDetail.estado_solicitud !== 'PENDIENTE') {
      this.responseError.set(
        'La solicitud ya no se encuentra pendiente y no puede responderse nuevamente.'
      );
      return;
    }

    this.responseLoading.set(true);
    this.responseError.set('');
    this.responseSuccess.set('');

    this.incidentesService
      .responderSolicitudAtencion(requestId, action)
      .pipe(finalize(() => this.responseLoading.set(false)))
      .subscribe({
        next: (response) => {
          if (currentDetail) {
            this.detail.set({
              ...currentDetail,
              estado_solicitud: response.estado_solicitud,
              fecha_respuesta: response.fecha_respuesta,
              id_estado_servicio_actual: response.id_estado_servicio_actual,
              estado_servicio_actual: response.estado_servicio_actual,
            });
          }

          this.confirmRejectOpen.set(false);

          if (response.accion === 'aceptar') {
            this.responseSuccess.set(
              'Solicitud aceptada correctamente. Ahora puedes asignar tecnico y unidad movil.'
            );
            this.assignmentLocked.set(false);
            this.assignmentSummary.set(null);
            this.loadAssignmentOptions(response.id_incidente);
            this.loadCurrentState(response.id_incidente);
          } else {
            this.responseSuccess.set('Solicitud rechazada correctamente.');
            this.assignmentLocked.set(true);
            this.tecnicos.set([]);
            this.unidadesMoviles.set([]);
            this.currentServiceState.set(null);
            this.assignmentSummary.set(null);
          }
        },
        error: (error) => {
          this.responseError.set(
            error?.error?.detail || 'No se pudo registrar la respuesta de la solicitud.'
          );
        },
      });
  }

  private loadAssignmentOptions(idIncidente: number): void {
    this.assignmentOptionsLoading.set(true);
    this.assignmentError.set('');

    forkJoin({
      tecnicos: this.incidentesService.getTecnicosDisponibles(idIncidente),
      unidades: this.incidentesService.getUnidadesMovilesDisponibles(idIncidente),
    })
      .pipe(finalize(() => this.assignmentOptionsLoading.set(false)))
      .subscribe({
        next: ({ tecnicos, unidades }) => {
          this.assignmentLocked.set(false);
          this.tecnicos.set(tecnicos);
          this.unidadesMoviles.set(unidades);
          this.assignmentForm.patchValue({
            id_tecnico: tecnicos[0]?.id_tecnico ?? null,
            id_unidad_movil: unidades[0]?.id_unidad_movil ?? null,
          });
        },
        error: (error) => {
          this.assignmentError.set(
            error?.error?.detail || 'No se pudieron cargar los recursos disponibles.'
          );
        },
      });
  }

  private loadCurrentState(idIncidente: number): void {
    this.statusLoading.set(true);
    this.statusError.set('');

    this.incidentesService
      .getEstadoIncidenteTaller(idIncidente)
      .pipe(finalize(() => this.statusLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.currentServiceState.set(response);
        },
        error: (error) => {
          const detail = error?.error?.detail as string | undefined;
          if (detail?.includes('no tiene una asignacion de servicio registrada')) {
            this.currentServiceState.set(null);
            return;
          }

          this.statusError.set(
            detail || 'No se pudo consultar el estado actual del servicio.'
          );
        },
      });
  }

  private applyStatusUpdate(response: ActualizarEstadoIncidenteResponse): void {
    const currentState = ESTADOS_SERVICIO_TALLER.find(
      (item) => item.id_estado_servicio === response.id_estado_nuevo
    );

    this.currentServiceState.set({
      id_incidente: response.id_incidente,
      id_taller: response.id_taller,
      id_estado_servicio_actual: response.id_estado_nuevo,
      estado_servicio_actual: response.estado_nuevo,
      orden_flujo_actual:
        currentState?.orden_flujo ??
        this.currentServiceState()?.orden_flujo_actual ??
        0,
      estado_asignacion: response.estado_nuevo,
    });

    const currentDetail = this.detail();
    if (currentDetail) {
      this.detail.set({
        ...currentDetail,
        id_estado_servicio_actual: response.id_estado_nuevo,
        estado_servicio_actual: response.estado_nuevo,
      });
    }
  }

  private resetOperationalMessages(): void {
    this.responseError.set('');
    this.responseSuccess.set('');
    this.assignmentError.set('');
    this.assignmentSuccess.set('');
    this.statusError.set('');
    this.statusSuccess.set('');
  }

  private loadTechnicianIncident(idIncidente: number): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.responseError.set('');
    this.assignmentError.set('');
    this.statusError.set('');
    this.confirmRejectOpen.set(false);
    this.assignmentLocked.set(true);
    this.assignmentSummary.set(null);
    this.currentServiceState.set(null);
    this.tecnicos.set([]);
    this.unidadesMoviles.set([]);

    const preview = this.previewIncident();
    if (preview && preview.id_incidente === idIncidente) {
      this.detail.set(this.toPreviewDetail(preview));
      this.loading.set(false);
      return;
    }

    this.detail.set({
      id_solicitud_taller: 0,
      id_incidente: idIncidente,
      id_taller: 0,
      distancia_km: null,
      puntaje_asignacion: null,
      estado_solicitud: 'ASIGNADA',
      fecha_envio: new Date().toISOString(),
      fecha_respuesta: null,
      titulo_incidente: `Incidente asignado #${idIncidente}`,
      descripcion_texto:
        'Vista del tecnico para revisar datos operativos del incidente asignado.',
      direccion_referencia: 'No disponible en esta vista',
      latitud: null,
      longitud: null,
      fecha_reporte: new Date().toISOString(),
      id_tipo_incidente: 0,
      tipo_incidente: 'ASIGNADO',
      id_prioridad: 1,
      prioridad: 'ALTA',
      id_estado_servicio_actual: 2,
      estado_servicio_actual: 'ASIGNADO',
    });
    this.loading.set(false);
  }

  private toPreviewDetail(
    preview: IncidenteDisponible | null
  ): SolicitudAtencionDetalle | null {
    if (!preview) {
      return null;
    }

    return {
      id_solicitud_taller: preview.id_solicitud_taller ?? 0,
      id_incidente: preview.id_incidente,
      id_taller: 0,
      distancia_km: null,
      puntaje_asignacion: null,
      estado_solicitud: 'PENDIENTE',
      fecha_envio: preview.fecha_reporte,
      fecha_respuesta: null,
      titulo_incidente: preview.titulo,
      descripcion_texto: preview.descripcion_texto ?? null,
      direccion_referencia: preview.direccion_referencia ?? null,
      latitud: preview.latitud ?? null,
      longitud: preview.longitud ?? null,
      fecha_reporte: preview.fecha_reporte,
      id_tipo_incidente: preview.id_tipo_incidente,
      tipo_incidente: preview.tipo_incidente,
      id_prioridad: preview.id_prioridad,
      prioridad: preview.prioridad,
      id_estado_servicio_actual: preview.id_estado_servicio_actual,
      estado_servicio_actual: preview.estado_servicio_actual,
    };
  }
}
