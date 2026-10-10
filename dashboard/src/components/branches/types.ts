import { Database } from '@/types/database.types';

export type BranchRow = Database['public']['Tables']['branches']['Row'];
export type BranchInsert = Database['public']['Tables']['branches']['Insert'];
export type BranchUpdate = Database['public']['Tables']['branches']['Update'];

export type DeliveryZoneRow = Database['public']['Tables']['branch_delivery_zones']['Row'];
export type DeliveryZoneInsert = Database['public']['Tables']['branch_delivery_zones']['Insert'];
export type DeliveryZoneUpdate = Database['public']['Tables']['branch_delivery_zones']['Update'];

export interface BranchWithZones extends BranchRow {
  delivery_zones?: DeliveryZoneRow[];
  zones_count?: number;
}
