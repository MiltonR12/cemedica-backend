import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

interface CaptchaStore {
  answer: number;
  expiresAt: number;
}

@Injectable()
export class AuthService {
  // In-memory CAPTCHA store (token -> answer+expiry)
  private captchaStore = new Map<string, CaptchaStore>();

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  /** Generate a simple math CAPTCHA and return a signed token */
  generateCaptcha(): { token: string; question: string } {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    const answer = a + b;
    const token = crypto.randomBytes(16).toString('hex');
    // Store for 5 minutes
    this.captchaStore.set(token, { answer, expiresAt: Date.now() + 5 * 60 * 1000 });
    return { token, question: `¿Cuánto es ${a} + ${b}?` };
  }

  private verifyCaptcha(token: string, answer: string): boolean {
    const entry = this.captchaStore.get(token);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.captchaStore.delete(token);
      return false;
    }
    const isValid = parseInt(answer, 10) === entry.answer;
    // One-time use
    this.captchaStore.delete(token);
    return isValid;
  }

  async login(dto: LoginDto, ip: string, userAgent: string) {
    // Verify CAPTCHA first
    if (!this.verifyCaptcha(dto.captchaToken, dto.captchaAnswer)) {
      throw new BadRequestException('Respuesta CAPTCHA incorrecta o expirada');
    }

    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      await this.logAccess(null, ip, userAgent, 'LOGIN_FAILED', `Email no encontrado: ${dto.email}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      await this.logAccess(user.id, ip, userAgent, 'LOGIN_FAILED', 'Contraseña incorrecta');
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    await this.logAccess(user.id, ip, userAgent, 'LOGIN_SUCCESS', null);

    return {
      accessToken: token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  async logout(userId: number, ip: string, userAgent: string) {
    await this.logAccess(userId, ip, userAgent, 'LOGOUT', null);
    return { message: 'Sesión cerrada exitosamente' };
  }

  private async logAccess(
    userId: number | null,
    ip: string,
    userAgent: string,
    event: string,
    detail: string | null,
  ) {
    try {
      await this.prisma.accessLog.create({
        data: { userId, ip, userAgent, event, detail },
      });
    } catch {
      // Don't let logging failures break the auth flow
    }
  }
}
