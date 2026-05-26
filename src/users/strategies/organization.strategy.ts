import { User } from 'src/users/entities/user.entity';
import { EntityManager } from 'typeorm';
import SignupStrategy from './signup.strategy';
import { OrganizationSignupDto } from '../dto/beneficiaries/organization-signup.dto';
import { Organization } from 'src/organizations/entities/organization.entity';

export class OrganizationSignupStrategy implements SignupStrategy {
  async saveExtraData(
    manager: EntityManager,
    user: User,
    dto: OrganizationSignupDto,
  ) {
    const organization = manager.create(Organization, {
      organizationName: dto.organizationName,
      organizationType: dto.organizationType,
      owner: user,
    });

    await manager.save(organization);

    user.organization = organization;

    await manager.save(user);
  }
}
