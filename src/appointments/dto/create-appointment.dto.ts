import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  IsEnum,
} from 'class-validator';

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export class CreateAppointmentDto {
  @IsInt()
  @IsNotEmpty()
  patientId: number;

  @IsInt()
  @IsNotEmpty()
  doctorId: number;

  @IsDateString({}, { message: 'Fecha/hora de cita inválida' })
  @IsNotEmpty()
  scheduledAt: string;

  @IsString()
  @IsNotEmpty({ message: 'El motivo de consulta es requerido' })
  reason: string;

  @IsEnum(AppointmentStatus, { message: 'Estado inválido' })
  @IsOptional()
  status?: AppointmentStatus;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  diagnosis?: string;

  @IsString()
  @IsOptional()
  prescription?: string;
}
