import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment.development';
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
  confianza_clasificacion: number;
  prioridad: string;
  resumen_ia: string;
  requiere_mas_info: boolean;
  preguntas_sugeridas: string[];
}

@Injectable({
  providedIn: 'root',
})
export class IncidentesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

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
}
