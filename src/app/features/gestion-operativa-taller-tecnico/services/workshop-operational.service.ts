import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  ActualizarDisponibilidadTecnicoRequest,
  ActualizarTecnicoRequest,
  CambiarEstadoTecnicoResponse,
  CrearTecnicoRequest,
  DisponibilidadTecnicoResponse,
  Especialidad,
  EspecialidadesRequest,
  EspecialidadesTecnicoResponse,
  TecnicoDetalle,
  TecnicoResumen,
} from '../models/technician-management.model';
import {
  ActualizarDisponibilidadUnidadMovilRequest,
  ActualizarUnidadMovilRequest,
  CrearUnidadMovilRequest,
  UnidadMovil,
} from '../models/mobile-unit-management.model';
import {
  ActualizarServicioAuxilioRequest,
  ActualizarTiposVehiculoRequest,
  CrearServicioAuxilioRequest,
  ServicioAuxilioTaller,
  TipoAuxilioCatalogo,
  TipoVehiculo,
  TiposVehiculoConfiguracionResponse,
} from '../models/service-coverage-management.model';
import {
  UpdateWorkshopAvailabilityRequest,
  WorkshopAvailability,
} from '../models/workshop-availability.model';

@Injectable({
  providedIn: 'root',
})
export class WorkshopOperationalService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getAvailability(): Observable<WorkshopAvailability> {
    return this.http.get<WorkshopAvailability>(
      `${this.apiUrl}/operativo/taller/disponibilidad`
    );
  }

  updateAvailability(
    payload: UpdateWorkshopAvailabilityRequest
  ): Observable<WorkshopAvailability> {
    return this.http.put<WorkshopAvailability>(
      `${this.apiUrl}/operativo/taller/disponibilidad`,
      payload
    );
  }

  getTiposVehiculoCatalogo(): Observable<TipoVehiculo[]> {
    return this.http.get<TipoVehiculo[]>(
      `${this.apiUrl}/operativo/taller/tipos-vehiculo`
    );
  }

  getTiposVehiculoConfigurados(): Observable<TiposVehiculoConfiguracionResponse> {
    return this.http.get<TiposVehiculoConfiguracionResponse>(
      `${this.apiUrl}/operativo/taller/configuracion/tipos-vehiculo`
    );
  }

  actualizarTiposVehiculoConfigurados(
    idsTipoVehiculo: number[]
  ): Observable<TiposVehiculoConfiguracionResponse> {
    const payload: ActualizarTiposVehiculoRequest = {
      ids_tipo_vehiculo: idsTipoVehiculo,
    };

    return this.http.put<TiposVehiculoConfiguracionResponse>(
      `${this.apiUrl}/operativo/taller/configuracion/tipos-vehiculo`,
      payload
    );
  }

  getTechnicianAvailability(): Observable<DisponibilidadTecnicoResponse> {
    return this.http.get<DisponibilidadTecnicoResponse>(
      `${this.apiUrl}/operativo/taller/tecnico/disponibilidad`
    );
  }

  updateTechnicianAvailability(
    payload: ActualizarDisponibilidadTecnicoRequest
  ): Observable<DisponibilidadTecnicoResponse> {
    return this.http.put<DisponibilidadTecnicoResponse>(
      `${this.apiUrl}/operativo/taller/tecnico/disponibilidad`,
      payload
    );
  }

  getServiciosAuxilioTaller(): Observable<ServicioAuxilioTaller[]> {
    return this.http.get<ServicioAuxilioTaller[]>(
      `${this.apiUrl}/operativo/taller/servicios-auxilio`
    );
  }

  getTiposAuxilioCatalogo(): Observable<TipoAuxilioCatalogo[]> {
    return this.http.get<TipoAuxilioCatalogo[]>(
      `${this.apiUrl}/operativo/taller/tipos-auxilio`
    );
  }

  registrarServicioAuxilio(
    payload: CrearServicioAuxilioRequest
  ): Observable<ServicioAuxilioTaller> {
    return this.http.post<ServicioAuxilioTaller>(
      `${this.apiUrl}/operativo/taller/servicios-auxilio`,
      payload
    );
  }

  actualizarServicioAuxilio(
    idTallerAuxilio: number,
    payload: ActualizarServicioAuxilioRequest
  ): Observable<ServicioAuxilioTaller> {
    return this.http.put<ServicioAuxilioTaller>(
      `${this.apiUrl}/operativo/taller/servicios-auxilio/${idTallerAuxilio}`,
      payload
    );
  }

  deshabilitarServicioAuxilio(
    idTallerAuxilio: number
  ): Observable<ServicioAuxilioTaller> {
    return this.http.patch<ServicioAuxilioTaller>(
      `${this.apiUrl}/operativo/taller/servicios-auxilio/${idTallerAuxilio}/deshabilitar`,
      {}
    );
  }

  getTecnicos(): Observable<TecnicoResumen[]> {
    return this.http.get<TecnicoResumen[]>(
      `${this.apiUrl}/operativo/taller/tecnicos`
    );
  }

  getTecnicoDetalle(idTecnico: number): Observable<TecnicoDetalle> {
    return this.http.get<TecnicoDetalle>(
      `${this.apiUrl}/operativo/taller/tecnicos/${idTecnico}`
    );
  }

  registrarTecnico(payload: CrearTecnicoRequest): Observable<TecnicoDetalle> {
    return this.http.post<TecnicoDetalle>(
      `${this.apiUrl}/operativo/taller/tecnicos`,
      payload
    );
  }

  actualizarTecnico(
    idTecnico: number,
    payload: ActualizarTecnicoRequest
  ): Observable<TecnicoDetalle> {
    return this.http.put<TecnicoDetalle>(
      `${this.apiUrl}/operativo/taller/tecnicos/${idTecnico}`,
      payload
    );
  }

  habilitarTecnico(idTecnico: number): Observable<CambiarEstadoTecnicoResponse> {
    return this.http.patch<CambiarEstadoTecnicoResponse>(
      `${this.apiUrl}/operativo/taller/tecnicos/${idTecnico}/habilitar`,
      {}
    );
  }

  deshabilitarTecnico(idTecnico: number): Observable<CambiarEstadoTecnicoResponse> {
    return this.http.patch<CambiarEstadoTecnicoResponse>(
      `${this.apiUrl}/operativo/taller/tecnicos/${idTecnico}/deshabilitar`,
      {}
    );
  }

  getCatalogoEspecialidades(): Observable<Especialidad[]> {
    return this.http.get<Especialidad[]>(
      `${this.apiUrl}/operativo/taller/especialidades`
    );
  }

  getEspecialidadesTecnico(
    idTecnico: number
  ): Observable<EspecialidadesTecnicoResponse> {
    return this.http.get<EspecialidadesTecnicoResponse>(
      `${this.apiUrl}/operativo/taller/tecnicos/${idTecnico}/especialidades`
    );
  }

  asignarEspecialidadesTecnico(
    idTecnico: number,
    idsEspecialidad: number[]
  ): Observable<EspecialidadesTecnicoResponse> {
    const payload: EspecialidadesRequest = {
      ids_especialidad: idsEspecialidad,
    };

    return this.http.post<EspecialidadesTecnicoResponse>(
      `${this.apiUrl}/operativo/taller/tecnicos/${idTecnico}/especialidades`,
      payload
    );
  }

  reemplazarEspecialidadesTecnico(
    idTecnico: number,
    idsEspecialidad: number[]
  ): Observable<EspecialidadesTecnicoResponse> {
    const payload: EspecialidadesRequest = {
      ids_especialidad: idsEspecialidad,
    };

    return this.http.put<EspecialidadesTecnicoResponse>(
      `${this.apiUrl}/operativo/taller/tecnicos/${idTecnico}/especialidades`,
      payload
    );
  }

  quitarEspecialidadTecnico(
    idTecnico: number,
    idEspecialidad: number
  ): Observable<EspecialidadesTecnicoResponse> {
    return this.http.delete<EspecialidadesTecnicoResponse>(
      `${this.apiUrl}/operativo/taller/tecnicos/${idTecnico}/especialidades/${idEspecialidad}`
    );
  }

  getUnidadesMoviles(): Observable<UnidadMovil[]> {
    return this.http.get<UnidadMovil[]>(
      `${this.apiUrl}/operativo/taller/unidades-moviles`
    );
  }

  getUnidadMovilDetalle(idUnidadMovil: number): Observable<UnidadMovil> {
    return this.http.get<UnidadMovil>(
      `${this.apiUrl}/operativo/taller/unidades-moviles/${idUnidadMovil}`
    );
  }

  registrarUnidadMovil(payload: CrearUnidadMovilRequest): Observable<UnidadMovil> {
    return this.http.post<UnidadMovil>(
      `${this.apiUrl}/operativo/taller/unidades-moviles`,
      payload
    );
  }

  actualizarUnidadMovil(
    idUnidadMovil: number,
    payload: ActualizarUnidadMovilRequest
  ): Observable<UnidadMovil> {
    return this.http.put<UnidadMovil>(
      `${this.apiUrl}/operativo/taller/unidades-moviles/${idUnidadMovil}`,
      payload
    );
  }

  actualizarDisponibilidadUnidadMovil(
    idUnidadMovil: number,
    payload: ActualizarDisponibilidadUnidadMovilRequest
  ): Observable<UnidadMovil> {
    return this.http.patch<UnidadMovil>(
      `${this.apiUrl}/operativo/taller/unidades-moviles/${idUnidadMovil}/disponibilidad`,
      payload
    );
  }
}
