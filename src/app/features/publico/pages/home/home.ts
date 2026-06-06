import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  readonly roleCards = [
    {
      title: 'Taller',
      description:
        'Gestiona solicitudes disponibles, cobertura, tecnicos y unidades moviles desde el panel operativo.',
      icon: 'T',
    },
    {
      title: 'Administrador',
      description:
        'Supervisa roles, bitacora, metricas e indicadores financieros de la plataforma.',
      icon: 'A',
    },
  ];

  readonly services = [
    'Gestion de disponibilidad, cobertura y horarios del taller',
    'Administracion de tecnicos, especialidades y unidades moviles',
    'Seguimiento del historial operativo de incidentes',
    'Supervision administrativa de roles, bitacora, metricas y comisiones',
  ];

  readonly steps = [
    'El taller registra su operacion y configura cobertura, personal y unidades.',
    'El equipo operativo ingresa al panel para revisar solicitudes y seguimiento.',
    'La plataforma centraliza historial, estados y control del servicio.',
    'Administracion supervisa accesos, auditoria, metricas y comisiones.',
  ];
}
