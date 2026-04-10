import { Module } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Class } from './entities/class.entity';
import { GradesModule } from 'src/grades/grades.module';
import { ChildrenModule } from 'src/children/children.module';

@Module({
  controllers: [ClassesController],
  providers: [ClassesService],
  imports: [TypeOrmModule.forFeature([Class]), GradesModule, ChildrenModule],
  exports: [TypeOrmModule],
})
export class ClassesModule {}
