import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  GeneratePlatformCommissionsRequest,
  GeneratePlatformCommissionsResponse,
  PlatformCommissionDetail,
  PlatformCommissionFilters,
  PlatformCommissionListItem,
} from '../models/platform-commission.model';

@Injectable({
  providedIn: 'root',
})
export class PlatformCommissionsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getPlatformCommissions(
    filters?: PlatformCommissionFilters
  ): Observable<PlatformCommissionListItem[]> {
    let params = new HttpParams();

    if (filters?.id_taller) {
      params = params.set('id_taller', filters.id_taller);
    }

    if (filters?.estado) {
      params = params.set('estado', filters.estado);
    }

    if (filters?.id_pago_servicio) {
      params = params.set('id_pago_servicio', filters.id_pago_servicio);
    }

    if (filters?.id_incidente) {
      params = params.set('id_incidente', filters.id_incidente);
    }

    return this.http.get<PlatformCommissionListItem[]>(
      `${this.apiUrl}/inteligencia/comisiones`,
      { params }
    );
  }

  getPlatformCommissionById(id: number): Observable<PlatformCommissionDetail> {
    return this.http.get<PlatformCommissionDetail>(
      `${this.apiUrl}/inteligencia/comisiones/${id}`
    );
  }

  generatePlatformCommissions(
    payload: GeneratePlatformCommissionsRequest
  ): Observable<GeneratePlatformCommissionsResponse> {
    return this.http.post<GeneratePlatformCommissionsResponse>(
      `${this.apiUrl}/inteligencia/comisiones/generar`,
      payload
    );
  }
}
