import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Organization } from './entities/organization.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) {}
  // create(createOrganizationDto: CreateOrganizationDto) {
  //   return 'This action adds a new organization';
  // }

  findAll() {
    return this.organizationRepository.find();
  }

  findOne(id: number) {
    return `This action returns a #${id} organization`;
  }

  async findOneOrFail(id: string) {
    const org = await this.organizationRepository.findOneBy({ id });
    if (!org)
      throw new NotFoundException(
        `organization with this id ${id} is not found`,
      );
    return org;
  }

  async findByParent(id: string) {
    const org = await this.organizationRepository.findOne({
      where: {
        users: {
          id,
        },
      },
    });

    if (!org) {
      throw new NotFoundException(
        `Parent with id ${id} is not related to any organization`,
      );
    }

    return org;
  }

  async findByOwner(ownerId: string) {
    const org = await this.organizationRepository.findOne({
      where: { owner: { id: ownerId } },
    });
    if (!org)
      throw new NotFoundException(
        `organization for this owner with ${ownerId} is not found`,
      );
    return org;
  }

  async isOrgMember(userId: string, orgId: string): Promise<boolean> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
      relations: ['owner', 'teachers'],
    });

    if (!org) {
      return false;
    }

    if (org.owner?.id === userId) {
      return true;
    }

    const isTeacher = org.teachers?.some((teacher) => teacher.id === userId);

    return !!isTeacher;
  }

  update(id: string, updateOrganizationDto: UpdateOrganizationDto) {
    return this.organizationRepository.update(id, updateOrganizationDto);
  }

  remove(id: number) {
    return `This action removes a #${id} organization`;
  }
}
