export interface ServicioAuxilioTaller {
  id_taller_auxilio: number;
  id_taller: number;
  id_tipo_auxilio: number;
  nombre_tipo_auxilio: string;
  descripcion_tipo_auxilio?: string | null;
  precio_referencial: number;
  disponible: boolean;
}

export interface CrearServicioAuxilioRequest {
  id_tipo_auxilio: number;
  precio_referencial: number;
  disponible: boolean;
}

export interface ActualizarServicioAuxilioRequest {
  precio_referencial?: number;
  disponible?: boolean;
}

export interface TipoVehiculo {
  id_tipo_vehiculo: number;
  nombre: string;
  descripcion?: string | null;
}

export interface TiposVehiculoConfiguracionResponse {
  id_taller: number;
  tipos_vehiculo: TipoVehiculo[];
}

export interface ActualizarTiposVehiculoRequest {
  ids_tipo_vehiculo: number[];
}

export interface TipoAuxilioCatalogo {
  id_tipo_auxilio: number;
  nombre: string;
  descripcion?: string | null;
  requiere_unidad_movil: boolean;
  requiere_remolque: boolean;
}
