import { Database, OrderStatus } from '@/types/database.types';

export type OrderRow = Database['public']['Tables']['orders']['Row'];
export type OrderItemRow = Database['public']['Tables']['order_items']['Row'];

export type { OrderStatus };

export type OrderWithItems = OrderRow & {
  order_items: OrderItemRow[];
};

export type DateFilterType = 'today' | 'yesterday' | 'last_7_days' | 'all';
export type ViewMode = 'kanban' | 'table';

export interface KanbanColumnDef {
  id: OrderStatus | 'pending_group';
  title: string;
  subtitle: string;
  badgeColor: string;
  bgLight: string;
  borderLight: string;
  dotColor: string;
  allowedStatuses: OrderStatus[];
}
