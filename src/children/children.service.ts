import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateChildWithParentDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { Child } from './entities/child.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OrganizationsService } from 'src/organizations/organizations.service';
import { UsersService } from 'src/users/services/users.service';
import { AuthProvider } from 'src/users/services/auth.provider';
import { UserRole } from 'src/common/enums/role.enum';

@Injectable()
export class ChildrenService {
  constructor(
    @InjectRepository(Child)
    private childrenRepository: Repository<Child>,
    private usersService: UsersService,
    private organizationsService: OrganizationsService,
    private dataSource: DataSource,
    private authService: AuthProvider,
  ) {}

  async create(createChildWithParentDto: CreateChildWithParentDto) {
    return this.dataSource.transaction(async (manager) => {
      // check organization
      if (createChildWithParentDto.child.organization_id) {
        await this.organizationsService.findOneOrFail(
          createChildWithParentDto.child.organization_id,
        );
      }

      // check user (creator)
      await this.usersService.findById(createChildWithParentDto.child.user_id);

      // check parent exists
      const isExists = await this.authService.isAlreadyExits(
        createChildWithParentDto.parent.phone,
        createChildWithParentDto.parent.email,
      );
      if (isExists) throw new ConflictException('user already exists');

      // create parent
      const parent = await this.usersService.create(
        {
          name: createChildWithParentDto.parent.name, // ✅ مهم تفصل
          email: createChildWithParentDto.parent.email,
          phone: createChildWithParentDto.parent.phone,
          password: createChildWithParentDto.parent.password,
        },
        [UserRole.PARENT],
        manager,
      );

      // create child
      const child = await manager.getRepository(Child).save({
        name: createChildWithParentDto.child.name,
        birthDate: createChildWithParentDto.child.birthDate,
        gender: createChildWithParentDto.child.gender,
        organization: createChildWithParentDto.child.organization_id
          ? { id: createChildWithParentDto.child.organization_id }
          : null,
        user: { id: createChildWithParentDto.child.user_id },
        parent: { id: parent.id },
      });

      return {
        message: 'child created successfully with parent',
        child,
      };
    });
  }

  async findAll() {
    const [children, count] = await this.childrenRepository.findAndCount();

    return { children, count };
  }

  async findByUser(userId: string) {
    const [children, count] = await this.childrenRepository.findAndCount({
      where: { user: { id: userId } },
    });
    return { children, count };
  }

  async findOne(id: string) {
    const child = await this.childrenRepository.findBy({ id });
    if (!child) throw new NotFoundException('child not found');
    return child;
  }

  async findOneOrFail(id: string) {
    const child = await this.childrenRepository.findOneBy({ id });
    if (!child) throw new NotFoundException('child not found');
    return child;
  }
  async update(id: string, updateChildDto: UpdateChildDto) {
    const child = await this.childrenRepository.preload({
      id,
      ...updateChildDto,
    });
    if (!child) throw new NotFoundException('child not found');
    return this.childrenRepository.save(child);
  }

  save(child: Child) {
    return this.childrenRepository.save(child);
  }
  remove(id: string) {
    return this.childrenRepository.delete(id);
  }
}
