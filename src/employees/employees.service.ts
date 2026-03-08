import { Injectable } from '@nestjs/common';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { DataSource, Repository } from 'typeorm';
import { UsersService } from 'src/users/users.service';
import { UserRole } from 'src/common/enums/role.enum';
import { Employee } from './entities/employee.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    @InjectRepository(Employee)
    private employeeRepo: Repository<Employee>,
  ) {}

  async create(dto: CreateEmployeeDto) {
    return this.dataSource.transaction(async (manager) => {
      const user = await this.usersService.create(
        {
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          password: dto.password,
        },
        UserRole.EMPLOYEE,
        manager,
      );

      const employee = manager.create(Employee, {
        job_title: dto.job_title,
        organization: { id: dto.organization_id },
        user,
      });

      await manager.save(employee);

      return { user, employee };
    });
  }

  findAll() {
    return this.employeeRepo.findAndCount({ relations: { user: true } });
  }

  findByOrganization(organizationId: string) {
    return this.employeeRepo.findAndCountBy({
      organization: { id: organizationId },
    });
  }

  findOne(id: string) {
    return this.employeeRepo.findBy({ id });
  }

  update(id: number, updateEmployeeDto: UpdateEmployeeDto) {
    return `This action updates a #${id} employee`;
  }

  remove(id: number) {
    return `This action removes a #${id} employee`;
  }
}
