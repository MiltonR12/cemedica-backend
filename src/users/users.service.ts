import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcryptjs';

export type PasswordStrength = 'weak' | 'medium' | 'strong';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

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

    if (
      password.length >= 10 &&
      hasUpper &&
      hasLower &&
      hasNumber &&
      hasSpecial
    ) {
      return 'strong';
    }
    if (
      password.length >= 8 &&
      ((hasUpper && hasNumber) || (hasLower && hasNumber))
    ) {
      return 'medium';
    }
    return 'weak';
  }

  async create(dto: CreateUserDto, requestingUserId?: number) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('El email ya está registrado');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const strength = this.evaluatePasswordStrength(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: passwordHash,
        role: dto.role,
      },
    });

    await this.audit.log(
      requestingUserId,
      'USER_CREATED',
      'User',
      user.id,
      `${user.name} (${user.email}) — Rol: ${user.role}`,
    );

    const { password: _, ...result } = user;
    return { ...result, passwordStrength: strength };
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
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

  async update(id: number, dto: UpdateUserDto, requestingUserId?: number) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Usuario no encontrado');

    // Check email uniqueness if changing email
    if (dto.email && dto.email !== existing.email) {
      const emailTaken = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (emailTaken) throw new ConflictException('El email ya está en uso');
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const roleChanged = dto.role && dto.role !== existing.role;
    if (dto.role !== undefined) data.role = dto.role;

    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    const updated = await this.prisma.user.update({ where: { id }, data });

    // Log role changes separately for clarity
    if (roleChanged) {
      await this.audit.log(
        requestingUserId,
        'USER_ROLE_CHANGED',
        'User',
        id,
        `${existing.name}: ${existing.role} → ${dto.role}`,
      );
    } else {
      await this.audit.log(
        requestingUserId,
        'USER_UPDATED',
        'User',
        id,
        `${existing.name} (${existing.email})`,
      );
    }

    const { password: _, ...result } = updated;
    return result;
  }

  async remove(id: number, requestingUserId?: number) {
    if (id === requestingUserId) {
      throw new BadRequestException('No puedes eliminar tu propia cuenta');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    await this.prisma.user.delete({ where: { id } });

    await this.audit.log(
      requestingUserId,
      'USER_DELETED',
      'User',
      id,
      `${user.name} (${user.email}) — Rol: ${user.role}`,
    );

    return { message: 'Usuario eliminado correctamente' };
  }

  async getStats() {
    const users = await this.prisma.user.findMany({
      select: { role: true },
    });
    const counts: Record<string, number> = {
      ADMIN: 0,
      DOCTOR: 0,
      RECEPCION: 0,
    };
    for (const u of users) {
      counts[u.role] = (counts[u.role] || 0) + 1;
    }
    return counts;
  }
}
