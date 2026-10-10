'use client';

import React, { useEffect } from 'react';
import { Printer, X, Utensils } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { OrderWithItems } from './types';

interface ThermalReceiptProps {
  order: OrderWithItems;
  onClose?: () => void;
  isPreview?: boolean;
  restaurantName?: string;
}

export function ThermalReceipt({
  order,
  onClose,
  isPreview = false, restaurantName = 'المطعم' }: ThermalReceiptProps) {
  useEffect(() => {
    if (!isPreview) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreview, onClose]);

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
        <div className="flex items-center justify-center gap-1.5 font-bold text-sm">
          <Utensils className="w-4 h-4" />
          <span>{restaurantName}</span>
        </div>
        <p className="text-[10px] text-gray-700 mt-0.5">فرايد تشيكن - بروست - وجبات سريعة</p>
        <p className="text-[9px] text-gray-600 mt-0.5" dir="ltr">Hotline: 01000000000 / 01100000000</p>
      </div>

      {/* Order Info & Meta */}
      <div className="py-2 border-b border-dashed border-black text-[11px] space-y-1">
        <div className="flex justify-between items-center">
          <span className="font-bold text-xs">رقم الطلب: #{order.order_number}</span>
          <span className="text-[10px] text-gray-600">[{getSourceLabel(order.source)}]</span>
        </div>
        <div className="flex justify-between text-[10px] text-gray-700">
          <span>التاريخ:</span>
          <span>{formatDateTime(order.created_at)}</span>
        </div>
        <div className="flex justify-between text-[10px] text-gray-700">
          <span>طريقة الدفع:</span>
          <span>{order.payment_method === 'cash_on_delivery' ? 'كاش عند الاستلام' : order.payment_method}</span>
        </div>
      </div>

      {/* Customer Info */}
      <div className="py-2 border-b border-dashed border-black text-[10px] space-y-0.5">
        <div className="font-bold text-black flex items-center justify-between">
          <span>العميل:</span>
          <span>{order.customer_name || 'عميل غير مسجل'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>الهاتف:</span>
          <span dir="ltr" className="font-bold">{order.customer_phone}</span>
        </div>
        {order.delivery_address && (
          <div className="pt-0.5">
            <span className="font-semibold">العنوان: </span>
            <span className="text-gray-800 leading-tight">{order.delivery_address}</span>
          </div>
        )}
      </div>

      {/* Items List Table */}
      <div className="py-2 border-b border-dashed border-black">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="border-b border-black text-right font-bold">
              <th className="py-1">الصنف</th>
              <th className="py-1 text-center w-8">العدد</th>
              <th className="py-1 text-center w-12">السعر</th>
              <th className="py-1 text-left w-14">الإجمالي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dotted divide-gray-300">
            {order.order_items && order.order_items.length > 0 ? (
              order.order_items.map((item, idx) => (
                <tr key={idx} className="align-top">
                  <td className="py-1 pr-0.5">
                    <span className="font-semibold block">{item.item_name}</span>
                    {item.notes && (
                      <span className="text-[9px] text-gray-600 block italic leading-tight">
                        *{item.notes}
                      </span>
                    )}
                  </td>
                  <td className="py-1 text-center font-bold">x{item.quantity}</td>
                  <td className="py-1 text-center text-gray-700">{Number(item.unit_price).toFixed(0)}</td>
                  <td className="py-1 text-left font-bold">{Number(item.total_price).toFixed(0)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-2 text-center text-gray-500">
                  لا توجد أصناف مسجلة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Financial Totals */}
      <div className="py-2 border-b border-dashed border-black text-[11px] space-y-1">
        <div className="flex justify-between">
          <span>المجموع الفرعي:</span>
          <span>{formatCurrency(Number(order.subtotal || 0))}</span>
        </div>
        <div className="flex justify-between text-gray-700">
          <span>خدمة التوصيل:</span>
          <span>{formatCurrency(Number(order.delivery_fee || 0))}</span>
        </div>
        <div className="flex justify-between font-bold text-xs pt-1 border-t border-black">
          <span>المجموع النهائي:</span>
          <span>{formatCurrency(Number(order.total_amount || 0))}</span>
        </div>
      </div>

      {/* Kitchen & Delivery Special Instructions */}
      {order.internal_notes && (
        <div className="py-1.5 border-b border-dashed border-black text-[10px]">
          <span className="font-bold">ملاحظات الطيار / المطبخ:</span>
          <p className="mt-0.5 text-gray-900 leading-tight">{order.internal_notes}</p>
        </div>
      )}

      {/* Footer Notes & Barcode */}
      <div className="pt-3 text-center space-y-1.5">
        <p className="text-[10px] font-bold">شكراً لطلبكم من المطعم ❤️</p>
        <p className="text-[8px] text-gray-500">نعتز بخدمتكم - نتمنى لكم وجبة شهية</p>
        
        {/* Simulated Barcode for POS Scanning */}
        <div className="pt-2 flex flex-col items-center">
          <div className="flex items-center justify-center gap-[1px] h-7 w-36 overflow-hidden bg-black/5 p-1 rounded-xs">
            <span className="w-1 h-full bg-black"></span>
            <span className="w-0.5 h-full bg-black"></span>
            <span className="w-1.5 h-full bg-black"></span>
            <span className="w-0.5 h-full bg-black"></span>
            <span className="w-2 h-full bg-black"></span>
            <span className="w-1 h-full bg-black"></span>
            <span className="w-0.5 h-full bg-black"></span>
            <span className="w-1 h-full bg-black"></span>
            <span className="w-2 h-full bg-black"></span>
            <span className="w-0.5 h-full bg-black"></span>
            <span className="w-1 h-full bg-black"></span>
            <span className="w-1.5 h-full bg-black"></span>
            <span className="w-0.5 h-full bg-black"></span>
            <span className="w-2 h-full bg-black"></span>
          </div>
          <span className="text-[8px] tracking-widest text-gray-600 mt-0.5" dir="ltr">
            *ORD-{order.order_number}*
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Dedicated CSS Print Media Query Styles */}
      <style jsx global>{`
        @media screen {
          #thermal-receipt-printable-root {
            display: none !important;
          }
        }
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          html, body {
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          nav, header, aside, .no-print {
            display: none !important;
          }
          body * {
            visibility: hidden !important;
          }
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
        }
      `}</style>

      {/* Screen Preview Modal Mode */}
      {isPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs no-print animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && onClose) {
              onClose();
            }
          }}
        >
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
            {/* Modal Top Bar */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/70">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                <Printer className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                <span>معاينة إيصال الطابعة الحرارية (80mm)</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Receipt Slip Preview */}
            <div className="p-6 overflow-y-auto bg-slate-100/60 dark:bg-slate-950/40 flex justify-center">
              <div className="shadow-xl rounded-sm overflow-hidden border border-gray-200">
                {receiptContent}
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-md shadow-amber-500/20 transition-all hover:scale-102"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الفاتورة الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Off-screen Printable Root for window.print() */}
      <div
        id="thermal-receipt-printable-root"
        className="hidden print:block"
        aria-hidden={isPreview ? 'true' : 'false'}
      >
        {receiptContent}
      </div>
    </>
  );
}

