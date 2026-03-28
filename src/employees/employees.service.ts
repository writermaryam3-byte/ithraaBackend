import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { DataSource, Repository } from 'typeorm';
import { UsersService } from 'src/users/users.service';
import { UserRole } from 'src/common/enums/role.enum';
import { Employee } from './entities/employee.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from 'src/auth/auth.service';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    @InjectRepository(Employee)
    private employeeRepo: Repository<Employee>,
  ) {}

  async create(dto: CreateEmployeeDto) {
    return this.dataSource.transaction(async (manager) => {
      const isExits = await this.authService.isAlreadyExits(
        dto.phone,
        dto.email,
      );
      if (isExits) throw new ConflictException('employee already exits');
      const user = await this.usersService.create(
        {
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          password: dto.password,
        },
        [UserRole.EMPLOYEE],
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

  async findAll() {
    const [employees, count] = await this.employeeRepo.findAndCount({
      relations: { user: true },
    });
    return { count, employees };
  }

  async findByOrganization(organizationId: string) {
    const [employees, count] = await this.employeeRepo.findAndCount({
      where: { organization: { id: organizationId } },
      relations: { user: true },
    });
    return { count, employees };
  }

  async findOne(id: string) {
    const employee = await this.employeeRepo.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!employee) throw new NotFoundException("employee is n't found");
    return employee;
  }

  async update(id: string, updateEmployeeDto: UpdateEmployeeDto) {
    const employee = await this.findOne(id);
    Object.assign(employee, {
      job_title: updateEmployeeDto.job_title ?? employee.job_title,
    });
    Object.assign(employee.user, {
      name: updateEmployeeDto.name ?? employee.user.name,
    });
    return this.employeeRepo.save(employee);
  }

  async remove(id: string) {
    const employee = await this.findOne(id);
    return this.dataSource.transaction(async (manager) => {
      await manager.remove(User, employee.user);
      return { deletedEmployeeId: id, deletedUserId: employee.user.id };
    });
  }
}
