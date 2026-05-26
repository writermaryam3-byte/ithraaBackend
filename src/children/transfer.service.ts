import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Class } from 'src/classes/entities/class.entity';
import { Child } from 'src/children/entities/child.entity';
import { TransferRequest } from 'src/children/entities/transfer-request.entity';
import { TransferRequestStatus } from 'src/children/enums/transfer-request-status.enum';
import { Organization } from 'src/organizations/entities/organization.entity';
import { EntityManager, Repository } from 'typeorm';
import { ListTransferRequestsDto } from './dto/list-transfer-requests.dto';

@Injectable()
export class TransferService {
  constructor(
    @InjectRepository(TransferRequest)
    private readonly transferRequests: Repository<TransferRequest>,
    @InjectRepository(Child)
    private readonly children: Repository<Child>,
    @InjectRepository(Class)
    private readonly classes: Repository<Class>,
  ) {}

  async requestTransfer(
    childId: string,
    toOrganizationId: string,
    manager?: EntityManager,
  ): Promise<TransferRequest> {
    const transferRepo = manager
      ? manager.getRepository(TransferRequest)
      : this.transferRequests;
    const childRepo = manager ? manager.getRepository(Child) : this.children;
    const orgRepo = manager
      ? manager.getRepository(Organization)
      : this.transferRequests.manager.getRepository(Organization);

    const child = await childRepo.findOne({ where: { id: childId } });
    if (!child) throw new NotFoundException('child not found');
    if (!child.organizationId) {
      throw new BadRequestException('Child is not assigned to a school');
    }
    if (child.organizationId === toOrganizationId) {
      throw new ConflictException('Child already exists in your school');
    }

    const toOrganization = await orgRepo.findOneBy({ id: toOrganizationId });
    if (!toOrganization)
      throw new NotFoundException('target organization not found');

    const existingPending = await transferRepo.findOne({
      where: {
        childId,
        fromOrganizationId: child.organizationId,
        toOrganizationId,
        status: TransferRequestStatus.PENDING,
      },
    });
    if (existingPending) return existingPending;

    return transferRepo.save(
      transferRepo.create({
        childId,
        fromOrganizationId: child.organizationId,
        toOrganizationId,
        status: TransferRequestStatus.PENDING,
      }),
    );
  }

  async approveTransfer(
    transferRequestId: string,
    classId: string,
    manager?: EntityManager,
  ): Promise<TransferRequest> {
    const transferRepo = manager
      ? manager.getRepository(TransferRequest)
      : this.transferRequests;
    const childRepo = manager ? manager.getRepository(Child) : this.children;
    const classRepo = manager ? manager.getRepository(Class) : this.classes;

    const transfer = await transferRepo.findOne({
      where: { id: transferRequestId },
    });
    if (!transfer) throw new NotFoundException('transfer request not found');
    if (transfer.status !== TransferRequestStatus.PENDING) {
      throw new ConflictException('Transfer request is already resolved');
    }

    const cls = await classRepo.findOne({
      where: { id: classId },
      relations: { organization: true },
    });
    if (!cls) throw new NotFoundException('class not found');
    if (cls.organization.id !== transfer.toOrganizationId) {
      throw new BadRequestException(
        'Class must belong to the target organization',
      );
    }

    const child = await childRepo.findOne({ where: { id: transfer.childId } });
    if (!child) throw new NotFoundException('child not found');

    child.organizationId = transfer.toOrganizationId;
    child.classId = classId;
    transfer.status = TransferRequestStatus.APPROVED;

    await childRepo.save(child);
    return transferRepo.save(transfer);
  }

  async rejectTransfer(transferRequestId: string): Promise<TransferRequest> {
    const transfer = await this.transferRequests.findOne({
      where: { id: transferRequestId },
    });
    if (!transfer) throw new NotFoundException('transfer request not found');
    if (transfer.status !== TransferRequestStatus.PENDING) {
      throw new ConflictException('Transfer request is already resolved');
    }

    transfer.status = TransferRequestStatus.REJECTED;
    return this.transferRequests.save(transfer);
  }

  async getTransferRequests(query: ListTransferRequestsDto) {
    const qb = this.transferRequests
      .createQueryBuilder('transfer')
      .leftJoinAndSelect('transfer.child', 'child')
      .leftJoinAndSelect('child.class', 'class')
      .leftJoinAndSelect('transfer.fromOrganization', 'fromOrganization')
      .leftJoinAndSelect('transfer.toOrganization', 'toOrganization')
      .orderBy('transfer.createdAt', 'DESC');

    if (query.toOrganizationId) {
      qb.andWhere('transfer.toOrganizationId = :toOrganizationId', {
        toOrganizationId: query.toOrganizationId,
      });
    }

    if (query.fromOrganizationId) {
      qb.andWhere('transfer.fromOrganizationId = :fromOrganizationId', {
        fromOrganizationId: query.fromOrganizationId,
      });
    }

    if (query.status) {
      qb.andWhere('transfer.status = :status', {
        status: query.status,
      });
    }

    const requests = await qb.getMany();

    return {
      requests: requests.map((request) => ({
        id: request.id,
        childId: request.childId,
        fromOrganizationId: request.fromOrganizationId,
        toOrganizationId: request.toOrganizationId,
        status: request.status.toLowerCase(),
        createdAt: request.createdAt,

        child: request.child
          ? {
              id: request.child.id,
              name: request.child.name,
              birthDate: request.child.birthDate,
              class: request.child.class
                ? {
                    id: request.child.class.id,
                    name: request.child.class.name,
                  }
                : null,
            }
          : null,

        fromOrganization: request.fromOrganization
          ? {
              id: request.fromOrganization.id,
              organizationName: request.fromOrganization.organizationName,
            }
          : null,

        toOrganization: request.toOrganization
          ? {
              id: request.toOrganization.id,
              organizationName: request.toOrganization.organizationName,
            }
          : null,
      })),
    };
  }
}
