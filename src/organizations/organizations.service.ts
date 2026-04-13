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
    if (!org) throw new NotFoundException('organization not found');
    return org;
  }

  findByOwner(ownerId: string) {
    return this.organizationRepository.findOne({
      where: { owner: { id: ownerId } },
    });
  }

  update(id: string, updateOrganizationDto: UpdateOrganizationDto) {
    return this.organizationRepository.update(id, updateOrganizationDto);
  }

  remove(id: number) {
    return `This action removes a #${id} organization`;
  }
}
