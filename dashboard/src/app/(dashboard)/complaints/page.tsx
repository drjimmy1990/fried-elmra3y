import { Database } from '@/types/database.types';
import React from 'react';
import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { ComplaintQueue } from '@/components/complaints/ComplaintQueue';
import {
  ComplaintWithDetails,
  ComplaintRow,
  StaffProfile,
  ContactRow,
} from '@/components/complaints/types';

export const metadata: Metadata = {
  title: 'إدارة الشكاوى وبلاغات العملاء | المطعم',
  description: 'نظام CRM لمتابعة ومعالجة شكاوى وبلاغات العملاء وإدارتها مباشرة في المطعم',
};

export const revalidate = 0; // Dynamic server component

export default async function ComplaintsPage() {
  const supabase = await createClient();

  // Fetch initial complaints and staff list in parallel
  const [complaintsRes, staffRes] = await Promise.all([
    supabase
      .from('complaints')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('profiles')
      .select('id, full_name, role, avatar_url, phone, is_active')
      .order('full_name', { ascending: true }),
  ]);

  if (complaintsRes.error) {
    console.error('Failed to fetch initial complaints:', complaintsRes.error);
  }

  if (staffRes.error) {
    console.error('Failed to fetch staff list:', staffRes.error);
  }

  const rawComplaints: ComplaintRow[] = complaintsRes.data || [];
  const staffList: StaffProfile[] = (staffRes.data as StaffProfile[]) || [];

  // Fetch associated contacts for complaints with contact_id
  const contactIds = Array.from(
    new Set(
      rawComplaints
        .map((c) => c.contact_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  let contactsMap: Record<string, ContactRow> = {};
  if (contactIds.length > 0) {
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .in('id', contactIds);

    if (contactsError) {
      console.error('Failed to fetch contacts for complaints:', contactsError);
    } else if (contacts) {
      contacts.forEach((contact) => {
        contactsMap[contact.id] = contact;
      });
    }
  }

  // Fetch associated orders for complaints with order_id
  const orderIds = Array.from(
    new Set(
      rawComplaints
        .map((c) => c.order_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  let ordersMap: Record<string, Database['public']['Tables']['orders']['Row']> = {};
  if (orderIds.length > 0) {
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .in('id', orderIds);

    if (ordersError) {
      console.error('Failed to fetch orders for complaints:', ordersError);
    } else if (orders) {
      orders.forEach((order) => {
        ordersMap[order.id] = order;
      });
    }
  }

  // Combine complaints with assigned profile, contact info, and order info
  const initialComplaints: ComplaintWithDetails[] = rawComplaints.map((complaint) => {
    const assignedProfile = complaint.assigned_to
      ? staffList.find((s) => s.id === complaint.assigned_to) || null
      : null;
    const contact = complaint.contact_id ? contactsMap[complaint.contact_id] || null : null;
    const order = complaint.order_id ? ordersMap[complaint.order_id] || null : null;

    return {
      ...complaint,
      assigned_profile: assignedProfile,
      contact: contact,
      order: order,
    };
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <ComplaintQueue initialComplaints={initialComplaints} staffList={staffList} />
    </div>
  );
}

