import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { IncidenteDisponible } from '../../models/incidente-atencion.model';
import { IncidentesService } from '../../services/incidentes.service';
import {
  SeguimientoIncidenteResponse,
  SeguimientoTecnicoService,
} from '../../../seguimiento-monitoreo-servicio/services/seguimiento-tecnico.service';

const TECNICO_INCIDENTE_ASIGNADO_ID = 11;

@Component({
  selector: 'app-solicitudes-disponibles',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './solicitudes-disponibles.html',
  styleUrl: './solicitudes-disponibles.scss',
})
export class SolicitudesDisponibles implements OnInit, OnDestroy {
  private readonly incidentesService = inject(IncidentesService);
  private readonly seguimientoTecnicoService = inject(SeguimientoTecnicoService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private seguimientoSocket: WebSocket | null = null;

  loading = true;
  errorMessage = '';
  successMessage = '';
  wsMessage = 'Conectando con seguimiento en tiempo real...';
  locationSaving = false;
  currentLatitude = -17.7355;
  currentLongitude = -63.1332;
  readonly incidentLatitude = -17.7312345;
  readonly incidentLongitude = -63.1298765;
  readonly technicianLocationLabel = 'Tu ubicacion actual';
  readonly incidentLocationLabel = 'Punto del incidente asignado';
  readonly technicianIncidentId = TECNICO_INCIDENTE_ASIGNADO_ID;
  tracking: SeguimientoIncidenteResponse | null = null;
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

  get isResourcesView(): boolean {
    return this.router.url.startsWith('/taller/solicitudes/recursos');
  }

  get pageTitle(): string {
    if (this.isTechnicianAssignmentsView) {
      return 'Mis asignaciones';
    }

    if (this.isResourcesView) {
      return 'Solicitudes aceptadas';
    }

    return this.isTechnicianView ? 'Seguimiento actual' : 'Incidentes disponibles';
  }

  get pageSubtitle(): string {
    if (this.isTechnicianAssignmentsView) {
      return 'Incidentes asignados a tu atencion';
    }

    if (this.isResourcesView) {
      return 'Pendientes para asignar recursos y actualizar estado del servicio';
    }

    return this.isTechnicianView
      ? 'Seguimiento del incidente asignado al tecnico'
      : `${this.incidentes.length} disponibles`;
  }

  get detailBaseRoute(): string {
    return this.isTechnicianView ? '/tecnico/incidentes' : '/taller/solicitudes';
  }

  get estadoServicioActual(): string {
    return this.tracking?.estado_servicio_actual || 'EN_CAMINO';
  }

  get estadoAsignacionActual(): string {
    return this.tracking?.estado_asignacion || 'EN_CAMINO';
  }

  get markerLatitude(): number {
    return this.toNumber(this.tracking?.latitud_actual, this.currentLatitude);
  }

  get markerLongitude(): number {
    return this.toNumber(this.tracking?.longitud_actual, this.currentLongitude);
  }

  get markerLeftPercent(): number {
    return this.projectLongitude(this.markerLongitude);
  }

  get markerTopPercent(): number {
    return this.projectLatitude(this.markerLatitude);
  }

  get incidentLeftPercent(): number {
    return this.projectLongitude(this.incidentLongitude);
  }

  get incidentTopPercent(): number {
    return this.projectLatitude(this.incidentLatitude);
  }

  get routeDistanceKm(): string {
    const distance = this.calculateDistanceKm(
      this.markerLatitude,
      this.markerLongitude,
      this.incidentLatitude,
      this.incidentLongitude,
    );

    return distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`;
  }

  get mapsUrl(): string {
    const origin = `${this.markerLatitude},${this.markerLongitude}`;
    const destination = `${this.incidentLatitude},${this.incidentLongitude}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  }

  get embeddedMapUrl(): SafeResourceUrl {
    const origin = `${this.markerLatitude},${this.markerLongitude}`;
    const destination = `${this.incidentLatitude},${this.incidentLongitude}`;
    const url = `https://www.google.com/maps?output=embed&saddr=${origin}&daddr=${destination}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  getPriorityLabel(priority: unknown): string {
    const key = `${priority ?? ''}`;
    return this.prioridadLabels[key] || key || 'N/D';
  }

  getRequestStatusBadgeClass(status: string | null | undefined): string {
    switch ((status ?? '').toUpperCase()) {
      case 'PENDIENTE':
        return 'request-badge request-badge--pending';
      case 'ACEPTADA':
        return 'request-badge request-badge--accepted';
      case 'RECHAZADA':
      case 'CANCELADA':
        return 'request-badge request-badge--rejected';
      default:
        return 'request-badge';
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

  ngOnInit(): void {
    if (this.isTechnicianAssignmentsView) {
      this.cargarAsignacionesTecnico();
      return;
    }

    if (this.isTechnicianTrackingView) {
      this.cargarSeguimientoTecnico();
      return;
    }

    if (this.isResourcesView) {
      this.cargarSolicitudesAceptadasParaRecursos();
      return;
    }

    this.cargarIncidentes();
  }

  ngOnDestroy(): void {
    this.seguimientoSocket?.close();
  }

  cargarIncidentes(): void {
    if (this.isTechnicianView) {
      this.cargarAsignacionesTecnico();
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

  cargarSolicitudesAceptadasParaRecursos(): void {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const solicitudes = this.incidentesService.obtenerSolicitudesAceptadasLocal();
    const acceptedFromBackend$ = this.incidentesService.getIncidentesDisponibles().pipe(
      map((items) =>
        (items ?? []).filter(
          (incidente) => (incidente.estado_solicitud ?? '').toUpperCase() === 'ACEPTADA'
        )
      ),
      catchError(() => of([] as IncidenteDisponible[]))
    );

    const requests = solicitudes.map((item) =>
      this.incidentesService.getDetalleSolicitudAtencion(item.id_solicitud_taller).pipe(
        map((detail) => {
          if (detail.estado_solicitud !== 'ACEPTADA') {
            this.incidentesService.quitarSolicitudAceptadaLocal(detail.id_solicitud_taller);
            return null;
          }

          return {
            id_solicitud_taller: detail.id_solicitud_taller,
            id_incidente: detail.id_incidente,
            id_taller: detail.id_taller,
            distancia_km: detail.distancia_km,
            puntaje_asignacion: detail.puntaje_asignacion,
            estado_solicitud: detail.estado_solicitud,
            fecha_envio: detail.fecha_envio,
            fecha_respuesta: detail.fecha_respuesta,
            titulo: detail.titulo_incidente,
            descripcion_texto: detail.descripcion_texto,
            direccion_referencia: detail.direccion_referencia,
            latitud: detail.latitud,
            longitud: detail.longitud,
            fecha_reporte: detail.fecha_reporte,
            id_vehiculo: 0,
            id_tipo_incidente: detail.id_tipo_incidente,
            tipo_incidente: detail.tipo_incidente,
            id_prioridad: detail.id_prioridad,
            prioridad: detail.prioridad,
            id_estado_servicio_actual: detail.id_estado_servicio_actual,
            estado_servicio_actual: detail.estado_servicio_actual,
            requiere_mas_info: detail.requiere_mas_info,
            clasificacion_ia: detail.clasificacion_ia,
            auxilio_sugerido: detail.auxilio_sugerido,
            confianza_clasificacion: detail.confianza_clasificacion,
            resumen_ia: detail.resumen_ia,
          } as IncidenteDisponible;
        }),
        catchError(() => {
          this.incidentesService.quitarSolicitudAceptadaLocal(item.id_solicitud_taller);
          return of(null);
        })
      )
    );

    const storedAcceptedDetails$ =
      requests.length > 0
        ? forkJoin(requests)
        : of([] as Array<IncidenteDisponible | null>);

    forkJoin({
      backendAccepted: acceptedFromBackend$,
      storedAccepted: storedAcceptedDetails$,
    }).subscribe({
      next: ({ backendAccepted, storedAccepted }) => {
        const fromStored = storedAccepted.filter(
          (item): item is IncidenteDisponible => !!item
        );
        const mergedMap = new Map<number, IncidenteDisponible>();

        [...backendAccepted, ...fromStored].forEach((incidente) => {
          mergedMap.set(incidente.id_incidente, incidente);
        });

        this.incidentes = Array.from(mergedMap.values());
        this.loading = false;
        if (this.incidentes.length === 0) {
          this.successMessage =
            'No hay solicitudes aceptadas vigentes. Acepta una solicitud para continuar con asignacion de recursos.';
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.errorMessage =
          'No se pudo recuperar la lista de solicitudes aceptadas para asignacion.';
        this.cdr.detectChanges();
      },
    });
  }

  getDetalleRouteId(incidente: IncidenteDisponible): number {
    return incidente.id_solicitud_taller ?? incidente.id_incidente;
  }

  abrirDetalle(incidente: IncidenteDisponible): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.isTechnicianView) {
      void this.router.navigate([this.detailBaseRoute, incidente.id_incidente], {
        state: { incidentePreview: incidente },
      });
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

  cargarAsignacionesTecnico(): void {
    this.seguimientoSocket?.close();
    this.loading = false;
    this.errorMessage = '';
    this.successMessage = '';
    this.incidentes = [
      {
        id_incidente: this.technicianIncidentId,
        titulo: 'Incidente en camino',
        descripcion_texto:
          'Tienes una atencion activa. Abre seguimiento para ver la ruta y compartir tu ubicacion.',
        fecha_reporte: new Date().toISOString(),
        id_vehiculo: 0,
        id_tipo_incidente: 0,
        tipo_incidente: 'ASIGNADO',
        id_prioridad: 1,
        prioridad: 'ALTA',
        id_estado_servicio_actual: 0,
        estado_servicio_actual: this.estadoServicioActual,
      },
    ];
    this.cdr.detectChanges();
  }

  cargarSeguimientoTecnico(): void {
    this.loading = false;
    this.errorMessage = '';
    this.successMessage = '';
    this.incidentes = [
      {
        id_incidente: this.technicianIncidentId,
        titulo: 'Incidente asignado actual',
        descripcion_texto:
          'Asignacion activa del tecnico. El seguimiento se actualiza por WebSocket.',
        fecha_reporte: new Date().toISOString(),
        id_vehiculo: 0,
        id_tipo_incidente: 0,
        tipo_incidente: 'SEGUIMIENTO',
        id_prioridad: 1,
        prioridad: 'ALTA',
        id_estado_servicio_actual: 0,
        estado_servicio_actual: this.estadoServicioActual,
      },
    ];

    this.connectSeguimientoSocket();
    this.cdr.detectChanges();
  }

  usarUbicacionDelNavegador(): void {
    this.errorMessage = '';

    if (!navigator.geolocation) {
      this.errorMessage = 'El navegador no permite obtener la ubicacion actual.';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.currentLatitude = Number(position.coords.latitude.toFixed(7));
        this.currentLongitude = Number(position.coords.longitude.toFixed(7));
        this.cdr.detectChanges();
      },
      () => {
        this.errorMessage = 'No se pudo obtener la ubicacion del navegador.';
        this.cdr.detectChanges();
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  actualizarUbicacion(): void {
    this.locationSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.seguimientoTecnicoService
      .actualizarUbicacion(this.technicianIncidentId, {
        latitud: Number(this.currentLatitude),
        longitud: Number(this.currentLongitude),
        confirmar_envio: true,
      })
      .subscribe({
        next: (response) => {
          this.tracking = response;
          this.successMessage = response.mensaje || 'Ubicacion actualizada correctamente.';
          this.locationSaving = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.errorMessage = 'No fue posible actualizar la ubicacion actual.';
          this.locationSaving = false;
          this.cdr.detectChanges();
        },
      });
  }

  private connectSeguimientoSocket(): void {
    this.seguimientoSocket?.close();
    this.seguimientoSocket = this.seguimientoTecnicoService.createSeguimientoSocket(
      this.technicianIncidentId,
    );

    if (!this.seguimientoSocket) {
      this.wsMessage = 'No se encontro un token activo para abrir el seguimiento.';
      return;
    }

    this.wsMessage = 'Conectando con seguimiento en tiempo real...';

    this.seguimientoSocket.onopen = () => {
      this.wsMessage = 'Seguimiento en tiempo real conectado.';
      this.cdr.detectChanges();
    };

    this.seguimientoSocket.onmessage = (event) => {
      this.applySocketEvent(event.data);
      this.cdr.detectChanges();
    };

    this.seguimientoSocket.onerror = () => {
      this.wsMessage = 'No se pudo conectar con el canal en tiempo real.';
      this.cdr.detectChanges();
    };

    this.seguimientoSocket.onclose = () => {
      this.wsMessage = 'Canal de seguimiento desconectado.';
      this.cdr.detectChanges();
    };
  }

  private applySocketEvent(rawData: string): void {
    try {
      const event = JSON.parse(rawData) as {
        type?: string;
        payload?: Partial<SeguimientoIncidenteResponse> & {
          latitud?: number | string;
          longitud?: number | string;
        };
      };
      const payload = event.payload;
      if (!payload) {
        return;
      }

      this.tracking = {
        id_incidente: Number(payload.id_incidente ?? this.technicianIncidentId),
        id_tecnico: Number(payload.id_tecnico ?? this.tracking?.id_tecnico ?? 11),
        id_unidad_movil: Number(payload.id_unidad_movil ?? this.tracking?.id_unidad_movil ?? 11),
        latitud_actual: payload.latitud_actual ?? payload.latitud ?? this.markerLatitude,
        longitud_actual: payload.longitud_actual ?? payload.longitud ?? this.markerLongitude,
        fecha_actualizacion:
          payload.fecha_actualizacion ?? this.tracking?.fecha_actualizacion ?? '',
        estado_asignacion:
          payload.estado_asignacion ?? this.tracking?.estado_asignacion ?? 'EN_CAMINO',
        estado_servicio_actual:
          payload.estado_servicio_actual ?? this.tracking?.estado_servicio_actual ?? 'EN_CAMINO',
        mensaje:
          payload.mensaje ??
          (event.type === 'conexion_establecida'
            ? 'Conexion de seguimiento establecida.'
            : 'Ubicacion actualizada en tiempo real.'),
      };

      this.currentLatitude = this.markerLatitude;
      this.currentLongitude = this.markerLongitude;
      this.wsMessage = this.tracking.mensaje;
    } catch {
      this.wsMessage = 'Se recibio un evento de seguimiento no reconocido.';
    }
  }

  private toNumber(value: number | string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private projectLongitude(value: number): number {
    return this.clamp(((value + 63.14) / 0.02) * 100, 8, 92);
  }

  private projectLatitude(value: number): number {
    return this.clamp(((value + 17.724) / -0.02) * 100, 8, 92);
  }

  private calculateDistanceKm(
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number,
  ): number {
    const earthRadiusKm = 6371;
    const latDelta = this.toRadians(endLat - startLat);
    const lonDelta = this.toRadians(endLon - startLon);
    const startLatRad = this.toRadians(startLat);
    const endLatRad = this.toRadians(endLat);
    const a =
      Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
      Math.cos(startLatRad) * Math.cos(endLatRad) * Math.sin(lonDelta / 2) * Math.sin(lonDelta / 2);

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }
}
