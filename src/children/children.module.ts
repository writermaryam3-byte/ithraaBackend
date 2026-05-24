import { forwardRef, Module } from '@nestjs/common';
import { ChildrenService } from './children.service';
import { ChildrenController } from './children.controller';
import { ParentChildrenController } from './parent-children.controller';
import { AdminPrivateAttemptsController } from './admin-private-attempts.controller';
import { PrivateChildAttemptsService } from './private-child-attempts.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Child } from './entities/child.entity';
import { ChildProfile } from './entities/child-profile.entity';
import { ChildReport } from './entities/child-report.entity';
import { OrganizationsModule } from 'src/organizations/organizations.module';
import { UsersModule } from 'src/users/users.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { PaymentsModule } from 'src/payments/payments.module';
import { ClassesModule } from 'src/classes/classes.module';
import { EvaluationSlot } from 'src/evaluations/entities/evaluation-slot.entity';
import { EvaluationsModule } from 'src/evaluations/evaluations.module';

@Module({
  controllers: [
    ChildrenController,
    ParentChildrenController,
    AdminPrivateAttemptsController,
  ],
  providers: [ChildrenService, PrivateChildAttemptsService],
  imports: [
    TypeOrmModule.forFeature([
      Child,
      ChildProfile,
      ChildReport,
      EvaluationSlot,
    ]),
    OrganizationsModule,
    forwardRef(() => ClassesModule),
    UsersModule,
    NotificationsModule,
    forwardRef(() => PaymentsModule),
    forwardRef(() => EvaluationsModule),
  ],
  exports: [TypeOrmModule, ChildrenService, PrivateChildAttemptsService],
})
export class ChildrenModule {}
