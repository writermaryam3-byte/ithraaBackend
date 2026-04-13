import { NotificationDelivery } from '../enums/notification-delivery.enum';

export interface NotificationSendJobPayload {
  delivery: NotificationDelivery;
  userId: string;
  /** Required when delivery is email or both */
  email?: string;
  title: string;
  message: string;
}
