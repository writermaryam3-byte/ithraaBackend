import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from 'src/common/enums/role.enum';
import { EvaluationAttempt } from '../entities/evaluation-attempt.entity';

export type EvaluationActor = { userId: string; roles: UserRole[] };

@Injectable()
export class EvaluationAccessPolicy {
  assertHasRole(actor: EvaluationActor, allowed: UserRole[]) {
    if (!actor.roles.some((role) => allowed.includes(role))) {
      throw new ForbiddenException('Insufficient role');
    }
  }

  assertParentOwnership(attempt: EvaluationAttempt, actor: EvaluationActor) {
    if (attempt.parentId !== actor.userId) {
      throw new ForbiddenException('Attempt not owned by this parent');
    }
  }

  assertCanReadAttempt(attempt: EvaluationAttempt, actor: EvaluationActor) {
    if (actor.roles.includes(UserRole.ADMIN)) return;

    if (actor.roles.includes(UserRole.PARENT)) {
      this.assertParentOwnership(attempt, actor);
      return;
    }

    const childClass = attempt.child?.class;

    if (!childClass) {
      throw new ForbiddenException('Private child attempt is not accessible');
    }

    if (
      actor.roles.includes(UserRole.ORGANIZATIONOWNER) &&
      childClass.organization?.owner?.id === actor.userId
    ) {
      return;
    }

    if (
      actor.roles.includes(UserRole.TEACHER) &&
      childClass.teacher?.user?.id === actor.userId
    ) {
      return;
    }

    throw new ForbiddenException('Attempt not accessible');
  }
}
