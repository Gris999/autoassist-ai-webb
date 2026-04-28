import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  ActualizarEstadoIncidenteRequest,
  ActualizarEstadoIncidenteResponse,
  AsignacionServicioResponse,
  AsignarRecursosRequest,
  EstadoIncidenteTallerResponse,
  IncidenteDisponible,
  ResponderSolicitudRequest,
  ResponderSolicitudResponse,
  SolicitudAtencionDetalle,
  TecnicoDisponible,
  UnidadMovilDisponible,
} from '../models/incidente-atencion.model';

export interface AnalisisIncidenteResponse {
  id_incidente: number;
  clasificacion_ia: string;
  auxilio_sugerido?: string | null;
  confianza_clasificacion: number;
  prioridad: string;
  resumen_ia: string;
  requiere_mas_info: boolean;
  preguntas_sugeridas: string[];
}

interface SolicitudAceptadaLocal {
  id_solicitud_taller: number;
  id_incidente: number;
  fecha_guardado: string;
}

@Injectable({
  providedIn: 'root',
})
export class IncidentesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly acceptedRequestsStorageKey = 'autoassist_taller_solicitudes_aceptadas';

  getIncidentesDisponibles(): Observable<IncidenteDisponible[]> {
    return this.http.get<IncidenteDisponible[]>(`${this.apiUrl}/incidentes/disponibles`);
  }

  getDetalleSolicitudAtencion(idSolicitudTaller: number): Observable<SolicitudAtencionDetalle> {
    return this.http.get<SolicitudAtencionDetalle>(
      `${this.apiUrl}/incidentes/taller/solicitudes-atencion/${idSolicitudTaller}`,
    );
  }

  responderSolicitudAtencion(
    idSolicitudTaller: number,
    accion: 'aceptar' | 'rechazar',
  ): Observable<ResponderSolicitudResponse> {
    const payload: ResponderSolicitudRequest = { accion };

    return this.http.patch<ResponderSolicitudResponse>(
      `${this.apiUrl}/incidentes/taller/solicitudes-atencion/${idSolicitudTaller}/respuesta`,
      payload,
    );
  }

  getTecnicosDisponibles(idIncidente: number): Observable<TecnicoDisponible[]> {
    return this.http.get<TecnicoDisponible[]>(
      `${this.apiUrl}/incidentes/taller/incidentes/${idIncidente}/tecnicos-disponibles`,
    );
  }

  getUnidadesMovilesDisponibles(idIncidente: number): Observable<UnidadMovilDisponible[]> {
    return this.http.get<UnidadMovilDisponible[]>(
      `${this.apiUrl}/incidentes/taller/incidentes/${idIncidente}/unidades-moviles-disponibles`,
    );
  }

  asignarRecursosIncidente(
    idIncidente: number,
    body: AsignarRecursosRequest,
  ): Observable<AsignacionServicioResponse> {
    return this.http.post<AsignacionServicioResponse>(
      `${this.apiUrl}/incidentes/taller/incidentes/${idIncidente}/asignacion`,
      body,
    );
  }

  getEstadoIncidenteTaller(idIncidente: number): Observable<EstadoIncidenteTallerResponse> {
    return this.http.get<EstadoIncidenteTallerResponse>(
      `${this.apiUrl}/incidentes/taller/incidentes/${idIncidente}/estado`,
    );
  }

  actualizarEstadoIncidenteTaller(
    idIncidente: number,
    body: ActualizarEstadoIncidenteRequest,
  ): Observable<ActualizarEstadoIncidenteResponse> {
    return this.http.patch<ActualizarEstadoIncidenteResponse>(
      `${this.apiUrl}/incidentes/taller/incidentes/${idIncidente}/estado`,
      body,
    );
  }

  analizarIncidente(idIncidente: number): Observable<AnalisisIncidenteResponse> {
    return this.http.post<AnalisisIncidenteResponse>(
      `${this.apiUrl}/inteligencia/incidentes/${idIncidente}/analizar`,
      {},
    );
  }

  guardarSolicitudAceptada(idSolicitudTaller: number, idIncidente: number): void {
    const current = this.getSolicitudesAceptadasLocal();
    const withoutCurrent = current.filter(
      (item) => item.id_solicitud_taller !== idSolicitudTaller
    );

    withoutCurrent.unshift({
      id_solicitud_taller: idSolicitudTaller,
      id_incidente: idIncidente,
      fecha_guardado: new Date().toISOString(),
    });

    localStorage.setItem(
      this.acceptedRequestsStorageKey,
      JSON.stringify(withoutCurrent.slice(0, 50))
    );
  }

  obtenerSolicitudesAceptadasLocal(): Array<{ id_solicitud_taller: number; id_incidente: number }> {
    return this.getSolicitudesAceptadasLocal().map((item) => ({
      id_solicitud_taller: item.id_solicitud_taller,
      id_incidente: item.id_incidente,
    }));
  }

  quitarSolicitudAceptadaLocal(idSolicitudTaller: number): void {
    const next = this.getSolicitudesAceptadasLocal().filter(
      (item) => item.id_solicitud_taller !== idSolicitudTaller
    );
    localStorage.setItem(this.acceptedRequestsStorageKey, JSON.stringify(next));
  }

  private getSolicitudesAceptadasLocal(): SolicitudAceptadaLocal[] {
    try {
      const raw = localStorage.getItem(this.acceptedRequestsStorageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as SolicitudAceptadaLocal[];
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter(
        (item) =>
          Number.isFinite(item?.id_solicitud_taller) &&
          Number.isFinite(item?.id_incidente)
      );
    } catch {
      return [];
    }
  }
}
