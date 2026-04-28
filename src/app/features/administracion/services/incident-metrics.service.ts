import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment.development';
import {
  IncidentMetricDetail,
  IncidentMetricSummary,
} from '../models/incident-metrics.model';

@Injectable({
  providedIn: 'root',
})
export class IncidentMetricsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getIncidentMetrics(): Observable<IncidentMetricSummary[]> {
    return this.http.get<IncidentMetricSummary[]>(
      `${this.apiUrl}/inteligencia/metricas/incidentes`
    );
  }

  getIncidentMetricById(id: number): Observable<IncidentMetricDetail> {
    return this.http.get<IncidentMetricDetail>(
      `${this.apiUrl}/inteligencia/metricas/incidentes/${id}`
    );
  }
}
