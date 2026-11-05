import { NextRequest, NextResponse } from 'next/server';
import { requireStaff, jsonError, withAdminClient } from '@/lib/auth/api-guard';
import {
  fetchOrderMessageTemplates,
  sendOrderCustomerNotification,
} from '@/lib/meta/order-messenger';
import {
  extractModificationSummary,
  interpolateOrderTemplate,
} from '@/lib/order-templates';

export async function POST(request: NextRequest) {
  try {
    const staff = await requireStaff(['admin', 'order_agent', 'support_agent']);
    if (!staff.ok) {
      return staff.response;
    }

    const body = await request.json();
    const {
      requestType, // 'modification' | 'cancellation'
      action, // 'approve' | 'decline'
      modOrderId,
      originalOrderId,
      complaintId,
      orderId,
      messageText,
      sendNotification = true,
    } = body;

    if (!requestType || !['modification', 'cancellation'].includes(requestType)) {
      return jsonError('نوع الطلب (requestType) غير صالح', 400);
    }
    if (!action || !['approve', 'decline'].includes(action)) {
      return jsonError('نوع الإجراء (action) غير صالح', 400);
    }

    return await withAdminClient(async (adminDb) => {
      const nowIso = new Date().toISOString();
      const templates = await fetchOrderMessageTemplates(adminDb);

      // =========================================================================
      // CASE 1: ORDER MODIFICATION REQUEST (approve | decline)
      // =========================================================================
      if (requestType === 'modification') {
        if (!modOrderId || typeof modOrderId !== 'string') {
          return jsonError('معرف طلب التعديل (modOrderId) مطلوب', 400);
        }

        const { data: modOrder, error: modErr } = await adminDb
          .from('orders')
          .select('*, order_items(*)')
          .eq('id', modOrderId)
          .single();

        if (modErr || !modOrder) {
          return jsonError('طلب التعديل غير موجود', 404);
        }

        // Idempotency guard: prevent double-merge or duplicate Messenger messages on concurrent clicks
        const modInotes = modOrder.internal_notes || '';
        if (
          modOrder.payment_method === 'mod_merged' ||
          modOrder.payment_method === 'mod_declined' ||
          modInotes.includes('[MOD_APPROVED]') ||
          modInotes.includes('[MOD_DECLINED]') ||
          modInotes.includes('[MOD_MERGED]')
        ) {
          return NextResponse.json({
            success: true,
            alreadyProcessed: true,
            action,
            requestType: 'modification',
            updatedOrder: modOrder,
            notificationSent: false,
            warning: null,
          });
        }

        let modItems = Array.isArray((modOrder as any).order_items)
          ? (modOrder as any).order_items
          : [];

        // Race-condition guard: if n8n is still inserting order_items (Create a row6), wait 1.2s and re-fetch
        if (action === 'approve' && modItems.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          const { data: retryItems } = await adminDb
            .from('order_items')
            .select('*')
            .eq('order_id', modOrderId);
          if (retryItems && retryItems.length > 0) {
            modItems = retryItems;
          }
        }

        const modSummary = extractModificationSummary(modOrder.customer_notes);

        if (action === 'approve') {
          let targetOrder = modOrder as any;

          // If there is a linked original order, merge the modified items & totals into the original order
          if (originalOrderId && originalOrderId !== modOrderId) {
            const { data: origOrder } = await adminDb
              .from('orders')
              .select('*, order_items(id)')
              .eq('id', originalOrderId)
              .maybeSingle();

            if (origOrder) {
              // 1. Safe insert-before-delete replacement of order_items on the original order
              if (modItems.length > 0) {
                const existingItemIds: string[] = Array.isArray((origOrder as any).order_items)
                  ? (origOrder as any).order_items.map((it: any) => it.id).filter(Boolean)
                  : [];

                const newItemsPayload = modItems.map((it: any) => ({
                  order_id: origOrder.id,
                  item_name: it.item_name,
                  quantity: Number(it.quantity) || 1,
                  unit_price: it.unit_price != null ? Number(it.unit_price) : 0,
                  total_price: it.total_price != null ? Number(it.total_price) : 0,
                  notes: it.notes || null,
                }));

                const { error: insertErr } = await adminDb
                  .from('order_items')
                  .insert(newItemsPayload);

                if (insertErr) {
                  console.error('Failed to insert modified order_items:', insertErr);
                  return jsonError('فشل تحديث أصناف الأوردر الأصلي', 500);
                }

                if (existingItemIds.length > 0) {
                  await adminDb
                    .from('order_items')
                    .delete()
                    .in('id', existingItemIds);
                }
              }

              // 2. Update original order totals, notes, and confirm it
              const modRefSuffix =
                modOrder.order_number && modOrder.order_number !== origOrder.order_number
                  ? ` من طلب #${modOrder.order_number}`
                  : '';
              const mergedInternalNotes = [
                origOrder.internal_notes,
                `[MOD_APPROVED] تم اعتماد ودمج التعديل${modRefSuffix}: ${modSummary}`,
              ]
                .filter(Boolean)
                .join(' | ');

              const { data: updatedOrig } = await adminDb
                .from('orders')
                .update({
                  subtotal: modOrder.subtotal,
                  delivery_fee: modOrder.delivery_fee,
                  total_amount: modOrder.total_amount,
                  delivery_address: modOrder.delivery_address || origOrder.delivery_address,
                  branch_id: modOrder.branch_id || origOrder.branch_id,
                  offer_id: modOrder.offer_id || origOrder.offer_id,
                  customer_notes: modOrder.customer_notes,
                  internal_notes: mergedInternalNotes,
                  status: 'confirmed',
                  updated_at: nowIso,
                })
                .eq('id', origOrder.id)
                .select('*, order_items(*)')
                .single();

              if (updatedOrig) {
                targetOrder = updatedOrig;
              }

              // 3. Archive the temporary modification row so it is never prepared twice or double-counted
              await adminDb
                .from('orders')
                .update({
                  payment_method: 'mod_merged',
                  internal_notes: `[MOD_MERGED] تم دمجه في الأوردر الأصلي #${origOrder.order_number}`,
                  updated_at: nowIso,
                })
                .eq('id', modOrder.id);
            }
          } else {
            // Standalone modification order (no earlier order found) -> approve directly
            const approvedInternalNotes = [
              modOrder.internal_notes,
              `[MOD_APPROVED] تم اعتماد التعديل`,
            ]
              .filter(Boolean)
              .join(' | ');

            const { data: updatedMod } = await adminDb
              .from('orders')
              .update({
                status: 'confirmed',
                internal_notes: approvedInternalNotes,
                updated_at: nowIso,
              })
              .eq('id', modOrder.id)
              .select('*, order_items(*)')
              .single();

            if (updatedMod) {
              targetOrder = updatedMod;
            }
          }

          let notificationSent = false;
          let warning: string | null = null;

          if (sendNotification !== false) {
            const finalMessage =
              typeof messageText === 'string' && messageText.trim()
                ? messageText.trim()
                : interpolateOrderTemplate(templates.modification_approve, {
                    customer_name: targetOrder.customer_name,
                    order_number: targetOrder.order_number,
                    total_amount: targetOrder.total_amount,
                    modification_details: modSummary,
                  });

            const sendResult = await sendOrderCustomerNotification(adminDb, {
              contactId: targetOrder.contact_id || modOrder.contact_id,
              customerPhone: targetOrder.customer_phone || modOrder.customer_phone,
              channelId: targetOrder.channel_id || modOrder.channel_id,
              messageText: finalMessage,
              sentByStaffId: staff.user.id,
            });
            notificationSent = sendResult.sent;
            warning = sendResult.error;
          }

          return NextResponse.json({
            success: true,
            action: 'approve',
            requestType: 'modification',
            updatedOrder: targetOrder,
            mergedModOrderId:
              originalOrderId && originalOrderId !== modOrderId ? modOrderId : null,
            notificationSent,
            warning,
          });
        } else {
          // DECLINE MODIFICATION
          await adminDb
            .from('orders')
            .update({
              payment_method: 'mod_declined',
              internal_notes: `[MOD_DECLINED] تم رفض طلب التعديل وإبلاغ العميل`,
              updated_at: nowIso,
            })
            .eq('id', modOrder.id);

          let displayOrderNum = modOrder.order_number;
          if (originalOrderId) {
            const { data: origOrder } = await adminDb
              .from('orders')
              .select('order_number')
              .eq('id', originalOrderId)
              .maybeSingle();
            if (origOrder?.order_number) {
              displayOrderNum = origOrder.order_number;
            }
          }

          let notificationSent = false;
          let warning: string | null = null;

          if (sendNotification !== false) {
            const finalMessage =
              typeof messageText === 'string' && messageText.trim()
                ? messageText.trim()
                : interpolateOrderTemplate(templates.modification_decline, {
                    customer_name: modOrder.customer_name,
                    order_number: displayOrderNum,
                    total_amount: modOrder.total_amount,
                    modification_details: modSummary,
                  });

            const sendResult = await sendOrderCustomerNotification(adminDb, {
              contactId: modOrder.contact_id,
              customerPhone: modOrder.customer_phone,
              channelId: modOrder.channel_id,
              messageText: finalMessage,
              sentByStaffId: staff.user.id,
            });
            notificationSent = sendResult.sent;
            warning = sendResult.error;
          }

          return NextResponse.json({
            success: true,
            action: 'decline',
            requestType: 'modification',
            declinedModOrderId: modOrder.id,
            notificationSent,
            warning,
          });
        }
      }

      // =========================================================================
      // CASE 2: CUSTOMER CANCELLATION REQUEST (approve | decline)
      // =========================================================================
      if (!complaintId || typeof complaintId !== 'string') {
        return jsonError('معرف طلب الإلغاء (complaintId) مطلوب', 400);
      }

      const { data: complaint, error: compErr } = await adminDb
        .from('complaints')
        .select('*')
        .eq('id', complaintId)
        .single();

      if (compErr || !complaint) {
        return jsonError('طلب الإلغاء غير موجود', 404);
      }

      // Idempotency guard: if this cancellation ticket was already resolved by another staff member/tab
      if (complaint.status === 'resolved') {
        return NextResponse.json({
          success: true,
          alreadyProcessed: true,
          action,
          requestType: 'cancellation',
          complaintId: complaint.id,
          notificationSent: false,
          warning: null,
        });
      }

      const targetOrderId = orderId || complaint.order_id || null;
      let linkedOrder: any = null;
      if (targetOrderId) {
        const { data: ord } = await adminDb
          .from('orders')
          .select('*')
          .eq('id', targetOrderId)
          .maybeSingle();
        linkedOrder = ord || null;
      }

      const orderNumberDisplay = linkedOrder?.order_number || complaint.ticket_number;

      if (action === 'approve') {
        if (linkedOrder) {
          const updatedInternalNotes = [
            linkedOrder.internal_notes,
            `🚫 تم إلغاء الطلب بناءً على طلب العميل (تذكرة #${complaint.ticket_number})`,
          ]
            .filter(Boolean)
            .join(' | ');

          const { data: cancelledOrd } = await adminDb
            .from('orders')
            .update({
              payment_method: 'cancelled',
              internal_notes: updatedInternalNotes,
              updated_at: nowIso,
            })
            .eq('id', linkedOrder.id)
            .select()
            .single();

          if (cancelledOrd) {
            linkedOrder = cancelledOrd;
          }
        }

        await adminDb
          .from('complaints')
          .update({
            status: 'resolved',
            resolved_at: nowIso,
            resolution_notes: 'تمت الموافقة على طلب إلغاء الأوردر وإبلاغ العميل',
            updated_at: nowIso,
          })
          .eq('id', complaint.id);

        let notificationSent = false;
        let warning: string | null = null;

        if (sendNotification !== false) {
          const finalMessage =
            typeof messageText === 'string' && messageText.trim()
              ? messageText.trim()
              : interpolateOrderTemplate(templates.cancellation_approve, {
                  customer_name: complaint.customer_name || linkedOrder?.customer_name,
                  order_number: orderNumberDisplay,
                  total_amount: linkedOrder?.total_amount || 0,
                });

          const sendResult = await sendOrderCustomerNotification(adminDb, {
            contactId: complaint.contact_id || linkedOrder?.contact_id,
            customerPhone: complaint.customer_phone || linkedOrder?.customer_phone,
            channelId: linkedOrder?.channel_id,
            messageText: finalMessage,
            sentByStaffId: staff.user.id,
          });
          notificationSent = sendResult.sent;
          warning = sendResult.error;
        }

        return NextResponse.json({
          success: true,
          action: 'approve',
          requestType: 'cancellation',
          complaintId: complaint.id,
          cancelledOrder: linkedOrder,
          notificationSent,
          warning,
        });
      } else {
        // DECLINE CUSTOMER CANCELLATION REQUEST
        await adminDb
          .from('complaints')
          .update({
            status: 'resolved',
            resolved_at: nowIso,
            resolution_notes: 'تم رفض طلب إلغاء الأوردر (خرج للتوصيل / تم التحضير) وإبلاغ العميل',
            updated_at: nowIso,
          })
          .eq('id', complaint.id);

        let notificationSent = false;
        let warning: string | null = null;

        if (sendNotification !== false) {
          const finalMessage =
            typeof messageText === 'string' && messageText.trim()
              ? messageText.trim()
              : interpolateOrderTemplate(templates.cancellation_decline, {
                  customer_name: complaint.customer_name || linkedOrder?.customer_name,
                  order_number: orderNumberDisplay,
                  total_amount: linkedOrder?.total_amount || 0,
                });

          const sendResult = await sendOrderCustomerNotification(adminDb, {
            contactId: complaint.contact_id || linkedOrder?.contact_id,
            customerPhone: complaint.customer_phone || linkedOrder?.customer_phone,
            channelId: linkedOrder?.channel_id,
            messageText: finalMessage,
            sentByStaffId: staff.user.id,
          });
          notificationSent = sendResult.sent;
          warning = sendResult.error;
        }

        return NextResponse.json({
          success: true,
          action: 'decline',
          requestType: 'cancellation',
          complaintId: complaint.id,
          notificationSent,
          warning,
        });
      }
    });
  } catch (err: unknown) {
    console.error('Unexpected error in /api/orders/modification:', err);
    return jsonError('حدث خطأ غير متوقع أثناء معالجة الطلب', 500);
  }
}
