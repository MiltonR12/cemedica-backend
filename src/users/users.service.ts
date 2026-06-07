import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';

export type PasswordStrength = 'weak' | 'medium' | 'strong';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Evaluates password strength:
   * - weak: < 8 chars or only letters/numbers
   * - medium: >= 8 chars with letters + numbers
   * - strong: >= 10 chars with uppercase, lowercase, numbers, and special chars
   */
  evaluatePasswordStrength(password: string): PasswordStrength {
    if (password.length < 6) return 'weak';
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (password.length >= 10 && hasUpper && hasLower && hasNumber && hasSpecial) {
      return 'strong';
    }
    if (password.length >= 8 && ((hasUpper && hasNumber) || (hasLower && hasNumber))) {
      return 'medium';
    }
    return 'weak';
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('El email ya está registrado');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const strength = this.evaluatePasswordStrength(dto.password);

    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, password: passwordHash, role: dto.role },
    });

    const { password: _, ...result } = user;
    return { ...result, passwordStrength: strength };
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const { password: _, ...result } = user;
    return result;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
