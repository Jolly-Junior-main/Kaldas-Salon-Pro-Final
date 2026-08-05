import React, { useState, useEffect } from 'react';
import { Visit, SalonService, Language, UserRole } from '../types';
import { Dict, translateServiceName } from '../translations';
import { 
  Bell, 
  X, 
  Check, 
  Calendar, 
  CreditCard, 
  DollarSign, 
  Sparkles, 
  TrendingUp, 
  Award, 
  ChevronRight, 
  FileText,
  Clock,
  UserCheck
} from 'lucide-react';

export interface AdminPaymentAlert {
  id: string;
  customer_name: string;
  phone_number?: string;
  services: string[];
  total_amount: number;
  payment_method: string;
  timestamp: string;
}

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  allVisits: Visit[];
  salonServices: SalonService[];
  customers?: any[];
  lang: Language;
  dict: Dict;
  userRole: UserRole | null;
  adminAlert: AdminPaymentAlert | null;
  onDismissAdminAlert: () => void;
}

export default function NotificationDrawer({
  isOpen,
  onClose,
  allVisits = [],
  salonServices = [],
  customers = [],
  lang,
  dict,
  userRole,
  adminAlert,
  onDismissAdminAlert
}: NotificationDrawerProps) {
  const [activeTab, setActiveTab] = useState<'monthly' | 'history'>('monthly');
  const [countdown, setCountdown] = useState<number>(30);

  const getClientDisplayName = (v: Visit) => {
    if (v.customer_name && v.customer_name !== 'Valued Client' && v.customer_name !== 'Client Visit') {
      return v.customer_name;
    }
    const match = customers.find(c => c.id === v.customer_id) ||
                  customers.find(c => v.phone_number && c.phone_number && c.phone_number.replace(/\s+/g, '') === v.phone_number.replace(/\s+/g, ''));
    if (match && match.full_name) return match.full_name;
    return v.customer_name || 'Client Visit';
  };

  // 30-Second Countdown Timer for Admin Payment Pop-up Card
  useEffect(() => {
    if (!adminAlert) return;
    setCountdown(30);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDismissAdminAlert(); // Auto-dismiss after 30 seconds into side panel history
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [adminAlert]);

  // Current Month Telemetry Calculation
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const monthlyVisits = React.useMemo(() => {
    return allVisits.filter(v => {
      if (!v.visit_date) return false;
      const d = new Date(v.visit_date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });
  }, [allVisits, currentYear, currentMonth]);

  const totalMonthlyRevenue = React.useMemo(() => {
    return monthlyVisits.reduce((sum, v) => sum + (Number(v.price_charged) || 0), 0);
  }, [monthlyVisits]);

  // Calculate Most Popular Service for the Month
  const topMonthlyService = React.useMemo(() => {
    const counts: Record<string, number> = {};
    monthlyVisits.forEach(v => {
      (v.items_used || []).forEach(id => {
        counts[id] = (counts[id] || 0) + 1;
      });
    });
    let topId = '';
    let max = 0;
    Object.keys(counts).forEach(id => {
      if (counts[id] > max) {
        max = counts[id];
        topId = id;
      }
    });
    const srv = salonServices.find(s => s.id === topId);
    return srv ? translateServiceName(srv.id, srv.name, lang) : (topId || 'N/A');
  }, [monthlyVisits, salonServices, lang]);

  // Group monthly visits by date for full month timeline
  const groupedDailyVisits = React.useMemo(() => {
    const map: Record<string, Visit[]> = {};
    monthlyVisits.forEach(v => {
      if (!v.visit_date) return;
      const dateKey = new Date(v.visit_date).toLocaleDateString(lang === 'am' ? 'am-ET' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(v);
    });
    return map;
  }, [monthlyVisits, lang]);

  const monthName = now.toLocaleDateString(lang === 'am' ? 'am-ET' : 'en-US', { month: 'long', year: 'numeric' });

  return (
    <>
      {/* ─── 1. REAL-TIME ADMIN PAYMENT COMPLETED FLOATING POPUP CARD (30s TIMER) ─── */}
      {adminAlert && userRole === 'admin' && (
        <div className="fixed top-6 right-6 z-[9999] max-w-md w-[92vw] md:w-96 bg-neutral-900 border-2 border-emerald-500 rounded-3xl p-5 shadow-2xl animate-fade-in text-white font-sans overflow-hidden">
          {/* Progress Bar 30s Countdown Indicator */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-neutral-800">
            <div 
              className="h-full bg-emerald-500 transition-all duration-1000 linear" 
              style={{ width: `${(countdown / 30) * 100}%` }}
            />
          </div>

          <div className="flex items-start justify-between gap-3 mt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-neutral-950 flex items-center justify-center font-black shrink-0 animate-pulse">
                <DollarSign className="w-6 h-6 stroke-[3]" />
              </div>
              <div>
                <span className="inline-block text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/40 mb-0.5">
                  ✨ {lang === 'am' ? 'ክፍያ ተፈጽሟል' : 'Payment Received'} ({countdown}s)
                </span>
                <h3 className="text-base font-black text-white leading-tight">{adminAlert.customer_name}</h3>
              </div>
            </div>
            <button
              onClick={onDismissAdminAlert}
              className="p-1.5 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 p-3 bg-neutral-800/80 rounded-2xl border border-neutral-700/60 space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-medium">{lang === 'am' ? 'አገልግሎቶች:' : 'Services:'}</span>
              <span className="font-bold text-amber-300 truncate max-w-[200px]">
                {adminAlert.services.join(', ') || 'Beauty Service'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-medium">{lang === 'am' ? 'የተከፈለው መጠን:' : 'Amount Paid:'}</span>
              <span className="font-extrabold text-emerald-400 font-mono text-sm">
                {Number(adminAlert.total_amount).toFixed(2)} ETB
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-medium">{lang === 'am' ? 'የክፍያ መንገድ:' : 'Payment Method:'}</span>
              <span className="font-bold text-neutral-200 px-2 py-0.5 bg-neutral-700 rounded-md text-[10px] uppercase font-mono">
                {adminAlert.payment_method}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={onDismissAdminAlert}
              className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md ios-active-scale"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>OK</span>
            </button>
            <button
              onClick={() => {
                onDismissAdminAlert();
                setActiveTab('monthly');
              }}
              className="px-3.5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-all border border-neutral-700"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{lang === 'am' ? 'ታሪክ ተመልከት' : 'View Summary'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── 2. SLIDEABLE SIDE NOTIFICATION PANEL ─── */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-neutral-950/40 backdrop-blur-xs z-50 animate-fade-in transition-opacity"
          onClick={onClose}
        />
      )}

      <div className={`fixed top-0 right-0 bottom-0 w-full sm:w-[420px] bg-white z-50 shadow-2xl border-l border-neutral-200/60 transform transition-transform duration-300 ease-in-out flex flex-col font-sans text-neutral-800 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header Bar */}
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-900 text-white">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-neutral-950 flex items-center justify-center font-bold">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight">{lang === 'am' ? 'የማሳወቂያዎች እና የወር አገልግሎቶች ቦርድ' : 'Notification & Monthly Services Board'}</h2>
              <p className="text-[10px] text-neutral-400 font-medium">{monthName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-neutral-100 bg-neutral-50/70 p-1.5">
          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'monthly'
                ? 'bg-white text-neutral-900 shadow-xs border border-neutral-200/50'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
            <span>{lang === 'am' ? 'የሙሉ ወር አገልግሎቶች' : 'Full Month Services'}</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-white text-neutral-900 shadow-xs border border-neutral-200/50'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            <span>{lang === 'am' ? 'የክፍያ ታሪክ' : 'Recent Activity'} ({allVisits.length})</span>
          </button>
        </div>

        {/* Panel Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {activeTab === 'monthly' ? (
            <div className="space-y-5 animate-fade-in">
              {/* Monthly Overview Telemetry Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-4 rounded-2xl border border-amber-200/60 space-y-1">
                  <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-amber-600" /> {lang === 'am' ? 'የወሩ ገቢ' : 'Monthly Revenue'}
                  </span>
                  <p className="text-base font-extrabold text-neutral-900 font-mono">
                    {totalMonthlyRevenue.toFixed(2)} <span className="text-xs text-neutral-500 font-sans">ETB</span>
                  </p>
                  <p className="text-[9px] text-amber-700 font-medium">{monthlyVisits.length} {lang === 'am' ? 'አገልግሎቶች' : 'visits logged'}</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-4 rounded-2xl border border-emerald-200/60 space-y-1">
                  <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider flex items-center gap-1">
                    <Award className="w-3 h-3 text-emerald-600" /> {lang === 'am' ? 'ተመራጭ አገልግሎት' : 'Top Service'}
                  </span>
                  <p className="text-xs font-black text-neutral-900 truncate" title={topMonthlyService}>
                    {topMonthlyService}
                  </p>
                  <p className="text-[9px] text-emerald-700 font-medium">{monthName}</p>
                </div>
              </div>

              {/* Full Month Services Daily Breakdown */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                  <span>{lang === 'am' ? 'የቀን በቀን የሙሉ ወር አገልግሎት ታሪክ' : 'Full Month Daily Service Breakdown'}</span>
                </h3>

                {Object.keys(groupedDailyVisits).length === 0 ? (
                  <div className="text-center py-10 bg-neutral-50 rounded-2xl border border-neutral-200/50 text-neutral-400">
                    <p className="text-xs font-medium">{lang === 'am' ? 'በዚህ ወር የተመዘገበ አገልግሎት የለም።' : 'No service visits logged for this month yet.'}</p>
                  </div>
                ) : (
                  Object.keys(groupedDailyVisits).map(dateStr => (
                    <div key={dateStr} className="bg-neutral-50 rounded-2xl border border-neutral-200/60 overflow-hidden shadow-xs">
                      <div className="bg-neutral-100/80 px-4 py-2 flex items-center justify-between border-b border-neutral-200/50 text-xs font-bold text-neutral-800">
                        <span className="flex items-center gap-1.5 font-mono text-[11px]">
                          📅 {dateStr}
                        </span>
                        <span className="text-[10px] bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full font-mono">
                          {groupedDailyVisits[dateStr].length} {lang === 'am' ? 'አገልግሎት' : 'services'}
                        </span>
                      </div>
                      <div className="divide-y divide-neutral-100">
                        {groupedDailyVisits[dateStr].map(visit => (
                          <div key={visit.id} className="p-3 bg-white flex items-center justify-between hover:bg-neutral-50/60 transition-colors text-xs">
                            <div className="space-y-0.5 max-w-[200px]">
                              <p className="font-bold text-neutral-900 text-[11px] truncate">
                                {getClientDisplayName(visit)}
                              </p>
                              <p className="text-[10px] text-neutral-500 truncate">
                                {(visit.items_used || []).map(id => {
                                  const srv = salonServices.find(s => s.id === id);
                                  return srv ? translateServiceName(srv.id, srv.name, lang) : id;
                                }).join(', ') || 'Service'}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-extrabold text-neutral-900 font-mono text-xs">
                                {Number(visit.price_charged).toFixed(2)} ETB
                              </span>
                              <span className="block text-[9px] font-bold text-neutral-400 uppercase font-mono">
                                {visit.payment_method}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3 animate-fade-in">
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-neutral-500" />
                <span>{lang === 'am' ? 'የቅርብ የክፍያ እንቅስቃሴዎች' : 'Recent Completed Payments'}</span>
              </h3>

              {allVisits.length === 0 ? (
                <div className="text-center py-10 bg-neutral-50 rounded-2xl border border-neutral-200/50 text-neutral-400">
                  <p className="text-xs font-medium">{lang === 'am' ? 'ምንም የተቀበሉት ክፍያ የለም።' : 'No recent payment activity captured.'}</p>
                </div>
              ) : (
                allVisits.slice(0, 15).map(v => (
                  <div key={v.id} className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/60 shadow-2xs space-y-1.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-neutral-900">{getClientDisplayName(v)}</p>
                        <p className="text-[10px] text-neutral-400 font-mono">
                          {new Date(v.visit_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(v.visit_date).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 font-extrabold text-[10px] font-mono rounded-full">
                        +{Number(v.price_charged).toFixed(2)} ETB
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-600 font-medium">
                      {(v.items_used || []).map(id => {
                        const srv = salonServices.find(s => s.id === id);
                        return srv ? translateServiceName(srv.id, srv.name, lang) : id;
                      }).join(', ') || 'Beauty Service'}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
