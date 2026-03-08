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
      organization_name: dto.organization_name,
      organization_type: dto.organization_type,
      owner: user,
    });
    void (await manager.save(organization));
  }
}
