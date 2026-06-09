import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export type AuditAction =
  | 'PATIENT_CREATED'
  | 'PATIENT_UPDATED'
  | 'PATIENT_DELETED'
  | 'APPOINTMENT_CREATED'
  | 'APPOINTMENT_UPDATED'
  | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_DELETED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_ROLE_CHANGED'
  | 'USER_DELETED';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(
    userId: number | null | undefined,
    action: AuditAction,
    entity: string,
    entityId?: number,
    detail?: string,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: userId ?? null,
          action,
          entity,
          entityId: entityId ?? null,
          detail: detail ?? null,
        },
      });
    } catch {
      // Never let audit logging break the main flow
    }
  }
}
