export interface IncidenteDisponible {
  id_solicitud_taller?: number | null;
  id_incidente: number;
  id_taller?: number | null;
  distancia_km?: number | null;
  puntaje_asignacion?: number | null;
  estado_solicitud?: string | null;
  fecha_envio?: string | null;
  fecha_respuesta?: string | null;
  titulo: string;
  descripcion_texto?: string | null;
  direccion_referencia?: string | null;
  latitud?: string | number | null;
  longitud?: string | number | null;
  fecha_reporte: string;
  id_vehiculo: number;
  id_tipo_incidente: number;
  tipo_incidente: string;
  id_prioridad: number;
  prioridad: string;
  id_estado_servicio_actual: number;
  estado_servicio_actual: string;
  requiere_mas_info?: boolean | null;
  clasificacion_ia?: string | null;
  auxilio_sugerido?: string | null;
  confianza_clasificacion?: number | null;
  resumen_ia?: string | null;
}

export interface SolicitudAtencionDetalle {
  id_solicitud_taller: number;
  id_incidente: number;
  id_taller: number;
  distancia_km: number | null;
  puntaje_asignacion: number | null;
  estado_solicitud: string;
  fecha_envio: string;
  fecha_respuesta: string | null;
  titulo_incidente: string;
  descripcion_texto?: string | null;
  direccion_referencia?: string | null;
  latitud?: string | number | null;
  longitud?: string | number | null;
  fecha_reporte: string;
  id_tipo_incidente: number;
  tipo_incidente: string;
  id_prioridad: number;
  prioridad: string;
  id_estado_servicio_actual: number;
  estado_servicio_actual: string;
  requiere_mas_info?: boolean | null;
  clasificacion_ia?: string | null;
  auxilio_sugerido?: string | null;
  confianza_clasificacion?: number | null;
  resumen_ia?: string | null;
}

export interface ResponderSolicitudRequest {
  accion: 'aceptar' | 'rechazar';
}

export interface ResponderSolicitudResponse {
  id_solicitud_taller: number;
  id_incidente: number;
  id_taller: number;
  accion: 'aceptar' | 'rechazar';
  estado_solicitud: string;
  fecha_respuesta: string;
  id_estado_servicio_actual: number;
  estado_servicio_actual: string;
}

export interface TecnicoDisponible {
  id_tecnico: number;
  id_usuario: number;
  nombres: string;
  apellidos: string;
  telefono_contacto?: string | null;
  disponible: boolean;
  estado: boolean;
}

export interface UnidadMovilDisponible {
  id_unidad_movil: number;
  id_taller: number;
  placa: string;
  tipo_unidad: string;
  disponible: boolean;
  estado: boolean;
}

export interface AsignarRecursosRequest {
  id_tecnico: number;
  id_unidad_movil: number;
  tiempo_estimado_min?: number | null;
  observaciones?: string | null;
}

export interface AsignacionServicioResponse {
  id_asignacion: number;
  id_incidente: number;
  id_taller: number;
  id_tecnico: number;
  id_unidad_movil: number | null;
  fecha_asignacion: string;
  tiempo_estimado_min: number | null;
  estado_asignacion: string;
  observaciones?: string | null;
  id_estado_servicio_actual: number;
  estado_servicio_actual: string;
}

export interface EstadoIncidenteTallerResponse {
  id_incidente: number;
  id_taller: number;
  id_estado_servicio_actual: number;
  estado_servicio_actual: string;
  orden_flujo_actual: number;
  estado_asignacion: string | null;
}

export interface ActualizarEstadoIncidenteRequest {
  id_estado_servicio: number;
  detalle?: string | null;
}

export interface ActualizarEstadoIncidenteResponse {
  id_incidente: number;
  id_taller: number;
  id_estado_anterior: number;
  estado_anterior: string;
  id_estado_nuevo: number;
  estado_nuevo: string;
  fecha_hora: string;
  detalle?: string | null;
}
