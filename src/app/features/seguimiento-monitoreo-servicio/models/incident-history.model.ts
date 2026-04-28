export interface IncidenteHistorialListItem {
  id_incidente: number;
  titulo: string;
  fecha_reporte: string;
  tipo_incidente: string;
  id_estado_servicio_actual: number;
  estado_servicio_actual: string;
}

export interface HistorialIncidenteEvento {
  fecha_hora: string;
  tipo_evento: string;
  actor?: string | null;
  detalle?: string | null;
  estado_anterior?: string | null;
  estado_nuevo?: string | null;
  estado_solicitud?: string | null;
  id_taller?: number | null;
  nombre_taller?: string | null;
  id_tecnico?: number | null;
  nombre_tecnico?: string | null;
  id_unidad_movil?: number | null;
  placa_unidad_movil?: string | null;
}

export interface IncidenteHistorialDetail {
  id_incidente: number;
  titulo: string;
  fecha_reporte: string;
  tipo_incidente: string;
  prioridad: string;
  id_estado_servicio_actual: number;
  estado_servicio_actual: string;
  descripcion_texto?: string | null;
  direccion_referencia?: string | null;
  latitud?: number | string | null;
  longitud?: number | string | null;
  historial: HistorialIncidenteEvento[];
  mensaje?: string | null;
}
