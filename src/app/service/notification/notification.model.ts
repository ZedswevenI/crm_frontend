export type NotificationType =
  | 'TASK'
  | 'INVIGILATION'
  | 'ADMISSION_APPROVAL_PENDING'
  | 'ADMISSION_APPROVED'
  | 'SUPPORT_TICKET'
  | 'BATCH_ASSIGNMENT'
  | 'GENERAL';

export interface AppNotification {
  _id: string;
  tenantId: string;
  notificationId: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  sourceModule: string;
  sourceRefId: string;
  data: { type: NotificationType; [key: string]: any };
  isRead: boolean;
  readAt: string | null;
  isdeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListResponse {
  status: boolean;
  data: AppNotification[];
  page: number;
  limit: number;
  count: number;
  pages: number;
  unreadCount: number;
}
