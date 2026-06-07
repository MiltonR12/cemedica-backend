import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsPhoneNumber,
} from 'class-validator';

export enum BloodType {
  A_POS = 'A+',
  A_NEG = 'A-',
  B_POS = 'B+',
  B_NEG = 'B-',
  O_POS = 'O+',
  O_NEG = 'O-',
  AB_POS = 'AB+',
  AB_NEG = 'AB-',
}

export class CreatePatientDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido es requerido' })
  lastName: string;

  @IsString()
  @IsNotEmpty({ message: 'El CI es requerido' })
  ci: string;

  @IsDateString({}, { message: 'Fecha de nacimiento inválida' })
  @IsNotEmpty()
  birthDate: string;

  @IsEnum(['M', 'F', 'O'], { message: 'Género inválido' })
  @IsNotEmpty()
  gender: string;

  @IsString()
  @IsNotEmpty({ message: 'El teléfono es requerido' })
  phone: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsEnum(BloodType, { message: 'Tipo de sangre inválido' })
  @IsOptional()
  bloodType?: string;

  @IsString()
  @IsOptional()
  allergies?: string;

  @IsString()
  @IsOptional()
  medicalHistory?: string;
}
