import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');
import type { Response } from 'express';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /** Generate a PDF report for all appointments in a date range */
  async generateAppointmentsReport(res: Response, from?: string, to?: string) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (from || to) {
      where.scheduledAt = {};
      const scheduled = where.scheduledAt as Record<string, unknown>;
      if (from) scheduled.gte = new Date(from);
      if (to) scheduled.lte = new Date(to);
    }

    const appointments = await this.prisma.appointment.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: where as any,
      include: {
        patient: { select: { firstName: true, lastName: true, ci: true } },
        doctor: { select: { name: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-citas-${Date.now()}.pdf"`,
    );
    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('CEMEDICA', { align: 'center' });
    doc
      .fontSize(12)
      .font('Helvetica')
      .text('Centro Médico de Diagnóstico y Tratamiento', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica-Bold').text('Reporte de Citas Médicas', { align: 'center' });
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Generado: ${new Date().toLocaleString('es-BO')}`, { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    if (appointments.length === 0) {
      doc.text('No se encontraron citas para el período seleccionado.', { align: 'center' });
    } else {
      // Table header
      const tableTop = doc.y;
      const colWidths = [30, 120, 120, 100, 80, 85];
      const headers = ['#', 'Paciente', 'Doctor', 'Fecha/Hora', 'Estado', 'Motivo'];
      let x = 50;

      doc.font('Helvetica-Bold').fontSize(9);
      headers.forEach((h, i) => {
        doc.text(h, x + 2, tableTop, { width: colWidths[i] - 4 });
        x += colWidths[i];
      });

      doc.moveTo(50, tableTop + 14).lineTo(545, tableTop + 14).stroke();
      doc.moveDown(0.5);

      // Table rows
      appointments.forEach((appt, idx) => {
        if (doc.y > 700) doc.addPage();
        const rowTop = doc.y;
        x = 50;
        const row = [
          String(idx + 1),
          `${appt.patient.lastName}, ${appt.patient.firstName}`,
          appt.doctor.name,
          new Date(appt.scheduledAt).toLocaleString('es-BO', {
            dateStyle: 'short',
            timeStyle: 'short',
          }),
          this.translateStatus(appt.status),
          appt.reason.substring(0, 18),
        ];

        doc.font('Helvetica').fontSize(8);
        row.forEach((val, i) => {
          doc.text(val, x + 2, rowTop, { width: colWidths[i] - 4 });
          x += colWidths[i];
        });
        doc.moveDown(0.8);
      });

      doc.moveDown();
      doc.font('Helvetica-Bold').fontSize(10).text(`Total de citas: ${appointments.length}`);
    }

    doc.end();
  }

  /** Generate a PDF report for patients */
  async generatePatientsReport(res: Response) {
    const patients = await this.prisma.patient.findMany({
      where: { deletedAt: null },
      orderBy: { lastName: 'asc' },
      include: { _count: { select: { appointments: true } } },
    });

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-pacientes-${Date.now()}.pdf"`,
    );
    doc.pipe(res);

    doc.fontSize(20).font('Helvetica-Bold').text('CEMEDICA', { align: 'center' });
    doc.fontSize(14).font('Helvetica-Bold').text('Listado de Pacientes', { align: 'center' });
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Generado: ${new Date().toLocaleString('es-BO')}`, { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    patients.forEach((p, idx) => {
      if (doc.y > 720) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(10).text(
        `${idx + 1}. ${p.lastName} ${p.firstName} — CI: ${p.ci}`,
      );
      doc
        .font('Helvetica')
        .fontSize(9)
        .text(
          `  Nacimiento: ${new Date(p.birthDate).toLocaleDateString('es-BO')}  |  Género: ${p.gender}  |  Teléfono: ${p.phone}  |  Citas: ${p._count.appointments}`,
        );
      doc.moveDown(0.5);
    });

    doc.end();
  }

  private translateStatus(status: string): string {
    const map: Record<string, string> = {
      SCHEDULED: 'Programada',
      COMPLETED: 'Completada',
      CANCELLED: 'Cancelada',
      NO_SHOW: 'No asistió',
    };
    return map[status] || status;
  }
}
