import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { TokenService } from '../../../core/services/token.service';
import { environment } from '../../../../environments/environment';

export interface ActualizarUbicacionRequest {
  latitud: number;
  longitud: number;
  confirmar_envio: boolean;
}

export interface SeguimientoIncidenteResponse {
  id_incidente: number;
  id_tecnico: number;
  id_unidad_movil: number;
  latitud_actual: number | string;
  longitud_actual: number | string;
  fecha_actualizacion: string;
  estado_asignacion: string;
  estado_servicio_actual: string;
  mensaje: string;
}

@Injectable({
  providedIn: 'root',
})
export class SeguimientoTecnicoService {
  private readonly http = inject(HttpClient);
  private readonly tokenService = inject(TokenService);
  private readonly apiUrl = environment.apiUrl;

  actualizarUbicacion(
    idIncidente: number,
    body: ActualizarUbicacionRequest
  ): Observable<SeguimientoIncidenteResponse> {
    return this.http.patch<SeguimientoIncidenteResponse>(
      `${this.apiUrl}/seguimiento/incidentes/${idIncidente}/ubicacion-actual`,
      body
    );
  }

  createSeguimientoSocket(idIncidente: number): WebSocket | null {
    const token = this.tokenService.getToken();
    if (!token) {
      return null;
    }

    const wsBaseUrl = this.apiUrl.replace(/^http/i, 'ws');
    return new WebSocket(
      `${wsBaseUrl}/seguimiento/ws/incidentes/${idIncidente}?token=${encodeURIComponent(token)}`
    );
  }
}
