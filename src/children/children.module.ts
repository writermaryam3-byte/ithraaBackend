import { forwardRef, Module } from '@nestjs/common';
import { ChildrenService } from './children.service';
import { ChildrenController } from './children.controller';
import { ParentChildrenController } from './parent-children.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Child } from './entities/child.entity';
import { ChildProfile } from './entities/child-profile.entity';
import { ChildReport } from './entities/child-report.entity';
import { OrganizationsModule } from 'src/organizations/organizations.module';
import { UsersModule } from 'src/users/users.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { ClassesModule } from 'src/classes/classes.module';
import { EvaluationsModule } from 'src/evaluations/evaluations.module';

@Module({
  controllers: [ChildrenController, ParentChildrenController],
  providers: [ChildrenService],
  imports: [
    TypeOrmModule.forFeature([Child, ChildProfile, ChildReport]),
    OrganizationsModule,
    forwardRef(() => ClassesModule),
    UsersModule,
    NotificationsModule,
    EvaluationsModule,
  ],
  exports: [TypeOrmModule, ChildrenService],
})
export class ChildrenModule {}
