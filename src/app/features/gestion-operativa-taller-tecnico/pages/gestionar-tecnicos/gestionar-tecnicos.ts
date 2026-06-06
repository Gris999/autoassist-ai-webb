import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, finalize, forkJoin, map, of, startWith, switchMap } from 'rxjs';

import { TokenService } from '../../../../core/services/token.service';
import {
  ActualizarTecnicoRequest,
  CrearTecnicoRequest,
  Especialidad,
  EspecialidadesTecnicoResponse,
  TecnicoDetalle,
  TecnicoResumen,
} from '../../models/technician-management.model';
import { WorkshopOperationalService } from '../../services/workshop-operational.service';

type EstadoFilter = 'todos' | 'activos' | 'deshabilitados';
type DisponibilidadFilter = 'todos' | 'disponibles' | 'no_disponibles';
type TechnicianEditorMode = 'create' | 'edit' | 'view';

@Component({
  selector: 'app-gestionar-tecnicos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './gestionar-tecnicos.html',
  styleUrl: './gestionar-tecnicos.scss',
})
export class GestionarTecnicos implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly workshopOperationalService = inject(WorkshopOperationalService);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly selectionLoading = signal(false);
  readonly savingTechnician = signal(false);
  readonly statusSavingId = signal<number | null>(null);
  readonly availabilitySavingId = signal<number | null>(null);
  readonly specialtiesLoading = signal(false);
  readonly specialtiesSaving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly specialtiesError = signal('');
  readonly specialtiesSuccess = signal('');
  readonly editorMode = signal<TechnicianEditorMode>('create');
  readonly technicians = signal<TecnicoResumen[]>([]);
  readonly specialtiesCatalog = signal<Especialidad[]>([]);
  readonly specialtiesByTechnician = signal<Record<number, Especialidad[]>>({});
  readonly selectedTechnicianId = signal<number | null>(null);
  readonly selectedTechnicianDetail = signal<TecnicoDetalle | null>(null);

  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    estado: ['todos' as EstadoFilter],
    disponibilidad: ['todos' as DisponibilidadFilter],
    especialidad: ['todas'],
  });

  readonly technicianForm = this.fb.nonNullable.group({
    nombres: ['', [Validators.required, Validators.minLength(2)]],
    apellidos: ['', [Validators.required, Validators.minLength(2)]],
    celular: ['', [Validators.required, Validators.minLength(7)]],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    telefono_contacto: ['', [Validators.required, Validators.minLength(7)]],
    disponible: [true],
    estado: [true],
  });

  readonly specialtiesForm = this.fb.nonNullable.group({
    ids_especialidad: this.fb.nonNullable.control<number[]>([]),
  });

  private readonly filterValue = toSignal(
    this.filtersForm.valueChanges.pipe(startWith(this.filtersForm.getRawValue())),
    { initialValue: this.filtersForm.getRawValue() },
  );

  private readonly specialtySelectionValue = toSignal(
    this.specialtiesForm.controls.ids_especialidad.valueChanges.pipe(
      startWith(this.specialtiesForm.controls.ids_especialidad.getRawValue()),
    ),
    { initialValue: this.specialtiesForm.controls.ids_especialidad.getRawValue() },
  );

  readonly selectedTechnician = computed(() => {
    const selectedId = this.selectedTechnicianId();
    return this.technicians().find((technician) => technician.id_tecnico === selectedId) ?? null;
  });

  readonly selectedTechnicianSpecialties = computed(() => {
    const selectedId = this.selectedTechnicianId();
    if (!selectedId) {
      return [];
    }

    return this.specialtiesByTechnician()[selectedId] ?? [];
  });

  readonly filteredTechnicians = computed(() => {
    const filters = this.filterValue();
    const search = (filters.search ?? '').trim().toLowerCase();
    const selectedSpecialtyId =
      filters.especialidad !== 'todas' ? Number(filters.especialidad) : null;

    return this.technicians().filter((technician) => {
      if (filters.estado === 'activos' && !technician.estado) {
        return false;
      }

      if (filters.estado === 'deshabilitados' && technician.estado) {
        return false;
      }

      if (filters.disponibilidad === 'disponibles' && !technician.disponible) {
        return false;
      }

      if (filters.disponibilidad === 'no_disponibles' && technician.disponible) {
        return false;
      }

      if (selectedSpecialtyId !== null) {
        const specialties = this.specialtiesByTechnician()[technician.id_tecnico] ?? [];
        if (!specialties.some((specialty) => specialty.id_especialidad === selectedSpecialtyId)) {
          return false;
        }
      }

      if (!search) {
        return true;
      }

      const haystack = [
        technician.nombres,
        technician.apellidos,
        technician.email,
        technician.celular,
        technician.telefono_contacto,
        ...(this.specialtiesByTechnician()[technician.id_tecnico] ?? []).map(
          (specialty) => specialty.nombre,
        ),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });
  });

  readonly totalTechnicians = computed(() => this.technicians().length);
  readonly totalActive = computed(
    () => this.technicians().filter((technician) => technician.estado).length,
  );
  readonly totalAvailable = computed(
    () => this.technicians().filter((technician) => technician.disponible).length,
  );
  readonly totalDisabled = computed(
    () => this.technicians().filter((technician) => !technician.estado).length,
  );

  readonly isCreateMode = computed(() => this.editorMode() === 'create');
  readonly isEditMode = computed(() => this.editorMode() === 'edit');
  readonly isViewMode = computed(() => this.editorMode() === 'view');

  readonly hasTechnicianChanges = computed(() => {
    const detail = this.selectedTechnicianDetail();
    if (!detail || !this.isEditMode()) {
      return false;
    }

    return Object.keys(this.buildUpdatePayload(detail)).length > 0;
  });

  readonly hasSpecialtyChanges = computed(() => {
    const currentIds = this.normalizeIds(
      this.selectedTechnicianSpecialties().map((specialty) => specialty.id_especialidad),
    );
    const nextIds = this.normalizeIds(this.specialtySelectionValue());

    return (
      currentIds.length !== nextIds.length || currentIds.some((id, index) => id !== nextIds[index])
    );
  });

  ngOnInit(): void {
    this.configureTechnicianFormForMode('create');
    this.watchStateAvailabilityRule();
    this.loadTechnicianManagement();
  }

  loadTechnicianManagement(): void {
    const isInitialLoad = this.loading();
    const selectedId = this.selectedTechnicianId();
    const currentMode = this.editorMode();

    if (isInitialLoad) {
      this.loading.set(true);
    } else {
      this.refreshing.set(true);
    }

    this.errorMessage.set('');

    forkJoin({
      technicians: this.workshopOperationalService.getTecnicos(),
      catalog: this.workshopOperationalService.getCatalogoEspecialidades(),
    })
      .pipe(
        switchMap(({ technicians, catalog }) =>
          this.getSpecialtiesSnapshot(technicians).pipe(
            map((specialtiesByTechnician) => ({
              technicians,
              catalog,
              specialtiesByTechnician,
            })),
          ),
        ),
        finalize(() => {
          if (isInitialLoad) {
            this.loading.set(false);
          } else {
            this.refreshing.set(false);
          }
        }),
      )
      .subscribe({
        next: ({ technicians, catalog, specialtiesByTechnician }) => {
          this.technicians.set(this.sortTechnicians(technicians));
          this.specialtiesCatalog.set(catalog);
          this.specialtiesByTechnician.set(specialtiesByTechnician);

          const nextSelectedId =
            technicians.find((technician) => technician.id_tecnico === selectedId)?.id_tecnico ??
            technicians[0]?.id_tecnico ??
            null;

          if (!nextSelectedId) {
            this.startCreateMode();
            return;
          }

          if (currentMode === 'create' && selectedId === null) {
            this.selectTechnician(nextSelectedId, 'view', false);
            return;
          }

          this.selectTechnician(nextSelectedId, currentMode === 'edit' ? 'edit' : 'view', false);
        },
        error: (error) => {
          this.handleHttpError(error, 'No se pudo cargar la gestion de tecnicos del taller.');
        },
      });
  }

  startCreateMode(): void {
    this.editorMode.set('create');
    this.selectedTechnicianId.set(null);
    this.selectedTechnicianDetail.set(null);
    this.configureTechnicianFormForMode('create');
    this.specialtiesForm.controls.ids_especialidad.setValue([]);
    this.successMessage.set('');
    this.specialtiesError.set('');
    this.specialtiesSuccess.set('');
  }

  selectTechnician(
    idTecnico: number,
    mode: TechnicianEditorMode = 'view',
    forceSpecialtiesReload = true,
  ): void {
    this.selectedTechnicianId.set(idTecnico);
    this.selectionLoading.set(true);
    this.errorMessage.set('');
    this.specialtiesError.set('');

    const cachedSpecialties = this.specialtiesByTechnician()[idTecnico] ?? [];
    const specialtyRequest =
      forceSpecialtiesReload || cachedSpecialties.length === 0
        ? this.workshopOperationalService.getEspecialidadesTecnico(idTecnico)
        : of({
            id_tecnico: idTecnico,
            especialidades: cachedSpecialties,
          } satisfies EspecialidadesTecnicoResponse);

    forkJoin({
      detail: this.workshopOperationalService.getTecnicoDetalle(idTecnico),
      specialties: specialtyRequest,
    })
      .pipe(finalize(() => this.selectionLoading.set(false)))
      .subscribe({
        next: ({ detail, specialties }) => {
          this.selectedTechnicianDetail.set(detail);
          this.specialtiesByTechnician.update((current) => ({
            ...current,
            [idTecnico]: specialties.especialidades,
          }));
          this.specialtiesForm.controls.ids_especialidad.setValue(
            this.normalizeIds(
              specialties.especialidades.map((specialty) => specialty.id_especialidad),
            ),
          );

          if (mode === 'edit') {
            this.editorMode.set('edit');
            this.configureTechnicianFormForMode('edit');
            this.patchTechnicianForm(detail);
          } else {
            this.editorMode.set('view');
          }
        },
        error: (error) => {
          this.handleHttpError(error, 'No se pudo cargar el detalle del tecnico seleccionado.');
        },
      });
  }

  editTechnician(idTecnico: number): void {
    this.selectTechnician(idTecnico, 'edit');
  }

  cancelTechnicianEditor(): void {
    if (this.isEditMode() && this.selectedTechnicianId()) {
      this.selectTechnician(this.selectedTechnicianId()!, 'view', false);
      return;
    }

    this.resetTechnicianForm();
  }

  saveTechnician(): void {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (this.technicianForm.invalid) {
      this.technicianForm.markAllAsTouched();
      this.errorMessage.set('Revisa los datos del tecnico antes de guardar.');
      return;
    }

    const rawValue = this.technicianForm.getRawValue();

    if (!rawValue.estado && rawValue.disponible) {
      this.errorMessage.set('Un tecnico deshabilitado no puede quedar disponible.');
      return;
    }

    if (this.isCreateMode()) {
      this.saveNewTechnician(rawValue);
      return;
    }

    const detail = this.selectedTechnicianDetail();
    if (!detail) {
      this.errorMessage.set('Selecciona un tecnico valido antes de editar.');
      return;
    }

    const payload = this.buildUpdatePayload(detail);
    if (Object.keys(payload).length === 0) {
      this.errorMessage.set('No hay cambios para guardar.');
      return;
    }

    this.savingTechnician.set(true);

    this.workshopOperationalService
      .actualizarTecnico(detail.id_tecnico, payload)
      .pipe(finalize(() => this.savingTechnician.set(false)))
      .subscribe({
        next: (updatedTechnician) => {
          this.upsertTechnician(updatedTechnician);
          this.selectedTechnicianDetail.set(updatedTechnician);
          this.patchTechnicianForm(updatedTechnician);
          this.successMessage.set('Tecnico actualizado correctamente.');
        },
        error: (error) => {
          this.handleHttpError(error, 'No se pudo actualizar el tecnico seleccionado.');
        },
      });
  }

  changeTechnicianStatus(technician: TecnicoResumen, nextState: boolean): void {
    this.statusSavingId.set(technician.id_tecnico);
    this.errorMessage.set('');
    this.successMessage.set('');

    const request = nextState
      ? this.workshopOperationalService.habilitarTecnico(technician.id_tecnico)
      : this.workshopOperationalService.deshabilitarTecnico(technician.id_tecnico);

    request.pipe(finalize(() => this.statusSavingId.set(null))).subscribe({
      next: (response) => {
        this.technicians.update((current) =>
          this.sortTechnicians(
            current.map((item) =>
              item.id_tecnico === response.id_tecnico
                ? {
                    ...item,
                    estado: response.estado,
                    disponible: response.disponible,
                  }
                : item,
            ),
          ),
        );

        if (this.selectedTechnicianId() === response.id_tecnico) {
          const detail = this.selectedTechnicianDetail();
          if (detail) {
            const nextDetail = {
              ...detail,
              estado: response.estado,
              disponible: response.disponible,
            };
            this.selectedTechnicianDetail.set(nextDetail);
            if (this.isEditMode()) {
              this.patchTechnicianForm(nextDetail);
            }
          }
        }

        this.successMessage.set(
          response.estado
            ? 'Tecnico habilitado correctamente.'
            : 'Tecnico deshabilitado correctamente.',
        );
      },
      error: (error) => {
        this.handleHttpError(error, 'No se pudo actualizar el estado del tecnico.');
      },
    });
  }

  changeTechnicianAvailability(technician: TecnicoResumen, nextAvailability: boolean): void {
    if (!technician.estado && nextAvailability) {
      this.errorMessage.set('No puedes marcar disponible a un tecnico deshabilitado.');
      this.successMessage.set('');
      return;
    }

    if (technician.disponible === nextAvailability) {
      this.errorMessage.set('');
      this.successMessage.set(
        nextAvailability
          ? 'El tecnico ya estaba disponible.'
          : 'El tecnico ya estaba marcado como no disponible.',
      );
      return;
    }

    this.availabilitySavingId.set(technician.id_tecnico);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.workshopOperationalService
      .actualizarTecnico(technician.id_tecnico, {
        disponible: nextAvailability,
      })
      .pipe(finalize(() => this.availabilitySavingId.set(null)))
      .subscribe({
        next: (updatedTechnician) => {
          this.upsertTechnician(updatedTechnician);

          if (this.selectedTechnicianId() === updatedTechnician.id_tecnico) {
            this.selectedTechnicianDetail.set(updatedTechnician);
            if (this.isEditMode()) {
              this.patchTechnicianForm(updatedTechnician);
            }
          }

          this.successMessage.set(
            nextAvailability
              ? 'Tecnico marcado como disponible correctamente.'
              : 'Tecnico marcado como no disponible correctamente.',
          );
        },
        error: (error) => {
          this.handleHttpError(error, 'No se pudo actualizar la disponibilidad del tecnico.');
        },
      });
  }

  saveSpecialties(): void {
    const selectedTechnician = this.selectedTechnician();
    if (!selectedTechnician) {
      this.specialtiesError.set('Selecciona un tecnico antes de guardar especialidades.');
      return;
    }

    const idsEspecialidad = this.normalizeIds(
      this.specialtiesForm.controls.ids_especialidad.getRawValue(),
    );

    this.specialtiesSaving.set(true);
    this.specialtiesError.set('');
    this.specialtiesSuccess.set('');

    this.workshopOperationalService
      .reemplazarEspecialidadesTecnico(selectedTechnician.id_tecnico, idsEspecialidad)
      .pipe(finalize(() => this.specialtiesSaving.set(false)))
      .subscribe({
        next: (response) => {
          this.specialtiesByTechnician.update((current) => ({
            ...current,
            [response.id_tecnico]: response.especialidades,
          }));
          this.specialtiesForm.controls.ids_especialidad.setValue(
            this.normalizeIds(
              response.especialidades.map((specialty) => specialty.id_especialidad),
            ),
          );
          this.specialtiesSuccess.set('Especialidades actualizadas correctamente.');
        },
        error: (error) => {
          this.handleSpecialtiesError(
            error,
            'No se pudieron guardar las especialidades del tecnico.',
          );
        },
      });
  }

  removeSpecialty(idEspecialidad: number): void {
    const selectedTechnician = this.selectedTechnician();
    if (!selectedTechnician) {
      this.specialtiesError.set('Selecciona un tecnico antes de quitar una especialidad.');
      return;
    }

    this.specialtiesSaving.set(true);
    this.specialtiesError.set('');
    this.specialtiesSuccess.set('');

    this.workshopOperationalService
      .quitarEspecialidadTecnico(selectedTechnician.id_tecnico, idEspecialidad)
      .pipe(finalize(() => this.specialtiesSaving.set(false)))
      .subscribe({
        next: (response) => {
          this.specialtiesByTechnician.update((current) => ({
            ...current,
            [response.id_tecnico]: response.especialidades,
          }));
          this.specialtiesForm.controls.ids_especialidad.setValue(
            this.normalizeIds(
              response.especialidades.map((specialty) => specialty.id_especialidad),
            ),
          );
          this.specialtiesSuccess.set('Especialidad quitada correctamente.');
        },
        error: (error) => {
          this.handleSpecialtiesError(error, 'No se pudo quitar la especialidad seleccionada.');
        },
      });
  }

  reloadSelectedSpecialties(): void {
    const selectedTechnician = this.selectedTechnician();
    if (!selectedTechnician) {
      return;
    }

    this.specialtiesLoading.set(true);
    this.specialtiesError.set('');

    this.workshopOperationalService
      .getEspecialidadesTecnico(selectedTechnician.id_tecnico)
      .pipe(finalize(() => this.specialtiesLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.specialtiesByTechnician.update((current) => ({
            ...current,
            [response.id_tecnico]: response.especialidades,
          }));
          this.specialtiesForm.controls.ids_especialidad.setValue(
            this.normalizeIds(
              response.especialidades.map((specialty) => specialty.id_especialidad),
            ),
          );
        },
        error: (error) => {
          this.handleSpecialtiesError(
            error,
            'No se pudieron recargar las especialidades del tecnico.',
          );
        },
      });
  }

  toggleSpecialty(idEspecialidad: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const currentIds = this.normalizeIds(
      this.specialtiesForm.controls.ids_especialidad.getRawValue(),
    );

    const nextIds = checked
      ? this.normalizeIds([...currentIds, idEspecialidad])
      : currentIds.filter((id) => id !== idEspecialidad);

    this.specialtiesForm.controls.ids_especialidad.setValue(nextIds);
    this.specialtiesError.set('');
    this.specialtiesSuccess.set('');
  }

  isSpecialtySelected(idEspecialidad: number): boolean {
    return this.specialtySelectionValue().includes(idEspecialidad);
  }

  getFullName(technician: TecnicoResumen | TecnicoDetalle): string {
    return `${technician.nombres} ${technician.apellidos}`.trim();
  }

  getInitials(technician: TecnicoResumen | TecnicoDetalle): string {
    return `${technician.nombres.charAt(0)}${technician.apellidos.charAt(0)}`.trim().toUpperCase();
  }

  getAvailabilityBadgeClass(disponible: boolean, estado = true): string {
    if (!estado) {
      return 'status-pill status-pill--disabled';
    }

    return disponible
      ? 'status-pill status-pill--available'
      : 'status-pill status-pill--unavailable';
  }

  getAvailabilityLabel(disponible: boolean, estado = true): string {
    if (!estado) {
      return 'Deshabilitado';
    }

    return disponible ? 'Disponible' : 'No disponible';
  }

  getStateBadgeClass(estado: boolean): string {
    return estado ? 'status-pill status-pill--active' : 'status-pill status-pill--disabled';
  }

  getSpecialtiesPreview(technicianId: number): Especialidad[] {
    return this.specialtiesByTechnician()[technicianId] ?? [];
  }

  trackTechnician(_: number, technician: TecnicoResumen): number {
    return technician.id_tecnico;
  }

  trackSpecialty(_: number, specialty: Especialidad): number {
    return specialty.id_especialidad;
  }

  private saveNewTechnician(rawValue: ReturnType<typeof this.technicianForm.getRawValue>): void {
    const payload: CrearTecnicoRequest = {
      nombres: rawValue.nombres.trim(),
      apellidos: rawValue.apellidos.trim(),
      celular: rawValue.celular.trim(),
      email: rawValue.email.trim(),
      password: rawValue.password.trim(),
      telefono_contacto: rawValue.telefono_contacto.trim(),
      disponible: rawValue.estado ? rawValue.disponible : false,
      estado: rawValue.estado,
    };

    this.savingTechnician.set(true);

    this.workshopOperationalService
      .registrarTecnico(payload)
      .pipe(finalize(() => this.savingTechnician.set(false)))
      .subscribe({
        next: (createdTechnician) => {
          this.upsertTechnician(createdTechnician);
          this.specialtiesByTechnician.update((current) => ({
            ...current,
            [createdTechnician.id_tecnico]: [],
          }));
          this.selectedTechnicianId.set(createdTechnician.id_tecnico);
          this.selectedTechnicianDetail.set(createdTechnician);
          this.editorMode.set('view');
          this.specialtiesForm.controls.ids_especialidad.setValue([]);
          this.successMessage.set('Tecnico registrado correctamente.');
        },
        error: (error) => {
          this.handleHttpError(error, 'No se pudo registrar el tecnico.');
        },
      });
  }

  private upsertTechnician(technician: TecnicoDetalle): void {
    this.technicians.update((current) => {
      const summary: TecnicoResumen = {
        id_tecnico: technician.id_tecnico,
        id_usuario: technician.id_usuario,
        nombres: technician.nombres,
        apellidos: technician.apellidos,
        email: technician.email,
        celular: technician.celular,
        telefono_contacto: technician.telefono_contacto,
        disponible: technician.disponible,
        estado: technician.estado,
      };

      const exists = current.some((item) => item.id_tecnico === technician.id_tecnico);
      const next = exists
        ? current.map((item) => (item.id_tecnico === technician.id_tecnico ? summary : item))
        : [summary, ...current];

      return this.sortTechnicians(next);
    });
  }

  private patchTechnicianForm(detail: TecnicoDetalle): void {
    this.technicianForm.patchValue({
      nombres: detail.nombres,
      apellidos: detail.apellidos,
      celular: detail.celular,
      email: detail.email,
      password: '',
      telefono_contacto: detail.telefono_contacto,
      disponible: detail.disponible,
      estado: detail.estado,
    });
    this.technicianForm.markAsPristine();
  }

  private configureTechnicianFormForMode(mode: TechnicianEditorMode): void {
    this.editorMode.set(mode);

    if (mode === 'create') {
      this.technicianForm.controls.password.setValidators([
        Validators.required,
        Validators.minLength(8),
      ]);
      this.resetTechnicianForm();
      return;
    }

    this.technicianForm.controls.password.clearValidators();
    this.technicianForm.controls.password.setValue('');
    this.technicianForm.controls.password.updateValueAndValidity({
      emitEvent: false,
    });
  }

  private resetTechnicianForm(): void {
    this.technicianForm.reset({
      nombres: '',
      apellidos: '',
      celular: '',
      email: '',
      password: '',
      telefono_contacto: '',
      disponible: true,
      estado: true,
    });
    this.technicianForm.controls.password.updateValueAndValidity({
      emitEvent: false,
    });
    this.technicianForm.markAsPristine();
  }

  private buildUpdatePayload(detail: TecnicoDetalle): ActualizarTecnicoRequest {
    const rawValue = this.technicianForm.getRawValue();
    const payload: ActualizarTecnicoRequest = {};

    if (rawValue.nombres.trim() !== detail.nombres) {
      payload.nombres = rawValue.nombres.trim();
    }

    if (rawValue.apellidos.trim() !== detail.apellidos) {
      payload.apellidos = rawValue.apellidos.trim();
    }

    if (rawValue.celular.trim() !== detail.celular) {
      payload.celular = rawValue.celular.trim();
    }

    if (rawValue.email.trim() !== detail.email) {
      payload.email = rawValue.email.trim();
    }

    if (rawValue.telefono_contacto.trim() !== detail.telefono_contacto) {
      payload.telefono_contacto = rawValue.telefono_contacto.trim();
    }

    if (rawValue.disponible !== detail.disponible) {
      payload.disponible = rawValue.disponible;
    }

    return payload;
  }

  private sortTechnicians(technicians: TecnicoResumen[]): TecnicoResumen[] {
    return [...technicians].sort((left, right) => right.id_tecnico - left.id_tecnico);
  }

  private normalizeIds(ids: number[]): number[] {
    return [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))].sort(
      (left, right) => left - right,
    );
  }

  private getSpecialtiesSnapshot(technicians: TecnicoResumen[]) {
    if (technicians.length === 0) {
      return of({} as Record<number, Especialidad[]>);
    }

    return forkJoin(
      technicians.map((technician) =>
        this.workshopOperationalService.getEspecialidadesTecnico(technician.id_tecnico).pipe(
          map((response) => [technician.id_tecnico, response.especialidades] as const),
          catchError(() => of([technician.id_tecnico, []] as const)),
        ),
      ),
    ).pipe(
      map((entries) =>
        entries.reduce<Record<number, Especialidad[]>>((accumulator, entry) => {
          accumulator[entry[0]] = [...entry[1]];
          return accumulator;
        }, {}),
      ),
    );
  }

  private watchStateAvailabilityRule(): void {
    this.technicianForm.controls.estado.valueChanges.subscribe((estado) => {
      if (!estado && this.technicianForm.controls.disponible.value) {
        this.technicianForm.controls.disponible.setValue(false);
      }
    });
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
      this.errorMessage.set('No tienes permisos para gestionar tecnicos del taller.');
      return;
    }

    if (httpError?.status === 400 || httpError?.status === 404 || httpError?.status === 422) {
      this.errorMessage.set(httpError.error?.detail ?? fallbackMessage);
      return;
    }

    this.errorMessage.set(
      'No se pudo completar la solicitud. Verifica tu conexion e intenta nuevamente.',
    );
  }

  private handleSpecialtiesError(error: unknown, fallbackMessage: string): void {
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
      this.specialtiesError.set('No tienes permisos para gestionar especialidades.');
      return;
    }

    if (httpError?.status === 400 || httpError?.status === 404 || httpError?.status === 422) {
      this.specialtiesError.set(httpError.error?.detail ?? fallbackMessage);
      return;
    }

    this.specialtiesError.set(
      'No se pudo completar la solicitud de especialidades. Intenta nuevamente.',
    );
  }
}
