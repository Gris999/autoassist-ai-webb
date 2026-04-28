import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, startWith } from 'rxjs';

import { TokenService } from '../../../../core/services/token.service';
import {
  IncidentMetricDetail,
  IncidentMetricSummary,
} from '../../models/incident-metrics.model';
import { IncidentMetricsService } from '../../services/incident-metrics.service';

type PerformanceFilter = 'todos' | 'alto' | 'medio' | 'bajo' | 'sin_datos';

@Component({
  selector: 'app-metricas-incidentes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './metricas-incidentes.html',
  styleUrl: './metricas-incidentes.scss',
})
export class MetricasIncidentes implements OnInit {
  private readonly chartWidth = 520;
  private readonly chartHeight = 180;
  private readonly fb = inject(FormBuilder);
  private readonly incidentMetricsService = inject(IncidentMetricsService);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);

  readonly loadingList = signal(true);
  readonly loadingDetail = signal(false);
  readonly errorMessage = signal('');
  readonly detailErrorMessage = signal('');
  readonly successMessage = signal('');
  readonly metrics = signal<IncidentMetricSummary[]>([]);
  readonly selectedIncidentId = signal<number | null>(null);
  readonly selectedMetric = signal<IncidentMetricDetail | null>(null);

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    estado: ['todos'],
    rendimiento: ['todos' as PerformanceFilter],
  });

  private readonly filterValue = toSignal(
    this.filterForm.valueChanges.pipe(startWith(this.filterForm.getRawValue())),
    { initialValue: this.filterForm.getRawValue() }
  );

  readonly filteredMetrics = computed(() => {
    const filters = this.filterValue();
    const search = (filters.search ?? '').trim().toLowerCase();
    const estado = (filters.estado ?? 'todos').trim().toUpperCase();
    const rendimiento = filters.rendimiento;

    return this.metrics().filter((metric) => {
      if (estado !== 'TODOS' && metric.estado_actual.toUpperCase() !== estado) {
        return false;
      }

      if (
        rendimiento !== 'todos' &&
        metric.rendimiento_operativo.toLowerCase() !== rendimiento
      ) {
        return false;
      }

      if (!search) {
        return true;
      }

      const haystack = [
        metric.id_incidente,
        metric.titulo,
        metric.estado_actual,
        metric.estado_frecuente,
        metric.rendimiento_operativo,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });
  });

  readonly totalIncidentes = computed(() => this.metrics().length);
  readonly totalFinalizados = computed(
    () =>
      this.metrics().filter(
        (metric) => metric.estado_actual.toUpperCase() === 'FINALIZADO'
      ).length
  );
  readonly totalSinDatos = computed(
    () =>
      this.metrics().filter(
        (metric) => metric.rendimiento_operativo.toLowerCase() === 'sin_datos'
      ).length
  );
  readonly promedioRespuesta = computed(() => {
    const responseTimes = this.metrics()
      .map((metric) => metric.tiempo_respuesta_seg)
      .filter((value): value is number => typeof value === 'number' && value >= 0);

    if (responseTimes.length === 0) {
      return null;
    }

    return Math.round(
      responseTimes.reduce((accumulator, value) => accumulator + value, 0) /
        responseTimes.length
    );
  });
  readonly ultimaGeneracion = computed(() => {
    const entries = this.metrics();
    if (entries.length === 0) {
      return null;
    }

    return entries
      .map((metric) => metric.fecha_generacion)
      .sort((left, right) => right.localeCompare(left))[0];
  });
  readonly trendSeries = computed(() => {
    const grouped = new Map<
      string,
      { label: string; registrados: number; atendidos: number }
    >();

    [...this.filteredMetrics()]
      .sort((left, right) => left.fecha_reporte.localeCompare(right.fecha_reporte))
      .forEach((metric) => {
        const key = metric.fecha_reporte.slice(0, 10);
        const current =
          grouped.get(key) ?? {
            label: this.formatShortDate(metric.fecha_reporte),
            registrados: 0,
            atendidos: 0,
          };

        current.registrados += 1;
        if (metric.estado_actual.toUpperCase() === 'FINALIZADO') {
          current.atendidos += 1;
        }

        grouped.set(key, current);
      });

    return Array.from(grouped.values());
  });
  readonly trendMaxValue = computed(() => {
    const values = this.trendSeries().flatMap((entry) => [
      entry.registrados,
      entry.atendidos,
    ]);

    return Math.max(...values, 1);
  });
  readonly registeredTrendPoints = computed(() =>
    this.buildLinePoints(
      this.trendSeries().map((entry) => entry.registrados),
      this.chartWidth,
      this.chartHeight,
      this.trendMaxValue()
    )
  );
  readonly attendedTrendPoints = computed(() =>
    this.buildLinePoints(
      this.trendSeries().map((entry) => entry.atendidos),
      this.chartWidth,
      this.chartHeight,
      this.trendMaxValue()
    )
  );
  readonly frequentStatesDistribution = computed(() => {
    const counts = new Map<string, number>();

    this.filteredMetrics().forEach((metric) => {
      const key = metric.estado_frecuente || 'SIN_DATOS';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    const total = this.filteredMetrics().length || 1;

    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1])
      .map(([estado, cantidad], index) => ({
        estado,
        cantidad,
        porcentaje: Math.round((cantidad / total) * 100),
        tone: this.getDistributionTone(index),
      }));
  });
  readonly strategicInsight = computed(() => {
    const topState = this.frequentStatesDistribution()[0];
    const average = this.promedioRespuesta();

    if (!topState && average === null) {
      return 'Aun no hay suficiente informacion para generar una lectura estrategica del comportamiento operativo.';
    }

    if (!topState) {
      return `El tiempo promedio de respuesta actual es ${this.formatDuration(
        average
      )}. Revisa mas incidentes para consolidar un estado dominante.`;
    }

    return `El estado frecuente dominante es ${topState.estado} con ${topState.porcentaje}% de presencia en la consulta actual. El tiempo promedio de respuesta se mantiene en ${this.formatDuration(
      average
    )}.`;
  });

  ngOnInit(): void {
    this.loadMetrics();
  }

  loadMetrics(): void {
    const currentSelectedId = this.selectedIncidentId();

    this.loadingList.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.incidentMetricsService
      .getIncidentMetrics()
      .pipe(finalize(() => this.loadingList.set(false)))
      .subscribe({
        next: (metrics) => {
          this.metrics.set(metrics);

          if (metrics.length === 0) {
            this.selectedIncidentId.set(null);
            this.selectedMetric.set(null);
            this.detailErrorMessage.set('');
            return;
          }

          const nextMetric =
            metrics.find((metric) => metric.id_incidente === currentSelectedId) ??
            metrics[0];

          this.selectMetric(nextMetric.id_incidente);
          this.successMessage.set('Indicadores operativos actualizados.');
        },
        error: (error) => {
          this.handleHttpError(
            error,
            'No se pudieron cargar las metricas de incidentes.'
          );
        },
      });
  }

  selectMetric(idIncidente: number): void {
    this.selectedIncidentId.set(idIncidente);
    this.loadingDetail.set(true);
    this.detailErrorMessage.set('');

    this.incidentMetricsService
      .getIncidentMetricById(idIncidente)
      .pipe(finalize(() => this.loadingDetail.set(false)))
      .subscribe({
        next: (metric) => {
          this.selectedMetric.set(metric);
        },
        error: (error) => {
          const httpError = error as {
            status?: number;
            error?: { detail?: string };
          };

          if (httpError?.status === 404) {
            this.selectedMetric.set(null);
            this.detailErrorMessage.set('No se encontro la metrica del incidente.');
            return;
          }

          this.handleDetailHttpError(
            error,
            'No se pudo cargar el detalle de la metrica seleccionada.'
          );
        },
      });
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      estado: 'todos',
      rendimiento: 'todos',
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

  formatDuration(seconds: number | null | undefined): string {
    if (seconds === null || seconds === undefined || seconds < 0) {
      return 'No disponible';
    }

    if (seconds < 60) {
      return `${seconds}s`;
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    const parts = [
      hours > 0 ? `${hours}h` : '',
      minutes > 0 ? `${minutes}m` : '',
      remainingSeconds > 0 ? `${remainingSeconds}s` : '',
    ].filter(Boolean);

    return parts.join(' ') || '0s';
  }

  formatBoolean(value: boolean | null | undefined): string {
    return value ? 'Sí' : 'No';
  }

  getPerformanceBadgeClass(value: string | null | undefined): string {
    switch ((value ?? '').toLowerCase()) {
      case 'alto':
        return 'performance-badge performance-badge--high';
      case 'medio':
        return 'performance-badge performance-badge--medium';
      case 'bajo':
        return 'performance-badge performance-badge--low';
      default:
        return 'performance-badge performance-badge--muted';
    }
  }

  getStatusBadgeClass(value: string | null | undefined): string {
    switch ((value ?? '').toUpperCase()) {
      case 'FINALIZADO':
        return 'status-badge status-badge--done';
      case 'EN_CAMINO':
        return 'status-badge status-badge--route';
      case 'EN_PROCESO':
        return 'status-badge status-badge--progress';
      case 'PENDIENTE':
      case 'REPORTADO':
        return 'status-badge status-badge--pending';
      default:
        return 'status-badge';
    }
  }

  trackMetric(_: number, metric: IncidentMetricSummary): number {
    return metric.id_incidente;
  }

  private formatShortDate(value: string): string {
    return new Intl.DateTimeFormat('es-BO', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(value));
  }

  private buildLinePoints(
    values: number[],
    width: number,
    height: number,
    maxValue: number
  ): string {
    if (values.length === 0) {
      return '';
    }

    if (values.length === 1) {
      const y = this.scaleToChart(values[0], height, maxValue);
      return `0,${y} ${width},${y}`;
    }

    const stepX = width / (values.length - 1);

    return values
      .map((value, index) => {
        const x = Math.round(index * stepX);
        const y = this.scaleToChart(value, height, maxValue);
        return `${x},${y}`;
      })
      .join(' ');
  }

  private scaleToChart(value: number, height: number, maxValue: number): number {
    const safeMax = Math.max(maxValue, 1);
    const ratio = value / safeMax;
    return Math.round(height - ratio * (height - 12));
  }

  private getDistributionTone(index: number): string {
    switch (index) {
      case 0:
        return 'primary';
      case 1:
        return 'warning';
      case 2:
        return 'danger';
      default:
        return 'muted';
    }
  }

  private handleHttpError(error: unknown, fallbackMessage: string): void {
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
        'No tienes permisos suficientes para consultar metricas de incidentes.'
      );
      return;
    }

    if (httpError?.status === 500) {
      this.errorMessage.set(
        'No fue posible generar las metricas en este momento. Intenta nuevamente.'
      );
      return;
    }

    this.errorMessage.set(
      httpError?.error?.detail ??
        'No se pudo completar la consulta. Verifica tu conexion e intenta nuevamente.'
    );
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
        'No tienes permisos suficientes para ver el detalle de esta metrica.'
      );
      return;
    }

    if (httpError?.status === 500) {
      this.detailErrorMessage.set(
        'No fue posible cargar el detalle del incidente. Intenta nuevamente.'
      );
      return;
    }

    this.detailErrorMessage.set(httpError?.error?.detail ?? fallbackMessage);
  }
}
