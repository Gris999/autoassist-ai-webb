import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, forkJoin, startWith } from 'rxjs';

import { TokenService } from '../../../../core/services/token.service';
import {
  ActualizarServicioAuxilioRequest,
  CrearServicioAuxilioRequest,
  ServicioAuxilioTaller,
  TipoAuxilioCatalogo,
  TipoVehiculo,
  TiposVehiculoConfiguracionResponse,
} from '../../models/service-coverage-management.model';
import { WorkshopOperationalService } from '../../services/workshop-operational.service';

type DisponibilidadFilter = 'todos' | 'disponibles' | 'no_disponibles';
type ServiceEditorMode = 'create' | 'edit' | 'view';

@Component({
  selector: 'app-gestionar-servicios-cobertura',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './gestionar-servicios-cobertura.html',
  styleUrl: './gestionar-servicios-cobertura.scss',
})
export class GestionarServiciosCobertura implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly workshopOperationalService = inject(WorkshopOperationalService);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly serviceSelectionLoading = signal(false);
  readonly savingService = signal(false);
  readonly serviceActionId = signal<number | null>(null);
  readonly coverageSaving = signal(false);
  readonly servicesError = signal('');
  readonly servicesSuccess = signal('');
  readonly coverageError = signal('');
  readonly coverageSuccess = signal('');
  readonly services = signal<ServicioAuxilioTaller[]>([]);
  readonly auxilioCatalog = signal<TipoAuxilioCatalogo[]>([]);
  readonly vehicleCatalog = signal<TipoVehiculo[]>([]);
  readonly vehicleConfig = signal<TiposVehiculoConfiguracionResponse | null>(null);
  readonly selectedServiceId = signal<number | null>(null);
  readonly editorMode = signal<ServiceEditorMode>('create');

  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    disponibilidad: ['todos' as DisponibilidadFilter],
  });

  readonly serviceForm = this.fb.nonNullable.group({
    id_tipo_auxilio: [null as number | null, [Validators.required, Validators.min(1)]],
    precio_referencial: [0, [Validators.required, Validators.min(0)]],
    disponible: [true],
  });

  readonly vehicleForm = this.fb.nonNullable.group({
    ids_tipo_vehiculo: this.fb.nonNullable.control<number[]>([]),
  });

  private readonly filterValue = toSignal(
    this.filtersForm.valueChanges.pipe(startWith(this.filtersForm.getRawValue())),
    { initialValue: this.filtersForm.getRawValue() }
  );

  private readonly serviceFormValue = toSignal(
    this.serviceForm.valueChanges.pipe(startWith(this.serviceForm.getRawValue())),
    { initialValue: this.serviceForm.getRawValue() }
  );

  private readonly vehicleSelection = toSignal(
    this.vehicleForm.controls.ids_tipo_vehiculo.valueChanges.pipe(
      startWith(this.vehicleForm.controls.ids_tipo_vehiculo.getRawValue())
    ),
    { initialValue: this.vehicleForm.controls.ids_tipo_vehiculo.getRawValue() }
  );

  readonly selectedService = computed(() => {
    const selectedId = this.selectedServiceId();
    return this.services().find((service) => service.id_taller_auxilio === selectedId) ?? null;
  });
  readonly selectedAuxilioCatalogItem = computed(() => {
    const idTipoAuxilio = this.serviceForm.controls.id_tipo_auxilio.value;
    if (!idTipoAuxilio) {
      return null;
    }

    return (
      this.auxilioCatalog().find((item) => item.id_tipo_auxilio === Number(idTipoAuxilio)) ??
      null
    );
  });

  readonly filteredServices = computed(() => {
    const filters = this.filterValue();
    const search = (filters.search ?? '').trim().toLowerCase();

    return this.services().filter((service) => {
      if (filters.disponibilidad === 'disponibles' && !service.disponible) {
        return false;
      }

      if (filters.disponibilidad === 'no_disponibles' && service.disponible) {
        return false;
      }

      if (!search) {
        return true;
      }

      return [
        service.nombre_tipo_auxilio,
        service.descripcion_tipo_auxilio ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(search);
    });
  });

  readonly totalServices = computed(() => this.services().length);
  readonly totalAvailable = computed(
    () => this.services().filter((service) => service.disponible).length
  );
  readonly totalDisabled = computed(
    () => this.services().filter((service) => !service.disponible).length
  );
  readonly averagePrice = computed(() => {
    const services = this.services();
    if (services.length === 0) {
      return 0;
    }

    const total = services.reduce(
      (accumulator, service) => accumulator + service.precio_referencial,
      0
    );
    return total / services.length;
  });

  readonly isCreateMode = computed(() => this.editorMode() === 'create');
  readonly isEditMode = computed(() => this.editorMode() === 'edit');
  readonly isViewMode = computed(() => this.editorMode() === 'view');

  readonly hasServiceChanges = computed(() => {
    const selectedService = this.selectedService();
    if (!selectedService || !this.isEditMode()) {
      return false;
    }

    this.serviceFormValue();
    return Object.keys(this.buildUpdatePayload(selectedService)).length > 0;
  });

  readonly hasCoverageChanges = computed(() => {
    const currentIds = this.normalizeIds(
      this.vehicleConfig()?.tipos_vehiculo.map((item) => item.id_tipo_vehiculo) ?? []
    );
    const nextIds = this.normalizeIds(this.vehicleSelection());

    return (
      currentIds.length !== nextIds.length ||
      currentIds.some((id, index) => id !== nextIds[index])
    );
  });

  readonly selectedVehicleIds = computed(() => this.vehicleSelection());

  ngOnInit(): void {
    this.loadManagementData();
  }

  loadManagementData(): void {
    const isInitialLoad = this.loading();
    const selectedId = this.selectedServiceId();
    const currentMode = this.editorMode();

    if (isInitialLoad) {
      this.loading.set(true);
    } else {
      this.refreshing.set(true);
    }

    this.servicesError.set('');
    this.coverageError.set('');

    forkJoin({
      services: this.workshopOperationalService.getServiciosAuxilioTaller(),
      auxilioCatalog: this.workshopOperationalService.getTiposAuxilioCatalogo(),
      vehicleCatalog: this.workshopOperationalService.getTiposVehiculoCatalogo(),
      vehicleConfig: this.workshopOperationalService.getTiposVehiculoConfigurados(),
    })
      .pipe(
        finalize(() => {
          if (isInitialLoad) {
            this.loading.set(false);
          } else {
            this.refreshing.set(false);
          }
        })
      )
      .subscribe({
        next: ({ services, auxilioCatalog, vehicleCatalog, vehicleConfig }) => {
          this.services.set(this.sortServices(services));
          this.auxilioCatalog.set(
            [...auxilioCatalog].sort((left, right) => left.nombre.localeCompare(right.nombre))
          );
          this.vehicleCatalog.set(vehicleCatalog);
          this.vehicleConfig.set(vehicleConfig);
          this.vehicleForm.controls.ids_tipo_vehiculo.setValue(
            this.normalizeIds(
              vehicleConfig.tipos_vehiculo.map((item) => item.id_tipo_vehiculo)
            )
          );

          const nextSelectedId =
            services.find((service) => service.id_taller_auxilio === selectedId)
              ?.id_taller_auxilio ??
            services[0]?.id_taller_auxilio ??
            null;

          if (!nextSelectedId) {
            this.startCreateMode();
            return;
          }

          if (currentMode === 'create' && selectedId === null) {
            this.selectService(nextSelectedId, 'view');
            return;
          }

          this.selectService(
            nextSelectedId,
            currentMode === 'edit' ? 'edit' : 'view',
            false
          );
        },
        error: (error) => {
          this.handleServicesError(
            error,
            'No se pudo cargar la configuracion de servicios y cobertura.'
          );
        },
      });
  }

  startCreateMode(): void {
    this.editorMode.set('create');
    this.selectedServiceId.set(null);
    this.resetServiceForm();
    this.servicesSuccess.set('');
  }

  selectService(
    idTallerAuxilio: number,
    mode: ServiceEditorMode = 'view',
    syncForm = true
  ): void {
    this.selectedServiceId.set(idTallerAuxilio);
    this.serviceSelectionLoading.set(true);
    this.servicesError.set('');

    const selectedService =
      this.services().find((service) => service.id_taller_auxilio === idTallerAuxilio) ?? null;

    if (!selectedService) {
      this.serviceSelectionLoading.set(false);
      this.servicesError.set('No se encontro el servicio seleccionado.');
      return;
    }

    queueMicrotask(() => {
      this.serviceSelectionLoading.set(false);
      this.editorMode.set(mode);

      if (syncForm) {
        this.patchServiceForm(selectedService);
      }
    });
  }

  editService(idTallerAuxilio: number): void {
    this.selectService(idTallerAuxilio, 'edit');
  }

  cancelServiceEditor(): void {
    if (this.isEditMode() && this.selectedService()) {
      this.selectService(this.selectedService()!.id_taller_auxilio, 'view');
      return;
    }

    this.resetServiceForm();
  }

  saveService(): void {
    this.servicesError.set('');
    this.servicesSuccess.set('');

    if (this.serviceForm.invalid) {
      this.serviceForm.markAllAsTouched();
      this.servicesError.set(
        'Revisa los datos del servicio antes de guardar.'
      );
      return;
    }

    const rawValue = this.serviceForm.getRawValue();

    if (this.isCreateMode()) {
      const payload: CrearServicioAuxilioRequest = {
        id_tipo_auxilio: Number(rawValue.id_tipo_auxilio),
        precio_referencial: Number(rawValue.precio_referencial),
        disponible: rawValue.disponible,
      };

      this.savingService.set(true);

      this.workshopOperationalService
        .registrarServicioAuxilio(payload)
        .pipe(finalize(() => this.savingService.set(false)))
        .subscribe({
          next: (createdService) => {
            this.upsertService(createdService);
            this.selectedServiceId.set(createdService.id_taller_auxilio);
            this.editorMode.set('view');
            this.patchServiceForm(createdService);
            this.servicesSuccess.set('Servicio de auxilio registrado correctamente.');
          },
          error: (error) => {
            this.handleServicesError(
              error,
              'No se pudo registrar el servicio de auxilio.'
            );
          },
        });

      return;
    }

    const selectedService = this.selectedService();
    if (!selectedService) {
      this.servicesError.set(
        'Selecciona un servicio valido antes de editar.'
      );
      return;
    }

    const payload = this.buildUpdatePayload(selectedService);
    if (Object.keys(payload).length === 0) {
      this.servicesError.set('No hay cambios para guardar.');
      return;
    }

    this.savingService.set(true);

    this.workshopOperationalService
      .actualizarServicioAuxilio(selectedService.id_taller_auxilio, payload)
      .pipe(finalize(() => this.savingService.set(false)))
      .subscribe({
        next: (updatedService) => {
          this.upsertService(updatedService);
          this.patchServiceForm(updatedService);
          this.servicesSuccess.set('Servicio de auxilio actualizado correctamente.');
        },
        error: (error) => {
          this.handleServicesError(
            error,
            'No se pudo actualizar el servicio seleccionado.'
          );
        },
      });
  }

  disableService(service: ServicioAuxilioTaller): void {
    this.serviceActionId.set(service.id_taller_auxilio);
    this.servicesError.set('');
    this.servicesSuccess.set('');

    this.workshopOperationalService
      .deshabilitarServicioAuxilio(service.id_taller_auxilio)
      .pipe(finalize(() => this.serviceActionId.set(null)))
      .subscribe({
        next: (updatedService) => {
          this.upsertService(updatedService);
          this.servicesSuccess.set('Servicio de auxilio deshabilitado correctamente.');
        },
        error: (error) => {
          this.handleServicesError(
            error,
            'No se pudo deshabilitar el servicio seleccionado.'
          );
        },
      });
  }

  enableService(service: ServicioAuxilioTaller): void {
    this.serviceActionId.set(service.id_taller_auxilio);
    this.servicesError.set('');
    this.servicesSuccess.set('');

    this.workshopOperationalService
      .actualizarServicioAuxilio(service.id_taller_auxilio, {
        disponible: true,
      })
      .pipe(finalize(() => this.serviceActionId.set(null)))
      .subscribe({
        next: (updatedService) => {
          this.upsertService(updatedService);
          this.servicesSuccess.set('Servicio de auxilio habilitado correctamente.');
        },
        error: (error) => {
          this.handleServicesError(
            error,
            'No se pudo habilitar el servicio seleccionado.'
          );
        },
      });
  }

  saveVehicleCoverage(): void {
    const idsTipoVehiculo = this.normalizeIds(
      this.vehicleForm.controls.ids_tipo_vehiculo.getRawValue()
    );

    this.coverageError.set('');
    this.coverageSuccess.set('');

    if (idsTipoVehiculo.length === 0) {
      this.coverageError.set(
        'Selecciona al menos un tipo de vehiculo antes de guardar.'
      );
      return;
    }

    this.coverageSaving.set(true);

    this.workshopOperationalService
      .actualizarTiposVehiculoConfigurados(idsTipoVehiculo)
      .pipe(finalize(() => this.coverageSaving.set(false)))
      .subscribe({
        next: (response) => {
          this.vehicleConfig.set(response);
          this.vehicleForm.controls.ids_tipo_vehiculo.setValue(
            this.normalizeIds(
              response.tipos_vehiculo.map((item) => item.id_tipo_vehiculo)
            )
          );
          this.coverageSuccess.set(
            'Configuracion de tipos de vehiculo actualizada correctamente.'
          );
        },
        error: (error) => {
          this.handleCoverageError(
            error,
            'No se pudo guardar la configuracion de tipos de vehiculo.'
          );
        },
      });
  }

  toggleVehicleType(idTipoVehiculo: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const currentIds = this.normalizeIds(
      this.vehicleForm.controls.ids_tipo_vehiculo.getRawValue()
    );

    const nextIds = checked
      ? this.normalizeIds([...currentIds, idTipoVehiculo])
      : currentIds.filter((id) => id !== idTipoVehiculo);

    this.vehicleForm.controls.ids_tipo_vehiculo.setValue(nextIds);
    this.coverageError.set('');
    this.coverageSuccess.set('');
  }

  isVehicleSelected(idTipoVehiculo: number): boolean {
    return this.selectedVehicleIds().includes(idTipoVehiculo);
  }

  getAvailabilityBadgeClass(disponible: boolean): string {
    return disponible
      ? 'status-pill status-pill--available'
      : 'status-pill status-pill--unavailable';
  }

  trackService(_: number, service: ServicioAuxilioTaller): number {
    return service.id_taller_auxilio;
  }

  trackVehicleType(_: number, vehicleType: TipoVehiculo): number {
    return vehicleType.id_tipo_vehiculo;
  }

  private patchServiceForm(service: ServicioAuxilioTaller): void {
    this.serviceForm.patchValue({
      id_tipo_auxilio: service.id_tipo_auxilio,
      precio_referencial: service.precio_referencial,
      disponible: service.disponible,
    });
    this.serviceForm.markAsPristine();
  }

  private resetServiceForm(): void {
    this.serviceForm.reset({
      id_tipo_auxilio: this.auxilioCatalog()[0]?.id_tipo_auxilio ?? null,
      precio_referencial: 0,
      disponible: true,
    });
    this.serviceForm.markAsPristine();
  }

  private buildUpdatePayload(
    service: ServicioAuxilioTaller
  ): ActualizarServicioAuxilioRequest {
    const rawValue = this.serviceForm.getRawValue();
    const payload: ActualizarServicioAuxilioRequest = {};

    if (Number(rawValue.precio_referencial) !== service.precio_referencial) {
      payload.precio_referencial = Number(rawValue.precio_referencial);
    }

    if (rawValue.disponible !== service.disponible) {
      payload.disponible = rawValue.disponible;
    }

    return payload;
  }

  private upsertService(service: ServicioAuxilioTaller): void {
    this.services.update((current) => {
      const exists = current.some(
        (item) => item.id_taller_auxilio === service.id_taller_auxilio
      );
      const next = exists
        ? current.map((item) =>
            item.id_taller_auxilio === service.id_taller_auxilio ? service : item
          )
        : [service, ...current];

      return this.sortServices(next);
    });
  }

  private sortServices(services: ServicioAuxilioTaller[]): ServicioAuxilioTaller[] {
    return [...services].sort(
      (left, right) => right.id_taller_auxilio - left.id_taller_auxilio
    );
  }

  private normalizeIds(ids: number[]): number[] {
    return [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))].sort(
      (left, right) => left - right
    );
  }

  private handleServicesError(error: unknown, fallbackMessage: string): void {
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
      this.servicesError.set(
        'No tienes permisos para gestionar servicios de auxilio.'
      );
      return;
    }

    if (
      httpError?.status === 400 ||
      httpError?.status === 404 ||
      httpError?.status === 422
    ) {
      this.servicesError.set(httpError.error?.detail ?? fallbackMessage);
      return;
    }

    this.servicesError.set(
      'No se pudo completar la solicitud de servicios. Verifica tu conexion e intenta nuevamente.'
    );
  }

  private handleCoverageError(error: unknown, fallbackMessage: string): void {
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
      this.coverageError.set(
        'No tienes permisos para configurar tipos de vehiculo.'
      );
      return;
    }

    if (
      httpError?.status === 400 ||
      httpError?.status === 404 ||
      httpError?.status === 422
    ) {
      this.coverageError.set(httpError.error?.detail ?? fallbackMessage);
      return;
    }

    this.coverageError.set(
      'No se pudo completar la solicitud de cobertura. Verifica tu conexion e intenta nuevamente.'
    );
  }
}
