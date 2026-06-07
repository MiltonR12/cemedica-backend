import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePatientDto) {
    const existing = await this.prisma.patient.findUnique({ where: { ci: dto.ci } });
    if (existing) {
      if (existing.deletedAt) {
        // Reactivate soft-deleted patient
        return this.prisma.patient.update({
          where: { ci: dto.ci },
          data: { ...dto, deletedAt: null, birthDate: new Date(dto.birthDate) },
        });
      }
      throw new ConflictException(`Ya existe un paciente con CI: ${dto.ci}`);
    }

    return this.prisma.patient.create({
      data: { ...dto, birthDate: new Date(dto.birthDate) },
    });
  }

  async findAll(search?: string) {
    return this.prisma.patient.findMany({
      where: {
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { ci: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { lastName: 'asc' },
    });
  }

  async findOne(id: number) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, deletedAt: null },
      include: {
        appointments: {
          orderBy: { scheduledAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!patient) throw new NotFoundException('Paciente no encontrado');
    return patient;
  }

  async update(id: number, dto: UpdatePatientDto) {
    await this.findOne(id);
    const rawDto = dto as Partial<import('./dto/create-patient.dto').CreatePatientDto>;
    return this.prisma.patient.update({
      where: { id },
      data: {
        ...dto,
        ...(rawDto.birthDate ? { birthDate: new Date(rawDto.birthDate) } : {}),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.patient.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Paciente eliminado correctamente' };
  }
}
