import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'El token CAPTCHA es requerido' })
  captchaToken: string;

  @IsString()
  @IsNotEmpty({ message: 'La respuesta del CAPTCHA es requerida' })
  captchaAnswer: string;
}
