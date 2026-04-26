import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  ActualizarRolesRequest,
  ActualizarRolesResponse,
  BitacoraFiltros,
  BitacoraResponse,
  RolResponse,
  UsuarioRolResponse,
} from '../models/role-management.model';

@Injectable({
  providedIn: 'root',
})
export class RoleManagementService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getRoles(): Observable<RolResponse[]> {
    return this.http.get<RolResponse[]>(`${this.apiUrl}/auth/roles`);
  }

  getUsuariosConRoles(): Observable<UsuarioRolResponse[]> {
    return this.http.get<UsuarioRolResponse[]>(
      `${this.apiUrl}/auth/usuarios-roles`
    );
  }

  actualizarRolesUsuario(
    idUsuario: number,
    roles: string[]
  ): Observable<ActualizarRolesResponse> {
    const payload: ActualizarRolesRequest = { roles };

    return this.http.patch<ActualizarRolesResponse>(
      `${this.apiUrl}/auth/usuarios/${idUsuario}/roles`,
      payload
    );
  }

  getBitacora(filtros: BitacoraFiltros = {}): Observable<BitacoraResponse[]> {
    let params = new HttpParams();

    if (filtros.fecha_inicio) {
      params = params.set('fecha_inicio', filtros.fecha_inicio);
    }

    if (filtros.fecha_fin) {
      params = params.set('fecha_fin', filtros.fecha_fin);
    }

    if (typeof filtros.id_usuario === 'number') {
      params = params.set('id_usuario', filtros.id_usuario);
    }

    if (filtros.modulo) {
      params = params.set('modulo', filtros.modulo);
    }

    if (filtros.accion) {
      params = params.set('accion', filtros.accion);
    }

    return this.http.get<BitacoraResponse[]>(`${this.apiUrl}/auth/bitacora`, {
      params,
    });
  }

  getDetalleBitacora(idBitacora: number): Observable<BitacoraResponse> {
    return this.http.get<BitacoraResponse>(
      `${this.apiUrl}/auth/bitacora/${idBitacora}`
    );
  }
}
