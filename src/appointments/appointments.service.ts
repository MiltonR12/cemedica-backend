import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateAppointmentDto, userId?: number) {
    const appt = await this.prisma.appointment.create({
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

    await this.audit.log(
      userId,
      'APPOINTMENT_CREATED',
      'Appointment',
      appt.id,
      `${appt.patient.firstName} ${appt.patient.lastName} — Dr. ${appt.doctor.name}`,
    );

    return appt;
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

  async update(id: number, dto: UpdateAppointmentDto, userId?: number) {
    await this.findOne(id);
    const rawDto = dto as Partial<import('./dto/create-appointment.dto').CreateAppointmentDto>;
    const updated = await this.prisma.appointment.update({
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

    const action = dto.status === 'CANCELLED' ? 'APPOINTMENT_CANCELLED' : 'APPOINTMENT_UPDATED';
    await this.audit.log(
      userId,
      action,
      'Appointment',
      id,
      `${updated.patient.firstName} ${updated.patient.lastName} — Dr. ${updated.doctor.name}`,
    );

    return updated;
  }

  async remove(id: number, userId?: number) {
    const appt = await this.findOne(id);
    await this.prisma.appointment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log(
      userId,
      'APPOINTMENT_DELETED',
      'Appointment',
      id,
      `${appt.patient.firstName} ${appt.patient.lastName}`,
    );
    return { message: 'Cita eliminada correctamente' };
  }

  /** Summary counts for the dashboard */
  async getDashboardStats() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const [total, todayCount, completed, cancelled, totalPatients, allAppointments] =
      await Promise.all([
        this.prisma.appointment.count({ where: { deletedAt: null } }),
        this.prisma.appointment.count({
          where: { deletedAt: null, scheduledAt: { gte: startOfDay, lt: endOfDay } },
        }),
        this.prisma.appointment.count({ where: { deletedAt: null, status: 'COMPLETED' } }),
        this.prisma.appointment.count({ where: { deletedAt: null, status: 'CANCELLED' } }),
        this.prisma.patient.count({ where: { deletedAt: null } }),
        this.prisma.appointment.findMany({
          where: { deletedAt: null },
          select: {
            scheduledAt: true,
            doctorId: true,
            doctor: { select: { name: true } },
          },
        }),
      ]);

    // Citas por mes — últimos 6 meses
    const now = new Date();
    const citasPorMes: { mes: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const count = allAppointments.filter((a) => {
        const dt = new Date(a.scheduledAt);
        return dt >= d && dt < nextMonth;
      }).length;
      citasPorMes.push({ mes: monthNames[d.getMonth()], total: count });
    }

    // Top doctores
    const doctorMap = new Map<number, { name: string; count: number }>();
    for (const a of allAppointments) {
      if (!doctorMap.has(a.doctorId)) {
        doctorMap.set(a.doctorId, { name: a.doctor.name, count: 0 });
      }
      doctorMap.get(a.doctorId)!.count++;
    }
    const topDoctores = [...doctorMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((d) => ({ name: d.name, citas: d.count }));

    return { total, todayCount, completed, cancelled, totalPatients, citasPorMes, topDoctores };
  }
}
