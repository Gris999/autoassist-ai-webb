export interface PlatformCommissionListItem {
  id_comision: number;
  id_pago_servicio: number;
  id_incidente: number;
  titulo_incidente: string;
  id_taller: number;
  nombre_taller: string;
  monto_total_pago: number;
  porcentaje: number;
  monto_comision: number;
  estado: string;
  estado_pago: string;
  fecha_pago: string | null;
  fecha_calculo: string;
  referencia_transaccion: string | null;
}

export interface PlatformCommissionPaymentDetail {
  id_detalle_pago: number;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  id_taller_auxilio: number | null;
  tipo_auxilio: string | null;
}

export interface PlatformCommissionDetail extends PlatformCommissionListItem {
  metodo_pago: string | null;
  detalles_pago: PlatformCommissionPaymentDetail[];
}

export interface PlatformCommissionFilters {
  id_taller?: number | null;
  estado?: string | null;
  id_pago_servicio?: number | null;
  id_incidente?: number | null;
}

export interface GeneratePlatformCommissionsRequest {
  id_pago_servicio?: number | null;
  recalcular: boolean;
}

export interface GeneratedPlatformCommission {
  id_comision: number;
  id_pago_servicio: number;
  id_incidente: number;
  id_taller: number;
  porcentaje: number;
  monto_comision: number;
  estado: string;
  creada: boolean;
  recalculada: boolean;
}

export interface GeneratePlatformCommissionsResponse {
  total_procesadas: number;
  comisiones: GeneratedPlatformCommission[];
  mensaje: string | null;
}
