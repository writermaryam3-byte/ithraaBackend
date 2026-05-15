import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationDelivery } from 'src/notifications/enums/notification-delivery.enum';
import { NotificationsService } from 'src/notifications/notifications.service';
import { Organization } from 'src/organizations/entities/organization.entity';
import { UserRole } from 'src/common/enums/role.enum';
import { JwtRequestUser } from 'src/common/interfaces/jwt-request-user.interface';
import { Teacher } from 'src/users/entities/teacher.entity';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { CreateDealDto } from './dto/create-deal.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { DealStatus } from './enums/deal-status.enum';
import { ProposalStatus } from './enums/proposal-status.enum';
import { Activity } from './entities/activity.entity';
import { Deal } from './entities/deal.entity';
import { Proposal } from './entities/proposal.entity';

@Injectable()
export class DealsService {
  constructor(
    @InjectRepository(Deal)
    private readonly dealsRepo: Repository<Deal>,
    @InjectRepository(Proposal)
    private readonly proposalsRepo: Repository<Proposal>,
    @InjectRepository(Activity)
    private readonly activitiesRepo: Repository<Activity>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Organization)
    private readonly organizationsRepo: Repository<Organization>,
    @InjectRepository(Teacher)
    private readonly teachersRepo: Repository<Teacher>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createDeal(dto: CreateDealDto, currentUser: JwtRequestUser) {
    const activity = await this.activitiesRepo.findOne({
      where: { id: dto.activityId },
    });
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    const organizationId = await this.resolveOrganizationId(currentUser);
    const organization = await this.organizationsRepo.findOne({
      where: { id: organizationId },
      relations: ['owner'],
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const creator = await this.usersRepo.findOne({
      where: { id: currentUser.userId },
      select: ['id', 'name', 'email'],
    });
    if (!creator) {
      throw new NotFoundException('User not found');
    }

    const deal = this.dealsRepo.create({
      activity,
      organization,
      creator,
      studentsCount: dto.studentsCount,
      deadline: new Date(dto.deadline),
      status: DealStatus.OPEN,
    });

    const savedDeal = await this.dealsRepo.save(deal);
    await this.notifyServiceProviders(savedDeal.id);

    return savedDeal;
  }

  async submitProposal(
    dealId: string,
    dto: CreateProposalDto,
    currentUser: JwtRequestUser,
  ) {
    const deal = await this.dealsRepo.findOne({
      where: { id: dealId },
      relations: ['organization', 'organization.owner'],
    });
    if (!deal) {
      throw new NotFoundException('Deal not found');
    }

    this.ensureDealAcceptsBids(deal);

    const existing = await this.proposalsRepo.findOne({
      where: {
        deal: { id: dealId },
        provider: { id: currentUser.userId },
      },
    });
    if (existing) {
      throw new BadRequestException(
        'You have already submitted a proposal for this deal',
      );
    }

    const provider = await this.usersRepo.findOne({
      where: { id: currentUser.userId },
      select: ['id', 'name', 'email'],
    });
    if (!provider) {
      throw new NotFoundException('User not found');
    }

    const proposal = this.proposalsRepo.create({
      deal,
      provider,
      price: dto.price.toFixed(2),
      status: ProposalStatus.PENDING,
    });
    const saved = await this.proposalsRepo.save(proposal);

    if (deal.organization?.owner?.id) {
      await this.notificationsService.enqueue({
        userId: deal.organization.owner.id,
        title: 'New proposal received',
        message: `A new proposal has been submitted for deal ${deal.id}.`,
        delivery: NotificationDelivery.IN_APP,
      });
    }

    return saved;
  }

  async updateProposal(
    proposalId: string,
    dto: UpdateProposalDto,
    currentUser: JwtRequestUser,
  ) {
    const proposal = await this.proposalsRepo.findOne({
      where: { id: proposalId },
      relations: ['deal', 'provider'],
    });
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (proposal.provider.id !== currentUser.userId) {
      throw new ForbiddenException('You can only update your own proposal');
    }

    if (new Date() >= proposal.deal.deadline) {
      throw new BadRequestException(
        'Cannot update proposal after deal deadline',
      );
    }

    proposal.price = dto.price.toFixed(2);
    return this.proposalsRepo.save(proposal);
  }

  private ensureDealAcceptsBids(deal: Deal): void {
    if (deal.status !== DealStatus.OPEN) {
      throw new BadRequestException('This deal is closed');
    }

    if (new Date() >= new Date(deal.deadline)) {
      throw new BadRequestException('Deal deadline has passed');
    }
  }

  private async resolveOrganizationId(currentUser: JwtRequestUser) {
    const hasRole = (role: UserRole) =>
      currentUser.roles.some((r) => r.name === role);

    if (hasRole(UserRole.ORGANIZATIONOWNER)) {
      const org = await this.organizationsRepo.findOne({
        where: { owner: { id: currentUser.userId } },
        select: ['id'],
      });
      if (!org) {
        throw new NotFoundException('Organization not found for owner');
      }
      return org.id;
    }

    if (hasRole(UserRole.TEACHER)) {
      const teacher = await this.teachersRepo.findOne({
        where: { user: { id: currentUser.userId } },
        relations: ['organization'],
      });
      if (!teacher?.organization?.id) {
        throw new NotFoundException('Organization not found for teacher');
      }
      return teacher.organization.id;
    }

    throw new ForbiddenException('You are not allowed to create deals');
  }

  private async notifyServiceProviders(dealId: string): Promise<void> {
    const providers = await this.usersRepo.find();
    const providerUsers = providers.filter((u) =>
      u.roles.some((role) => role.name === UserRole.ENRICHER),
    );

    await Promise.all(
      providerUsers.map((provider) =>
        this.notificationsService.enqueue({
          userId: provider.id,
          title: 'New deal available',
          message: `A new deal is available for bidding (deal id: ${dealId}).`,
          delivery: NotificationDelivery.IN_APP,
        }),
      ),
    );
  }
}
