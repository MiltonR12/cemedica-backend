import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('appointments')
  async appointmentsReport(
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.generateAppointmentsReport(res, from, to);
  }

  @Get('patients')
  async patientsReport(@Res() res: Response) {
    return this.reportsService.generatePatientsReport(res);
  }
}
