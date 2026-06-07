import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAppointmentDto) {
    return this.prisma.appointment.create({
      data: {
        ...dto,
        scheduledAt: new Date(dto.scheduledAt),
        status: dto.status || 'SCHEDULED',
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, ci: true } },
        doctor: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findAll(filters?: {
    patientId?: number;
    doctorId?: number;
    status?: string;
    from?: string;
    to?: string;
  }) {
    const where: any = { deletedAt: null };

    if (filters?.patientId) where.patientId = filters.patientId;
    if (filters?.doctorId) where.doctorId = filters.doctorId;
    if (filters?.status) where.status = filters.status;
    if (filters?.from || filters?.to) {
      where.scheduledAt = {};
      if (filters.from) where.scheduledAt.gte = new Date(filters.from);
      if (filters.to) where.scheduledAt.lte = new Date(filters.to);
    }

    return this.prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, ci: true } },
        doctor: { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const appt = await this.prisma.appointment.findFirst({
      where: { id, deletedAt: null },
      include: {
        patient: true,
        doctor: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    if (!appt) throw new NotFoundException('Cita no encontrada');
    return appt;
  }

  async update(id: number, dto: UpdateAppointmentDto) {
    await this.findOne(id);
    const rawDto = dto as Partial<import('./dto/create-appointment.dto').CreateAppointmentDto>;
    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...dto,
        ...(rawDto.scheduledAt ? { scheduledAt: new Date(rawDto.scheduledAt) } : {}),
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.appointment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Cita eliminada correctamente' };
  }

  /** Summary counts for the dashboard */
  async getDashboardStats() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const [total, todayCount, completed, cancelled, totalPatients] = await Promise.all([
      this.prisma.appointment.count({ where: { deletedAt: null } }),
      this.prisma.appointment.count({
        where: { deletedAt: null, scheduledAt: { gte: startOfDay, lt: endOfDay } },
      }),
      this.prisma.appointment.count({ where: { deletedAt: null, status: 'COMPLETED' } }),
      this.prisma.appointment.count({ where: { deletedAt: null, status: 'CANCELLED' } }),
      this.prisma.patient.count({ where: { deletedAt: null } }),
    ]);

    return { total, todayCount, completed, cancelled, totalPatients };
  }
}
