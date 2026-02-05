export interface Round {
  id: string;
  location: string;
  status: RoundStatus;
  time: string;
  date?: string;
  completedTime?: string;
}

export const RoundStatus = {
  COMPLETED: 'Completado',
  PENDING: 'Pendiente',
  SCHEDULED: 'Programado'
} as const;

export type RoundStatus = (typeof RoundStatus)[keyof typeof RoundStatus];

export interface LogEntry {
  id: string;
  timestamp: string;
  date?: string;
  type: 'INCIDENCIA' | 'NOTIFICACION' | 'OBSERVACION';
  description: string;
  author: string;
}

export interface UserProfile {
  id_guardia: any;
  name: string;
  nombre?: string;
  apellido?: string;
  role: string;
  avatar: string;
  startTime: string;
  isActive: boolean;
  rut: string;
  correo: string;
  telefono: string;
}