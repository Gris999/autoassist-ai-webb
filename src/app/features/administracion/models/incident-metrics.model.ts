export interface IncidentMetricSummary {
  id_incidente: number;
  titulo: string;
  fecha_reporte: string;
  estado_actual: string;
  tiempo_respuesta_seg: number | null;
  incidentes_atendidos: number;
  estado_frecuente: string;
  rendimiento_operativo: 'alto' | 'medio' | 'bajo' | 'sin_datos' | string;
  fecha_generacion: string;
}

export interface IncidentMetricDetail extends IncidentMetricSummary {
  clasificacion_ia?: string | null;
  prioridad?: string | null;
  tipo_incidente?: string | null;
  tiempo_asignacion_seg?: number | null;
  tiempo_llegada_seg?: number | null;
  tiempo_resolucion_seg?: number | null;
  cantidad_rechazos?: number | null;
  fue_reasignado?: boolean | null;
}
