import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { Employee } from './entities/employee.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from 'src/users/users.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService],
  imports: [TypeOrmModule.forFeature([Employee]), UsersModule, AuthModule],
  exports: [TypeOrmModule],
})
export class EmployeesModule {}
