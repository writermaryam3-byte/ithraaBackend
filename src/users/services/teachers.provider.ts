import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTeacherDto } from '../dto/create-teacher.dto';
import { UserRole } from 'src/common/enums/role.enum';
import { DataSource, Repository } from 'typeorm';
import { Teacher } from '../entities/teacher.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthProvider } from './auth.provider';
import { UsersService } from './users.service';
import { UpdateTeacherDto } from '../dto/update-teacher.dto';
import { Organization } from 'src/organizations/entities/organization.entity';

@Injectable()
export class TeachersProvider {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly authService: AuthProvider,
    @InjectRepository(Teacher)
    private teacherRepo: Repository<Teacher>,
  ) {}
  async create(dto: CreateTeacherDto) {
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
        [UserRole.TEACHER],
        manager,
      );

      const teacher = manager.create(Teacher, {
        jobTitle: dto.jobTitle,
        organization: { id: dto.organizationId },
        user,
      });

      await manager.save(teacher);

      return { teacher };
    });
  }

  async update(id: string, updateTeacherDto: UpdateTeacherDto) {
    const teacher = await this.dataSource.getRepository(Teacher).findOne({
      where: { id },
      relations: ['user', 'organization'],
    });

    if (!teacher) throw new NotFoundException('Teacher not found');

    // لو فيه organizationId جديد
    if (updateTeacherDto.organizationId) {
      const org = await this.dataSource
        .getRepository(Organization)
        .findOne({ where: { id: updateTeacherDto.organizationId } });
      if (!org) throw new NotFoundException('Organization not found');

      teacher.organization = org;
    }

    if (updateTeacherDto.jobTitle) teacher.jobTitle = updateTeacherDto.jobTitle;

    if (updateTeacherDto.name) teacher.user.name = updateTeacherDto.name;

    return this.dataSource.getRepository(Teacher).save(teacher);
  }
}
