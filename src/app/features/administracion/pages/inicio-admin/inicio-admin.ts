import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-inicio-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inicio-admin.html',
  styleUrl: './inicio-admin.scss',
})
export class InicioAdmin {
  readonly cards = [
    {
      title: 'Autenticacion y Seguridad',
      description: 'Supervisa roles, accesos y bitacora del sistema.',
    },
    {
      title: 'Seguimiento y Monitoreo',
      description: 'Consulta historial del incidente y trazabilidad operativa.',
    },
    {
      title: 'Inteligencia Estrategica',
      description: 'Revisa metricas de incidentes y comisiones de la plataforma.',
    },
    {
      title: 'Acceso rapido',
      description: 'Entra a roles, bitacora, historial, metricas y comisiones desde el menu.',
    },
  ];
}
