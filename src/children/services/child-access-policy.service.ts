import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Child } from '../entities/child.entity';
import { JwtRequestUser } from 'src/common/interfaces/jwt-request-user.interface';
import { UserRole } from 'src/common/enums/role.enum';
import { OrganizationsService } from 'src/organizations/organizations.service';
import { hasRole } from 'src/common/utils/has-role.util';

@Injectable()
export class ChildAccessPolicy {
  constructor(
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async loadChildWithAccessContext(childId: string): Promise<Child> {
    const child = await this.childRepo.findOne({
      where: { id: childId },
      relations: {
        parent: true,
        class: { organization: { owner: true }, teacher: { user: true } },
        organization: { owner: true },
      },
    });

    if (!child) {
      throw new NotFoundException('child not found');
    }

    return child;
  }

  async assertCanReadChild(
    childId: string,
    actor: JwtRequestUser,
  ): Promise<Child> {
    const child = await this.loadChildWithAccessContext(childId);
    this.assertReadAccess(child, actor);
    return child;
  }

  async assertCanModifyChild(
    childId: string,
    actor: JwtRequestUser,
  ): Promise<Child> {
    const child = await this.loadChildWithAccessContext(childId);
    this.assertWriteAccess(child, actor);
    return child;
  }

  assertReadAccess(child: Child, actor: JwtRequestUser) {
    if (hasRole(actor.roles, UserRole.ADMIN)) return;

    if (
      hasRole(actor.roles, UserRole.PARENT) &&
      child.parentId === actor.userId
    ) {
      return;
    }

    const org = child.organization ?? child.class?.organization;
    if (
      hasRole(actor.roles, UserRole.ORGANIZATIONOWNER) &&
      org?.ownerId === actor.userId
    ) {
      return;
    }

    if (
      hasRole(actor.roles, UserRole.TEACHER) &&
      child.class?.teacher?.user?.id === actor.userId
    ) {
      return;
    }

    throw new ForbiddenException('You do not have access to this child');
  }

  assertWriteAccess(child: Child, actor: JwtRequestUser) {
    if (hasRole(actor.roles, UserRole.ADMIN)) return;

    if (
      hasRole(actor.roles, UserRole.PARENT) &&
      child.parentId === actor.userId
    ) {
      return;
    }

    const org = child.organization ?? child.class?.organization;
    if (
      hasRole(actor.roles, UserRole.ORGANIZATIONOWNER) &&
      org?.ownerId === actor.userId
    ) {
      return;
    }

    throw new ForbiddenException('You are not allowed to modify this child');
  }

  assertCanListChildrenForUser(targetUserId: string, actor: JwtRequestUser) {
    if (hasRole(actor.roles, UserRole.ADMIN)) return;
    if (actor.userId === targetUserId) return;
    throw new ForbiddenException(
      'You can only list children for your own account',
    );
  }
}
