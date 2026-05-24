import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateChildWithParentDto } from './dto/create-child.dto';
import { CreateChildByParentDto } from './dto/create-child-by-parent.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { Child } from './entities/child.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { OrganizationsService } from 'src/organizations/organizations.service';
import { UsersService } from 'src/users/services/users.service';
import { AuthProvider } from 'src/users/services/auth.provider';
import { UserRole } from 'src/common/enums/role.enum';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationDelivery } from 'src/notifications/enums/notification-delivery.enum';
import { JwtRequestUser } from 'src/common/interfaces/jwt-request-user.interface';
import { ClassesService } from 'src/classes/classes.service';

@Injectable()
export class ChildrenService {
  constructor(
    @InjectRepository(Child)
    private childrenRepository: Repository<Child>,
    private usersService: UsersService,
    @Inject(forwardRef(() => ClassesService))
    private clsService: ClassesService,
    private organizationsService: OrganizationsService,
    private dataSource: DataSource,
    private authService: AuthProvider,
    private notificationsService: NotificationsService,
  ) {}

  async isPrivateChild(id: string) {
    const child = await this.findOneOrFail(id);
    return child.classId === null;
  }

  async createChildByParent(parentId: string, dto: CreateChildByParentDto) {
    const user = await this.usersService.findById(parentId);
    const isParent = user.roles.some((r) => r.name === UserRole.PARENT);
    if (!isParent) {
      throw new ForbiddenException(
        'Only parent users can add private children',
      );
    }

    const privateChildCount = await this.childrenRepository.count({
      where: { parent: { id: parentId }, classId: IsNull() },
    });
    if (privateChildCount >= 2) {
      await this.notificationsService.enqueue({
        delivery: NotificationDelivery.IN_APP,
        userId: parentId,
        title: 'Child limit reached',
        message:
          'You have reached the maximum of two private children on your account.',
      });
      throw new BadRequestException('Child limit reached');
    }

    const child = await this.childrenRepository.save({
      name: dto.name,
      birthDate: dto.birthDate,
      gender: dto.gender,
      createdBy: { id: parentId },
      parent: { id: parentId },
    });

    return child;
  }

  async findPrivateChildrenForParent(parentId: string) {
    const [children, count] = await this.childrenRepository.findAndCount({
      where: { parent: { id: parentId }, classId: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return { children, count };
  }

  async findOrgChildrenForParent(parentId: string) {
    const organization = await this.organizationsService.findByParent(parentId);
    const [children, count] = await this.childrenRepository.findAndCount({
      where: {
        parent: { id: parentId },
        class: { organization: { id: organization.id } },
      },
      order: { createdAt: 'DESC' },
    });

    return { children, count };
  }

  async create(
    createChildWithParentDto: CreateChildWithParentDto,
    currentUser: JwtRequestUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { classId } = createChildWithParentDto.child;
      if (classId) {
        const cls = await this.clsService.findOneOrFail(classId);
        if (
          !(await this.organizationsService.isOrgMember(
            currentUser.userId,
            cls.organization.id,
          ))
        ) {
          throw new ForbiddenException(
            'You are not allowed to add children to this class',
          );
        }
      }

      // check user (creator)
      await this.usersService.findById(currentUser.userId);

      const parentDto = createChildWithParentDto.parent;
      const parentAlreadyExists = await this.authService.isAlreadyExits(
        parentDto.phone,
        parentDto.email,
      );

      let parent: { id: string };

      if (parentAlreadyExists) {
        const byPhone = await this.usersService.findByPhone(parentDto.phone);
        const byEmail = await this.usersService.findByEmail(
          parentDto.email.toLowerCase().trim(),
        );
        if (byPhone && byEmail && byPhone.id !== byEmail.id) {
          throw new ConflictException(
            'The provided phone and email belong to different accounts',
          );
        }
        const existing = byPhone ?? byEmail;
        if (!existing) {
          throw new ConflictException(
            'User exists but could not be loaded. Try again.',
          );
        }

        if (!existing.roles?.some((r) => r.name === UserRole.PARENT)) {
          await this.usersService.addRolesToUser(
            existing.id,
            [UserRole.PARENT],
            manager,
          );
        }

        const updated = await this.usersService.updateUser(
          existing.id,
          {
            name: parentDto.name,
            email: parentDto.email,
            phone: parentDto.phone,
            password: parentDto.password,
          },
          manager,
        );
        parent = { id: updated.id };
      } else {
        const created = await this.usersService.create(
          {
            name: parentDto.name,
            email: parentDto.email,
            phone: parentDto.phone,
            password: parentDto.password,
          },
          [UserRole.PARENT],
          manager,
        );
        parent = { id: created.id };
      }

      // create child
      const child = await manager.getRepository(Child).save({
        name: createChildWithParentDto.child.name,
        birthDate: createChildWithParentDto.child.birthDate,
        gender: createChildWithParentDto.child.gender,

        class: classId ? { id: classId } : null,

        createdBy: { id: currentUser.userId },
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

  async findAllByOrganization(orgId: string, currentUser: JwtRequestUser) {
    if (
      !(await this.organizationsService.isOrgMember(currentUser.userId, orgId))
    ) {
      throw new UnauthorizedException(
        "you aren't allowed to access these data",
      );
    }

    const classes = await this.clsService.findClassesByOrg(orgId);

    return {
      classes,
    };
  }

  async findByUser(userId: string) {
    const [children, count] = await this.childrenRepository.findAndCount({
      where: { createdBy: { id: userId } },
    });
    return { children, count };
  }

  async findOne(id: string) {
    const child = await this.childrenRepository.findOne({
      where: { id },
      relations: { class: { organization: true }, parent: true },
    });

    if (!child) {
      throw new NotFoundException('child not found');
    }

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
