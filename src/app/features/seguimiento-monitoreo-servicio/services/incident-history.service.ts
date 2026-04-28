import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment.development';
import {
  IncidenteHistorialDetail,
  IncidenteHistorialListItem,
} from '../models/incident-history.model';

@Injectable({
  providedIn: 'root',
})
export class IncidentHistoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getIncidentHistoryList(): Observable<IncidenteHistorialListItem[]> {
    return this.http.get<IncidenteHistorialListItem[]>(
      `${this.apiUrl}/seguimiento/incidentes/historial`
    );
  }

  getIncidentHistoryById(id: number): Observable<IncidenteHistorialDetail> {
    return this.http.get<IncidenteHistorialDetail>(
      `${this.apiUrl}/seguimiento/incidentes/${id}/historial`
    );
  }
}
