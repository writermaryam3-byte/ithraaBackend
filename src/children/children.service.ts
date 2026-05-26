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
import {
  CreateChildDto,
  CreateChildWithParentDto,
} from './dto/create-child.dto';
import { CreateChildByParentDto } from './dto/create-child-by-parent.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { Child } from './entities/child.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { OrganizationsService } from 'src/organizations/organizations.service';
import { UsersService } from 'src/users/services/users.service';
import { UserRole } from 'src/common/enums/role.enum';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationDelivery } from 'src/notifications/enums/notification-delivery.enum';
import { JwtRequestUser } from 'src/common/interfaces/jwt-request-user.interface';
import { ClassesService } from 'src/classes/classes.service';
import { AttemptUsageService } from 'src/evaluations/attempt-usage.service';
import { User } from 'src/users/entities/user.entity';
import { TransferService } from './transfer.service';
import { randomUUID } from 'crypto';

export type CreateChildResponse = {
  status: 'CREATED' | 'TRANSFER_REQUIRED';
  message: string;
  childId?: string;
  transferRequestId?: string;
};

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
    private notificationsService: NotificationsService,
    private attemptUsageservice: AttemptUsageService,
    private transferService: TransferService,
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

    return {
      children: await Promise.all(
        children.map(async (child) => {
          const usage = await this.attemptUsageservice.getUsage(
            child.id,
            parentId,
            this.dataSource.manager,
          );

          return {
            ...child,
            retakeUsed: usage.hasRetake,
            attemptsUsed: usage.totalAttempts,
          };
        }),
      ),
      count,
    };
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

    return {
      children: await Promise.all(
        children.map(async (child) => {
          const usage = await this.attemptUsageservice.getUsage(
            child.id,
            parentId,
            this.dataSource.manager,
          );

          return {
            ...child,
            retakeUsed: usage.hasRetake,
            attemptsUsed: usage.totalAttempts,
          };
        }),
      ),
      count,
    };
  }

  async createChild(
    dto: CreateChildDto,
    currentUser: JwtRequestUser,
  ): Promise<CreateChildResponse> {
    return this.dataSource.transaction(async (manager) => {
      const cls = await this.clsService.findOneOrFail(dto.classId);
      const currentOrganizationId = cls.organization.id;
      if (
        !(await this.organizationsService.isOrgMember(
          currentUser.userId,
          currentOrganizationId,
        ))
      ) {
        throw new ForbiddenException(
          'You are not allowed to add children to this class',
        );
      }

      await this.usersService.findById(currentUser.userId);

      const userRepo = manager.getRepository(User);
      const parentEmail = dto.parentEmail?.toLowerCase().trim();
      const parentMatches = await userRepo.find({
        where: [
          { phone: dto.parentPhone },
          ...(parentEmail ? [{ email: parentEmail }] : []),
        ],
        relations: ['roles'],
      });
      const parentIds = new Set(parentMatches.map((user) => user.id));
      if (parentIds.size > 1) {
        throw new ConflictException(
          'The provided phone and email belong to different accounts',
        );
      }

      let parent = parentMatches[0];
      if (parent) {
        if (!parent.roles?.some((role) => role.name === UserRole.PARENT)) {
          parent = await this.usersService.addRolesToUser(
            parent.id,
            [UserRole.PARENT],
            manager,
          );
        }

        const parentPatch: Partial<User> = {};
        if (dto.parentName) parentPatch.name = dto.parentName;
        if (parentEmail) parentPatch.email = parentEmail;
        parentPatch.phone = dto.parentPhone;

        if (Object.keys(parentPatch).length > 0) {
          parent = await this.usersService.updateUser(
            parent.id,
            parentPatch,
            manager,
          );
        }
      } else {
        if (!dto.parentName) {
          throw new ConflictException(
            'parentName is required when creating a new parent',
          );
        }
        parent = await this.usersService.create(
          {
            name: dto.parentName,
            email:
              parentEmail ?? this.createPlaceholderParentEmail(dto.parentPhone),
            phone: dto.parentPhone,
            password: this.createTemporaryPassword(),
          },
          [UserRole.PARENT],
          manager,
        );
      }

      const childRepo = manager.getRepository(Child);
      const existingChild = await childRepo.findOne({
        where: {
          birthDate: dto.birthDate,
          parentId: parent.id,
        },
      });

      if (existingChild) {
        if (existingChild.organizationId === currentOrganizationId) {
          throw new ConflictException('Child already exists in your school');
        }

        const transfer = await this.transferService.requestTransfer(
          existingChild.id,
          currentOrganizationId,
          manager,
        );

        return {
          status: 'TRANSFER_REQUIRED',
          message:
            'Child already exists in another school. Transfer requested.',
          childId: existingChild.id,
          transferRequestId: transfer.id,
        };
      }

      const child = await childRepo.save({
        name: dto.name,
        birthDate: dto.birthDate,
        gender: dto.gender,
        classId: dto.classId,
        organizationId: currentOrganizationId,
        createdBy: { id: currentUser.userId },
        parent: { id: parent.id },
      });

      return {
        status: 'CREATED',
        message: 'Child created successfully',
        childId: child.id,
      };
    });
  }

  async create(
    createChildWithParentDto: CreateChildWithParentDto,
    currentUser: JwtRequestUser,
  ) {
    return this.createChild(
      {
        ...createChildWithParentDto.child,
        parentName: createChildWithParentDto.parent.name,
        parentEmail: createChildWithParentDto.parent.email,
        parentPhone: createChildWithParentDto.parent.phone,
      },
      currentUser,
    );
  }

  private createTemporaryPassword() {
    return `Temp-${randomUUID()}aA1!`;
  }

  private createPlaceholderParentEmail(phone: string) {
    const normalizedPhone = phone.replace(/\D/g, '');
    return `parent-${normalizedPhone}-${randomUUID()}@placeholder.ithraa.local`;
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

    const children = await this.childrenRepository.find({
      where: {
        organizationId: orgId,
      },
      relations: { class: { grade: true } },
    });

    return {
      children: children.map((child) => ({
        ...child,
        gradeName: child.class?.grade.name,
        className: child.class?.name,
      })),
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

    return { child };
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
