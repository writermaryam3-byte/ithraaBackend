import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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

@Injectable()
export class ChildrenService {
  constructor(
    @InjectRepository(Child)
    private childrenRepository: Repository<Child>,
    private usersService: UsersService,
    private organizationsService: OrganizationsService,
    private dataSource: DataSource,
    private authService: AuthProvider,
    private notificationsService: NotificationsService,
  ) {}

  async createChildByParent(parentId: string, dto: CreateChildByParentDto) {
    const user = await this.usersService.findById(parentId);
    const isParent = user.roles.some((r) => r.name === UserRole.PARENT);
    if (!isParent) {
      throw new ForbiddenException(
        'Only parent users can add private children',
      );
    }

    const privateChildCount = await this.childrenRepository.count({
      where: { parent: { id: parentId }, organization: IsNull() },
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
      organization: null,
      user: { id: parentId },
      parent: { id: parentId },
      attemptsUsed: 0,
      retakeUsed: false,
    });

    return child;
  }

  async findPrivateChildrenForParent(parentId: string) {
    const [children, count] = await this.childrenRepository.findAndCount({
      where: { parent: { id: parentId }, organization: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return { children, count };
  }

  async create(createChildWithParentDto: CreateChildWithParentDto) {
    return this.dataSource.transaction(async (manager) => {
      // check organization
      if (createChildWithParentDto.child.organizationId) {
        await this.organizationsService.findOneOrFail(
          createChildWithParentDto.child.organizationId,
        );
      }

      // check user (creator)
      await this.usersService.findById(createChildWithParentDto.child.userId);

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
        organization: createChildWithParentDto.child.organizationId
          ? { id: createChildWithParentDto.child.organizationId }
          : null,
        user: { id: createChildWithParentDto.child.userId },
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

  async findAllByOrganization(orgId: string) {
    const organization = await this.organizationsService.findOneOrFail(orgId);

    const children = await this.childrenRepository.find({
      where: { organization },
      relations: ['class'],
    });

    return {
      children: children.map((child) => {
        const evaluationStatus =
          child.attemptsUsed > 0 ? 'تم التقيم' : 'لم يتم التقيم';
        const evaluationStatusClassName =
          child.attemptsUsed > 0 ? 'text-emerald-600' : '';
        return {
          id: child.id,
          name: child.name,
          className: child.class.name,
          imgSrc: '/avatar-placeholder.svg',
          evaluationStatus,
          evaluationStatusClassName,
        };
      }),
    };
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
