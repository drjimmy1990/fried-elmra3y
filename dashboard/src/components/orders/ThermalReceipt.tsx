'use client';

import React from 'react';
import { Printer, X, Download, Utensils, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { OrderWithItems } from './types';

interface ThermalReceiptProps {
  order: OrderWithItems;
  onClose?: () => void;
  isPreview?: boolean;
}

export function ThermalReceipt({
  order,
  onClose,
  isPreview = false,
}: ThermalReceiptProps) {
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'messenger':
        return 'فيسبوك ماسنجر';
      case 'whatsapp':
        return 'واتساب';
      case 'web':
        return 'الموقع الإلكتروني';
      default:
        return source;
    }
  };

  const receiptContent = (
    <div
      id="thermal-receipt-container"
      className="receipt-paper mx-auto w-full max-w-[80mm] bg-white text-black p-4 text-xs font-mono select-none"
      dir="rtl"
    >
      {/* Restaurant Header */}
      <div className="text-center pb-2 border-b border-dashed border-black">
        <div className="text-lg font-extrabold tracking-wide mb-0.5">
          مطعم الخديوي 👑
        </div>
        <div className="text-[11px] font-semibold text-gray-800">
          أصل المشويات والمأكولات المصرية
        </div>
        <div className="text-[10px] text-gray-700 mt-1">
          خدمة التوصيل السريع | ت: 01023456789
        </div>
      </div>

      {/* Order Meta Header */}
      <div className="py-2 border-b border-dashed border-black space-y-1 text-[11px]">
        <div className="flex justify-between items-center font-bold text-sm">
          <span>فاتورة طلب:</span>
          <span>#{order.order_number}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-700">التاريخ والوقت:</span>
          <span>{formatDateTime(order.created_at)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-700">المصدر:</span>
          <span>{getSourceLabel(order.source)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-700">طريقة الدفع:</span>
          <span className="font-semibold">
            {order.payment_method === 'cash_on_delivery'
              ? 'نقدًا عند الاستلام'
              : order.payment_method}
          </span>
        </div>
      </div>

      {/* Customer Information */}
      <div className="py-2 border-b border-dashed border-black space-y-1 text-[11px]">
        <div className="font-bold text-gray-900">بيانات العميل:</div>
        <div className="flex justify-between">
          <span className="text-gray-700">الاسم:</span>
          <span className="font-semibold">{order.customer_name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-700">الهاتف:</span>
          <span className="font-mono font-semibold" dir="ltr">
            {order.customer_phone}
          </span>
        </div>
        <div className="text-gray-700">
          <span>العنوان: </span>
          <span className="text-black font-medium">{order.delivery_address}</span>
        </div>
      </div>

      {/* Items Table */}
      <div className="py-2 border-b border-dashed border-black">
        <table className="w-full text-right text-[11px]">
          <thead>
            <tr className="border-b border-black text-gray-800">
              <th className="py-1 text-right font-bold w-1/2">الصنف</th>
              <th className="py-1 text-center font-bold w-1/6">العدد</th>
              <th className="py-1 text-left font-bold w-1/3">السعر</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dashed divide-gray-300">
            {order.order_items.map((item, idx) => (
              <tr key={item.id || idx} className="align-top">
                <td className="py-1.5 pr-0.5">
                  <div className="font-bold text-black">{item.item_name}</div>
                  {item.notes && (
                    <div className="text-[10px] text-gray-700 italic">
                      * {item.notes}
                    </div>
                  )}
                </td>
                <td className="py-1.5 text-center font-bold">
                  {item.quantity}
                </td>
                <td className="py-1.5 text-left font-bold" dir="ltr">
                  {(Number(item.total_price) || 0).toFixed(2)} ج.م
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Financial Breakdown */}
      <div className="py-2 border-b border-dashed border-black space-y-1 text-[11px]">
        <div className="flex justify-between text-gray-800">
          <span>المجموع الفرعي:</span>
          <span dir="ltr">{(Number(order.subtotal) || 0).toFixed(2)} ج.م</span>
        </div>
        <div className="flex justify-between text-gray-800">
          <span>خدمة التوصيل:</span>
          <span dir="ltr">{(Number(order.delivery_fee) || 0).toFixed(2)} ج.م</span>
        </div>
        <div className="flex justify-between items-center text-sm font-extrabold border-t border-black pt-1 mt-1">
          <span>الإجمالي النهائي:</span>
          <span dir="ltr" className="text-base font-black">
            {(Number(order.total_amount) || 0).toFixed(2)} ج.م
          </span>
        </div>
      </div>

      {/* Internal Notes / Customer Instructions */}
      {order.internal_notes && (
        <div className="py-2 border-b border-dashed border-black text-[10px] text-gray-800">
          <div className="font-bold text-black">ملاحظات خاصة:</div>
          <div className="whitespace-pre-wrap mt-0.5">{order.internal_notes}</div>
        </div>
      )}

      {/* Cordial Closing & Barcode */}
      <div className="text-center pt-3 pb-1 space-y-1">
        <div className="font-extrabold text-[12px]">
          شكرًا لاختياركم مطعم الخديوي ❤️
        </div>
        <div className="text-[10px] text-gray-700">
          صحتين وهنا | نتمنى لكم وجبة ممتعة
        </div>
        <div className="text-[9px] text-gray-600">
          للشكاوى والمقترحات واتساب: 01023456789
        </div>

        {/* Decorative receipt barcode simulation */}
        <div className="pt-2 flex flex-col items-center">
          <div className="font-mono text-[9px] tracking-widest text-gray-800">
            *ORD-{order.order_number}-{order.id.slice(0, 6).toUpperCase()}*
          </div>
          <div className="h-6 w-4/5 flex items-center justify-between overflow-hidden opacity-80 pt-1">
            {Array.from({ length: 36 }).map((_, i) => (
              <div
                key={i}
                className="h-full bg-black"
                style={{
                  width: `${(i % 3 === 0 ? 3 : i % 2 === 0 ? 1.5 : 2)}px`,
                  opacity: i % 5 === 0 ? 0.4 : 1,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Dedicated CSS Print Media Query Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          /* Hide entire page body on print */
          body * {
            visibility: hidden !important;
          }
          /* Only make thermal receipt and its descendants visible */
          #thermal-receipt-printable-root,
          #thermal-receipt-printable-root * {
            visibility: visible !important;
          }
          #thermal-receipt-printable-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 2mm 3mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            display: block !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Screen Preview Modal Mode */}
      {isPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs no-print animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Top Bar */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Printer className="w-4 h-4 text-amber-500" />
                <span>معاينة إيصال الطابعة الحرارية (80mm)</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Receipt Slip Preview */}
            <div className="p-6 overflow-y-auto bg-slate-950/40 flex justify-center">
              <div className="shadow-xl rounded-sm overflow-hidden border border-gray-200">
                {receiptContent}
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-600/30 transition-all hover:scale-102"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الفاتورة الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden / Off-screen Printable Root for window.print() */}
      <div
        id="thermal-receipt-printable-root"
        className={isPreview ? 'hidden' : 'block'}
        aria-hidden={isPreview ? 'true' : 'false'}
      >
        {receiptContent}
      </div>
    </>
  );
}
