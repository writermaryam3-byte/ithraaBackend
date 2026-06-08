import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserRole } from 'src/common/enums/role.enum';
import { OrganizationsService } from 'src/organizations/organizations.service';
import { ChildAccessPolicy } from './services/child-access-policy.service';
import { Child } from './entities/child.entity';

describe('ChildAccessPolicy', () => {
  let policy: ChildAccessPolicy;
  let childRepo: { findOne: jest.Mock };

  const child = {
    id: 'child-1',
    parentId: 'parent-1',
    organization: { ownerId: 'owner-1' },
    class: null,
  } as Child;

  beforeEach(async () => {
    childRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChildAccessPolicy,
        { provide: getRepositoryToken(Child), useValue: childRepo },
        {
          provide: OrganizationsService,
          useValue: {},
        },
      ],
    }).compile();

    policy = module.get(ChildAccessPolicy);
  });

  it('allows parent to read own child', async () => {
    childRepo.findOne.mockResolvedValue(child);

    await expect(
      policy.assertCanReadChild('child-1', {
        userId: 'parent-1',
        roles: [{ name: UserRole.PARENT }],
      } as any),
    ).resolves.toBeDefined();
  });

  it('denies parent access to another parent child', async () => {
    childRepo.findOne.mockResolvedValue(child);

    await expect(
      policy.assertCanReadChild('child-1', {
        userId: 'parent-2',
        roles: [{ name: UserRole.PARENT }],
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows organization owner to read child in own organization', async () => {
    childRepo.findOne.mockResolvedValue(child);

    await expect(
      policy.assertCanReadChild('child-1', {
        userId: 'owner-1',
        roles: [{ name: UserRole.ORGANIZATIONOWNER }],
      } as any),
    ).resolves.toBeDefined();
  });
});
