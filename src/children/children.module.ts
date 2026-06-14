import { forwardRef, Module } from '@nestjs/common';
import { ChildrenService } from './children.service';
import { ChildrenController } from './children.controller';
import { ParentChildrenController } from './parent-children.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationChild } from './entities/organization-child.entity';
import { PrivateChild } from './entities/private-child.entity';
import { ChildProfile } from './entities/child-profile.entity';
import { ChildReport } from './entities/child-report.entity';
import { TransferRequest } from './entities/transfer-request.entity';
import { OrganizationsModule } from 'src/organizations/organizations.module';
import { UsersModule } from 'src/users/users.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { ClassesModule } from 'src/classes/classes.module';
import { EvaluationsModule } from 'src/evaluations/evaluations.module';
import { TransferService } from './transfer.service';
import { TransfersController } from './transfers.controller';
import { ChildAccessPolicy } from './services/child-access-policy.service';
import { AuditLog } from 'src/common/entities/audit-log.entity';
import { AuditLoggingService } from 'src/common/services/audit-logging.service';
import { TransferAccessPolicy } from './policies/transfer-access.policy';

@Module({
  controllers: [
    ChildrenController,
    ParentChildrenController,
    TransfersController,
  ],
  providers: [
    ChildrenService,
    TransferService,
    TransferAccessPolicy,
    ChildAccessPolicy,
    AuditLoggingService,
  ],
  imports: [
    TypeOrmModule.forFeature([
      OrganizationChild,
      PrivateChild,
      ChildProfile,
      ChildReport,
      TransferRequest,
      AuditLog,
    ]),
    OrganizationsModule,
    forwardRef(() => ClassesModule),
    UsersModule,
    NotificationsModule,
    EvaluationsModule,
  ],
  exports: [TypeOrmModule, ChildrenService, TransferService],
})
export class ChildrenModule {}
