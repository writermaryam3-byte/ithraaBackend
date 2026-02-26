import { Module } from '@nestjs/common';
import { ChildrenService } from './children.service';
import { ChildrenController } from './children.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Child } from './entities/child.entity';
import { ChildProfile } from './entities/child-profile.entity';
import { ChildReport } from './entities/child-report.entity';

@Module({
  controllers: [ChildrenController],
  providers: [ChildrenService],
  imports: [TypeOrmModule.forFeature([Child, ChildProfile, ChildReport])],
  exports: [TypeOrmModule],
})
export class ChildrenModule {}
