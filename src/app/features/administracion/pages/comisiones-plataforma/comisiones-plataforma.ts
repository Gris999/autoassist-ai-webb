import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, startWith } from 'rxjs';

import { TokenService } from '../../../../core/services/token.service';
import {
  GeneratePlatformCommissionsResponse,
  PlatformCommissionDetail,
  PlatformCommissionListItem,
} from '../../models/platform-commission.model';
import { PlatformCommissionsService } from '../../services/platform-commissions.service';

@Component({
  selector: 'app-comisiones-plataforma',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './comisiones-plataforma.html',
  styleUrl: './comisiones-plataforma.scss',
})
export class ComisionesPlataforma implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);
  private readonly platformCommissionsService = inject(
    PlatformCommissionsService
  );

  readonly loadingList = signal(true);
  readonly loadingDetail = signal(false);
  readonly generating = signal(false);
  readonly errorMessage = signal('');
  readonly detailErrorMessage = signal('');
  readonly actionErrorMessage = signal('');
  readonly successMessage = signal('');
  readonly commissions = signal<PlatformCommissionListItem[]>([]);
  readonly selectedCommissionId = signal<number | null>(null);
  readonly selectedCommission = signal<PlatformCommissionDetail | null>(null);
  readonly lastGenerationSummary =
    signal<GeneratePlatformCommissionsResponse | null>(null);

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    id_taller: [''],
    estado: [''],
    id_pago_servicio: [''],
    id_incidente: [''],
  });

  readonly generateForm = this.fb.nonNullable.group({
    id_pago_servicio: [''],
    recalcular: [false],
  });

  private readonly filterValue = toSignal(
    this.filterForm.valueChanges.pipe(startWith(this.filterForm.getRawValue())),
    { initialValue: this.filterForm.getRawValue() }
  );

  readonly filteredCommissions = computed(() => {
    const filters = this.filterValue();
    const search = (filters.search ?? '').trim().toLowerCase();

    return this.commissions().filter((commission) => {
      if (!search) {
        return true;
      }

      const haystack = [
        commission.id_comision,
        commission.id_pago_servicio,
        commission.id_incidente,
        commission.nombre_taller,
        commission.titulo_incidente,
        commission.estado,
        commission.estado_pago,
        commission.referencia_transaccion,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });
  });

  readonly totalComision = computed(() =>
    this.commissions().reduce(
      (accumulator, commission) => accumulator + commission.monto_comision,
      0
    )
  );
  readonly totalRegistros = computed(() => this.commissions().length);
  readonly promedioPorcentaje = computed(() => {
    const items = this.commissions();
    if (items.length === 0) {
      return null;
    }

    const total = items.reduce(
      (accumulator, commission) => accumulator + commission.porcentaje,
      0
    );
    return total / items.length;
  });
  readonly pendientesLiquidacion = computed(
    () =>
      this.commissions().filter(
        (commission) =>
          commission.estado.toUpperCase() === 'PENDIENTE_LIQUIDACION'
      ).length
  );
  readonly activePolicyLabel = computed(() => {
    const average = this.promedioPorcentaje();
    if (average === null) {
      return 'Sin comisiones calculadas';
    }

    return `Comision plataforma: ${this.formatPercentage(average)}`;
  });

  ngOnInit(): void {
    this.loadCommissions();
  }

  loadCommissions(): void {
    const currentSelectedId = this.selectedCommissionId();
    const filters = this.buildFilters();

    this.loadingList.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.platformCommissionsService
      .getPlatformCommissions(filters)
      .pipe(finalize(() => this.loadingList.set(false)))
      .subscribe({
        next: (commissions) => {
          this.commissions.set(commissions);

          if (commissions.length === 0) {
            this.selectedCommissionId.set(null);
            this.selectedCommission.set(null);
            this.detailErrorMessage.set('');
            return;
          }

          const nextSelection =
            commissions.find(
              (commission) => commission.id_comision === currentSelectedId
            ) ?? commissions[0];

          this.selectCommission(nextSelection.id_comision);
        },
        error: (error) => {
          this.handleListHttpError(
            error,
            'No se pudieron cargar las comisiones de la plataforma.'
          );
        },
      });
  }

  applyFilters(): void {
    this.loadCommissions();
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      id_taller: '',
      estado: '',
      id_pago_servicio: '',
      id_incidente: '',
    });
    this.loadCommissions();
  }

  selectCommission(idComision: number): void {
    this.selectedCommissionId.set(idComision);
    this.loadingDetail.set(true);
    this.detailErrorMessage.set('');

    this.platformCommissionsService
      .getPlatformCommissionById(idComision)
      .pipe(finalize(() => this.loadingDetail.set(false)))
      .subscribe({
        next: (detail) => {
          this.selectedCommission.set(detail);
        },
        error: (error) => {
          const httpError = error as {
            status?: number;
            error?: { detail?: string };
          };

          if (httpError?.status === 404) {
            this.selectedCommission.set(null);
            this.detailErrorMessage.set(
              'La comision no existe o ya no esta disponible.'
            );
            return;
          }

          this.handleDetailHttpError(
            error,
            'No se pudo cargar el detalle de la comision seleccionada.'
          );
        },
      });
  }

  submitGeneration(): void {
    this.generate(false);
  }

  recalculateSelected(): void {
    const selected = this.selectedCommission();
    if (!selected) {
      this.actionErrorMessage.set(
        'Selecciona una comision para recalcular a partir de su pago asociado.'
      );
      return;
    }

    this.generate(true, selected.id_pago_servicio);
  }

  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return 'Bs. 0';
    }

    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  formatPercentage(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '0%';
    }

    return `${new Intl.NumberFormat('es-BO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)}%`;
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

  getCommissionBadgeClass(value: string | null | undefined): string {
    switch ((value ?? '').toUpperCase()) {
      case 'PENDIENTE_LIQUIDACION':
        return 'status-badge status-badge--pending';
      case 'LIQUIDADA':
      case 'VALIDADA':
        return 'status-badge status-badge--success';
      case 'RECHAZADA':
      case 'ANULADA':
        return 'status-badge status-badge--danger';
      default:
        return 'status-badge status-badge--neutral';
    }
  }

  getPaymentBadgeClass(value: string | null | undefined): string {
    switch ((value ?? '').toUpperCase()) {
      case 'PAGADO':
      case 'CONFIRMADO':
        return 'payment-badge payment-badge--success';
      case 'PENDIENTE':
        return 'payment-badge payment-badge--pending';
      default:
        return 'payment-badge payment-badge--neutral';
    }
  }

  trackCommission(_: number, commission: PlatformCommissionListItem): number {
    return commission.id_comision;
  }

  trackDetailRow(_: number, item: { id_detalle_pago: number }): number {
    return item.id_detalle_pago;
  }

  private buildFilters(): {
    id_taller?: number;
    estado?: string;
    id_pago_servicio?: number;
    id_incidente?: number;
  } {
    const raw = this.filterForm.getRawValue();
    const idTaller = this.parseOptionalNumber(raw.id_taller) ?? undefined;
    const idPagoServicio =
      this.parseOptionalNumber(raw.id_pago_servicio) ?? undefined;
    const idIncidente = this.parseOptionalNumber(raw.id_incidente) ?? undefined;

    return {
      id_taller: idTaller,
      estado: (raw.estado ?? '').trim() || undefined,
      id_pago_servicio: idPagoServicio,
      id_incidente: idIncidente,
    };
  }

  private generate(recalcular: boolean, forcedPaymentId?: number): void {
    const paymentId =
      forcedPaymentId ??
      this.parseOptionalNumber(this.generateForm.getRawValue().id_pago_servicio);

    this.generating.set(true);
    this.actionErrorMessage.set('');
    this.successMessage.set('');

    this.platformCommissionsService
      .generatePlatformCommissions({
        id_pago_servicio: paymentId ?? undefined,
        recalcular,
      })
      .pipe(finalize(() => this.generating.set(false)))
      .subscribe({
        next: (response) => {
          this.lastGenerationSummary.set(response);
          this.successMessage.set(
            response.mensaje ??
              (recalcular
                ? 'Comisiones recalculadas correctamente.'
                : 'Comisiones generadas correctamente.')
          );

          const selectedId = response.comisiones[0]?.id_comision ?? null;

          this.loadCommissions();

          if (selectedId) {
            this.selectCommission(selectedId);
          }

          if (!forcedPaymentId) {
            this.generateForm.patchValue({
              id_pago_servicio: paymentId ? String(paymentId) : '',
              recalcular,
            });
          }
        },
        error: (error) => {
          this.handleActionHttpError(
            error,
            recalcular
              ? 'No fue posible recalcular comisiones.'
              : 'No fue posible generar comisiones.'
          );
        },
      });
  }

  private parseOptionalNumber(value: string | null | undefined): number | null {
    const normalized = (value ?? '').trim();
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
        'No tienes permisos suficientes para consultar comisiones de la plataforma.'
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
        'No tienes permisos suficientes para ver el detalle de esta comision.'
      );
      return;
    }

    this.detailErrorMessage.set(httpError?.error?.detail ?? fallbackMessage);
  }

  private handleActionHttpError(error: unknown, fallbackMessage: string): void {
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
      this.actionErrorMessage.set(
        'No tienes permisos suficientes para generar o recalcular comisiones.'
      );
      return;
    }

    if (httpError?.status === 400) {
      this.actionErrorMessage.set(httpError?.error?.detail ?? fallbackMessage);
      return;
    }

    this.actionErrorMessage.set(httpError?.error?.detail ?? fallbackMessage);
  }
}
