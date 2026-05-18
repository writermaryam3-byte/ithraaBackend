export interface OwnerClassEvaluationStatus {
  classId: string;
  className: string;
  children: {
    childId: string;
    childName: string;
    className: string;
    status: 'not_started' | 'in_progress' | 'submitted' | 'approved';
    statusLabel: string;
    lastAttemptId: string | null;
    canSendReminder: boolean;
  }[];
}
