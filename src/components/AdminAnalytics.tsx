/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Language, CustomerWithRetention, Visit, SalonService, TreatmentArtist } from '../types';
import { Dict, translateName, translateServiceName } from '../translations';
import { AreaChart, TrendingUp, Download, PieChart, Star, Calendar, RefreshCcw, Landmark, CreditCard, DollarSign, ChevronLeft, ChevronRight, Users, Award, Sparkles, Clock } from 'lucide-react';

interface AnalyticsPayload {
  revenue: {
    daily: number;
    dailyBreakdown: Record<string, number>;
    weekly: number;
    monthly: number;
  };
  distribution: {
    Frequent: number;
    Occasional: number;
    'At-Risk': number;
  };
  leaderboard: Array<{ count: number; name: string; revenue: number }>;
}

interface CustomRangeResult {
  start: string;
  end: string;
  totalRevenue: number;
  transactionCount: number;
  breakDown: Record<string, number>;
}

interface AdminAnalyticsProps {
  lang: Language;
  dict: Dict;
  customers?: CustomerWithRetention[];
  allVisits?: Visit[];
  salonServices?: SalonService[];
  staffList?: any[];
  artistsList?: TreatmentArtist[];
  userRole?: 'admin' | 'cashier' | 'assistant' | null;
}

export default function AdminAnalytics({ 
  lang, 
  dict, 
  customers = [], 
  allVisits = [], 
  salonServices = [],
  staffList = [],
  artistsList = [],
  userRole = null
}: AdminAnalyticsProps) {
  // Custom range states
  const [startDate, setStartDate] = useState(() => {
    const d = new Date('2026-06-01');
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date('2026-06-17');
    return d.toISOString().split('T')[0];
  });

  // Export states
  const [selectedStatus, setSelectedStatus] = useState<'Green' | 'Yellow' | 'Red' | 'All'>('All');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');

  // Daily payment history selected date
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const minAllowedDateStr = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return d.toISOString().split('T')[0];
  }, []);

  const maxAllowedDateStr = React.useMemo(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }, []);

  // Compute live responsive analytics client side
  const analytics = React.useMemo(() => {
    const curTime = new Date();
    const startOfToday = new Date(curTime.getFullYear(), curTime.getMonth(), curTime.getDate());
    const sevenDaysAgo = new Date(curTime.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(curTime.getTime() - 30 * 24 * 60 * 60 * 1000);

    let dailyRev = 0;
    const dailyBreakdown: Record<string, number> = {
      'Telebirr': 0, 'CBE Birr': 0, 'M-Pesa': 0, 'Bank Transfer': 0, 'Cash': 0, 'Card': 0
    };
    let weeklyRev = 0;
    let monthlyRev = 0;

    allVisits.forEach(v => {
      const vDate = new Date(v.visit_date);
      const price = Number(v.price_charged || 0);

      if (vDate >= startOfToday) {
        dailyRev += price;
        const method = v.payment_method;
        if (method in dailyBreakdown) {
          dailyBreakdown[method] += price;
        }
      }
      if (vDate >= sevenDaysAgo) {
        weeklyRev += price;
      }
      if (vDate >= thirtyDaysAgo) {
        monthlyRev += price;
      }
    });

    const distribution = {
      Frequent: 0,
      Occasional: 0,
      'At-Risk': 0
    };
    customers.forEach(c => {
      if (c.retentionStatus in distribution) {
        distribution[c.retentionStatus]++;
      }
    });

    const serviceLeaderboard: Record<string, { count: number; name: string; revenue: number }> = {};
    allVisits.forEach(v => {
      const price = Number(v.price_charged || 0);
      const items = (Array.isArray(v.items_used) ? v.items_used : []) as string[];

      items.forEach(itemId => {
        const def = salonServices.find(s => s.id === itemId);
        const name = def ? translateServiceName(def.id, def.name, lang) : itemId;
        if (!serviceLeaderboard[itemId]) {
          serviceLeaderboard[itemId] = { count: 0, name, revenue: 0 };
        }
        serviceLeaderboard[itemId].count++;
        serviceLeaderboard[itemId].revenue += (def ? def.defaultPrice : price / (items.length || 1));
      });
    });

    const leaderboard = Object.values(serviceLeaderboard)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      revenue: {
        daily: dailyRev,
        dailyBreakdown,
        weekly: weeklyRev,
        monthly: monthlyRev
      },
      distribution,
      leaderboard
    };
  }, [customers, allVisits, salonServices]);

  // Compute live dynamic custom date range metrics
  const customRange = React.useMemo(() => {
    const startObj = new Date(startDate);
    const endObj = new Date(endDate);
    endObj.setHours(23, 59, 59, 999);

    let totalRevenue = 0;
    let transactionCount = 0;
    const breakDown: Record<string, number> = {
      'Telebirr': 0, 'CBE Birr': 0, 'M-Pesa': 0, 'Bank Transfer': 0, 'Cash': 0, 'Card': 0
    };

    allVisits.forEach(v => {
      const vDate = new Date(v.visit_date);
      if (vDate >= startObj && vDate <= endObj) {
        const price = Number(v.price_charged || 0);
        totalRevenue += price;
        transactionCount++;
        const method = v.payment_method;
        if (method in breakDown) {
          breakDown[method] += price;
        }
      }
    });

    return {
      start: startDate,
      end: endDate,
      totalRevenue,
      transactionCount,
      breakDown
    };
  }, [startDate, endDate, allVisits]);

  // Compute live preview lists of segmented classifications
  const previewList = React.useMemo(() => {
    if (selectedStatus === 'All') {
      return customers;
    }
    const statusParam = selectedStatus === 'Green' ? 'Frequent' : selectedStatus === 'Yellow' ? 'Occasional' : 'At-Risk';
    return customers.filter(c => c.retentionStatus === statusParam);
  }, [selectedStatus, customers]);

  // Compute live stylist performance metrics of the month
  const staffPerformance = React.useMemo(() => {
    const curTime = new Date();
    const currentYear = curTime.getFullYear();
    const currentMonth = curTime.getMonth();

    return (artistsList || []).map((a) => {
      const roleLabel = lang === 'am' ? 'የውበት ባለሙያ' : 'Treatment Artist';

      const memberVisits = allVisits.filter(v => {
        if (!v.assigned_staff_id) return false;
        return v.assigned_staff_id.split(',').map(s => s.trim()).includes(a.id);
      });
      
      let valueMonth = 0;
      let visitsMonth = 0;
      const uniqueClientsMonthSet = new Set<string>();

      memberVisits.forEach(v => {
        const vDate = new Date(v.visit_date);
        if (vDate.getFullYear() === currentYear && vDate.getMonth() === currentMonth) {
          valueMonth += Number(v.price_charged || 0);
          visitsMonth++;
          if (v.customer_id) {
            uniqueClientsMonthSet.add(v.customer_id);
          }
        }
      });

      const clientsMonth = uniqueClientsMonthSet.size;

      const servedCustomerIds = Array.from(new Set(memberVisits.map(v => v.customer_id)));
      let retainedCount = 0;
      servedCustomerIds.forEach(cid => {
        const cust = customers.find(c => c.id === cid);
        if (cust && (cust.retentionStatus === 'Frequent' || cust.retentionStatus === 'Occasional')) {
          retainedCount++;
        }
      });
      const retentionRate = servedCustomerIds.length > 0 
        ? Math.round((retainedCount / servedCustomerIds.length) * 100) 
        : 0;

      const slotsCount = {
        Morning: 0,
        Afternoon: 0,
        Evening: 0,
        Night: 0
      };

      memberVisits.forEach(v => {
        const vDate = new Date(v.visit_date);
        if (vDate.getFullYear() === currentYear && vDate.getMonth() === currentMonth) {
          const hours = vDate.getHours();
          if (hours >= 8 && hours < 12) slotsCount.Morning++;
          else if (hours >= 12 && hours < 16) slotsCount.Afternoon++;
          else if (hours >= 16 && hours < 20) slotsCount.Evening++;
          else slotsCount.Night++;
        }
      });

      let highestSlot = '';
      let maxCount = 0;
      if (slotsCount.Morning > maxCount) { maxCount = slotsCount.Morning; highestSlot = lang === 'am' ? 'ማለዳ (8-12 ሰዓት)' : 'Morning (8-12)'; }
      if (slotsCount.Afternoon > maxCount) { maxCount = slotsCount.Afternoon; highestSlot = lang === 'am' ? 'ከሰዓት (12-4 ሰዓት)' : 'Afternoon (12-4)'; }
      if (slotsCount.Evening > maxCount) { maxCount = slotsCount.Evening; highestSlot = lang === 'am' ? 'ምሽት (4-8 ሰዓት)' : 'Evening (4-8)'; }
      if (slotsCount.Night > maxCount) { maxCount = slotsCount.Night; highestSlot = lang === 'am' ? 'ሌሊት (8-12 ሰዓት)' : 'Night (8-12)'; }

      if (maxCount === 0) {
        highestSlot = lang === 'am' ? 'ያልተወሰነ' : 'Flexible';
      }

      return {
        id: a.id,
        name: translateName(a.name, lang),
        role: roleLabel,
        valueMonth,
        visitsMonth,
        clientsMonth,
        retentionRate,
        highestSlot
      };
    }).sort((a, b) => b.valueMonth - a.valueMonth || b.visitsMonth - a.visitsMonth);
  }, [artistsList, allVisits, customers, lang]);

  // Calculate percentages for segment progressive gauges
  const freqCount = analytics.distribution.Frequent;
  const occCount = analytics.distribution.Occasional;
  const riskCount = analytics.distribution['At-Risk'];
  const totalClients = freqCount + occCount + riskCount || 1;

  const freqPct = Math.round((freqCount / totalClients) * 100);
  const occPct = Math.round((occCount / totalClients) * 100);
  const riskPct = Math.round((riskCount / totalClients) * 100);

  // Client-Side Export File downloading - No server dependencies required
  const handleDownload = () => {
    const statusParam = selectedStatus === 'All' ? 'All' : (selectedStatus === 'Green' ? 'Frequent' : selectedStatus === 'Yellow' ? 'Occasional' : 'At-Risk');
    if (exportFormat === 'json') {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(previewList, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `salon_clients_${statusParam.toLowerCase()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else {
      // CSV format
      const headers = ['Full Name', 'Phone Number', 'Birth Date', 'Created At', 'Notes/Preferences'];
      const rows = previewList.map(c => [
        `"${c.full_name.replace(/"/g, '""')}"`,
        `"${c.phone_number.replace(/"/g, '""')}"`,
        `"${(c.birth_date || '').replace(/"/g, '""')}"`,
        `"${(c.created_at || '').replace(/"/g, '""')}"`,
        `"${(c.notes_preferences || '').replace(/"/g, '""')}"`
      ]);
      const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `salon_clients_${statusParam.toLowerCase()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getPredefinedNameTranslated = (name: string) => {
    if (lang === 'am') {
      const mappings: Record<string, string> = {
        'Precision Color Balayage': 'ልዩ የፀጉር ቀለም መቀየር (Balayage)',
        'Hydrafacial Glow': 'ፊት ማጽዳትና ማደስ (Hydrafacial)',
        'Classic Spa Manicure': 'የቅንጦት ጥፍር ውበትና እጅ ማሳጅ (Manicure)',
        'Luxury Pedicure Care': 'የእግር ማጽዳትና ህክምና (Pedicare)',
        'Deep Tissue Massage': 'ደንበኛን ዘና የሚያደርግ የሰውነት ማሳጅ (Deep Tissue)',
        'Keratin Infusion Restoration': 'የፀጉር ምግብና የእንክብካቤ ህክምና (Keratin)',
        'Silk Blowout Style': 'ቅንጦት ፀጉር ማድረቅና ስታይል (Blowout)',
        'Collagen Face Treatment': 'የኮላጅን ፊት ህክምና (Collagen Facial)'
      };
      return mappings[name] || name;
    }
    return name;
  };

  return (
    <div className="space-y-6 font-sans text-neutral-800" id="admin-analytics-view">
      
      {/* Dynamic Sync Trigger Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-50 p-5 rounded-2xl border border-neutral-200/50 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-neutral-900 tracking-tight">{dict.analytics_title}</h3>
          <p className="text-[11px] text-neutral-400 font-medium">{dict.analytics_subtitle}</p>
        </div>
        <button
          className="p-1.5 px-4 self-start sm:self-center rounded-full bg-emerald-50/50 border border-emerald-100 text-[11px] text-emerald-800 font-bold flex items-center gap-1.5 shadow-xs cursor-default select-none"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 relative flex">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          </span>
          {lang === 'am' ? 'ባለበት የነቃ' : 'Live Connected'}
        </button>
      </div>

      {/* 6.1 Multi-Tier Revenue Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Daily card */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200/40 shadow-ios relative overflow-hidden flex flex-col justify-between h-36">
          <div className="absolute top-1 right-2 p-2 text-neutral-100/60 font-black text-6xl select-none leading-none z-0">{lang === 'am' ? 'ዛሬ' : 'TODAY'}</div>
          <div className="z-10">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">{dict.card_daily}</span>
            <span className="text-3xl font-extrabold text-neutral-900 mt-1.5 block">
              ETB {analytics?.revenue.daily.toFixed(2)}
            </span>
          </div>
          <div className="text-[10px] text-neutral-600 font-medium z-10 flex flex-wrap gap-1.5 pt-2 border-t border-neutral-200/40">
            {Object.keys(analytics?.revenue.dailyBreakdown || {}).length === 0 ? (
              <span className="italic text-neutral-400">{dict.no_transactions_today}</span>
            ) : (
              Object.entries(analytics?.revenue.dailyBreakdown || {}).map(([c, amt]) => (
                <span key={c} className="bg-neutral-50 px-2 py-0.5 rounded-full border border-neutral-200 block text-[9px] font-bold text-neutral-700">
                  {c === 'Telebirr' ? (lang === 'am' ? 'ቴሌብር' : 'Telebirr') :
                   c === 'CBE Birr' ? (lang === 'am' ? 'ሲቢኢ ብር' : 'CBE Birr') :
                   c === 'M-Pesa' ? (lang === 'am' ? 'ኤም-ፔሳ' : 'M-Pesa') :
                   c === 'Bank Transfer' ? (lang === 'am' ? 'ባንክ ማስተላለፍ' : 'Bank Transfer') :
                   c === 'Cash' ? (lang === 'am' ? 'ጥሬ ገንዘብ' : 'Cash') : (lang === 'am' ? 'ካርድ' : c)}: <strong>{Number(amt).toFixed(0)} ETB</strong>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Weekly card */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200/40 shadow-ios relative overflow-hidden flex flex-col justify-between h-36">
          <div className="absolute top-1 right-2 p-2 text-neutral-100/60 font-black text-6xl select-none leading-none z-0">{lang === 'am' ? 'ሳምንት' : 'WEEK'}</div>
          <div className="z-10">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">{dict.card_weekly}</span>
            {userRole === 'admin' ? (
              <>
                <span className="text-3xl font-extrabold text-neutral-900 mt-1.5 block">
                  ETB {analytics?.revenue.weekly.toFixed(2)}
                </span>
                <p className="text-[10px] text-neutral-500 font-semibold mt-1 block">{dict.rolling_7_days}</p>
              </>
            ) : (
              <div className="mt-2.5 space-y-1">
                <span className="text-2xl font-extrabold text-neutral-300 tracking-widest block">ETB ••••</span>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200/30 px-2 py-0.5 rounded-full">
                  🔒 {lang === 'am' ? 'ለአስተዳዳሪ ብቻ' : 'Admin Authorization Required'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Monthly card */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200/40 shadow-ios relative overflow-hidden flex flex-col justify-between h-36">
          <div className="absolute top-1 right-2 p-2 text-neutral-100/60 font-black text-6xl select-none leading-none z-0">{lang === 'am' ? 'ወር' : 'MONTH'}</div>
          <div className="z-10">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">{dict.card_monthly}</span>
            {userRole === 'admin' ? (
              <>
                <span className="text-3xl font-extrabold text-neutral-900 mt-1.5 block">
                  ETB {analytics?.revenue.monthly.toFixed(2)}
                </span>
                <p className="text-[10px] text-neutral-400 font-semibold mt-1">{dict.calendar_month}</p>
              </>
            ) : (
              <div className="mt-2.5 space-y-1">
                <span className="text-2xl font-extrabold text-neutral-300 tracking-widest block">ETB ••••</span>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200/30 px-2 py-0.5 rounded-full">
                  🔒 {lang === 'am' ? 'ለአስተዳዳሪ ብቻ' : 'Admin Authorization Required'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left Hand: Custom Date Range Queries & Client Segment Distribs */}
        <div className="space-y-6">
          
          {/* Dynamic Stylist Performance Hub */}
          <div className="bg-white p-6 rounded-[24px] border border-neutral-200/50 shadow-ios space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#A89F91]" />
                <h3 className="text-xs font-bold text-neutral-850 uppercase tracking-wider">
                  {lang === 'am' ? 'የባለሙያዎች የክንውን ማዕከል' : 'Dynamic Stylist Performance Hub'}
                </h3>
              </div>
              <span className="text-[10px] font-bold text-neutral-400 font-mono uppercase bg-neutral-50 px-2 py-0.5 border border-neutral-200/40 rounded-md">
                {lang === 'am' ? 'በዚህ ወር' : 'THIS MONTH'}
              </span>
            </div>

            <p className="text-[11px] text-neutral-400 leading-relaxed font-medium">
              {lang === 'am' 
                ? 'በዚህ ወር የባለሙያዎችን የስራ ክንውን፣ ያስመዘገቡትን ጠቅላላ ገቢ እና ያገለገሏቸውን ደንበኞች ብዛት ይከታተሉ።' 
                : 'Monthly performance tracker of salon stylists, including accumulated earnings and clients served.'}
            </p>

            <div className="space-y-3 pt-2">
              {staffPerformance.length === 0 ? (
                <div className="text-center py-6 text-neutral-400 text-xs font-medium">
                  {lang === 'am' ? 'ምንም ባለሙያዎች አልተመዘገቡም።' : 'No stylists registered.'}
                </div>
              ) : (
                staffPerformance.map((item) => (
                  <div key={item.id} className="p-3 bg-neutral-50 hover:bg-neutral-100/50 rounded-2xl border border-neutral-200/40 flex items-center justify-between transition-all duration-300">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#FAF9F6] border border-[#E5D5C8]/40 flex items-center justify-center font-bold text-neutral-700 text-xs shrink-0">
                        {item.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-neutral-800">{item.name}</p>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-neutral-150 text-neutral-600 border border-neutral-200/45">
                            {item.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-neutral-400 font-medium">
                          <span>
                            {lang === 'am' ? 'ደንበኞች በዚህ ወር: ' : 'Clients this Month: '} 
                            <span className="font-bold text-neutral-700">{item.clientsMonth}</span>
                          </span>
                          <span className="w-1 h-1 rounded-full bg-neutral-300" />
                          <span>
                            {lang === 'am' ? 'ቀጠሮዎች በዚህ ወር: ' : 'Visits this Month: '} 
                            <span className="font-bold text-neutral-700">{item.visitsMonth}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <div className="text-xs font-extrabold text-neutral-900 font-mono">
                        ETB {item.valueMonth.toFixed(0)}
                      </div>
                      <div>
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200/35 px-2 py-0.5 rounded-md">
                          <Clock className="w-2.5 h-2.5 shrink-0" />
                          {item.highestSlot}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Client Segment Distribution Gauges */}
          <div className="bg-white p-6 rounded-[24px] border border-neutral-200/50 shadow-ios space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-neutral-400" />
                <h3 className="text-xs font-bold text-neutral-850 uppercase tracking-wider">{dict.retention_dist_title}</h3>
              </div>
              <span className="text-[10px] font-bold text-neutral-400 font-mono uppercase bg-neutral-50 px-2.5 py-1 border border-neutral-200/50 rounded-full">{totalClients} {dict.profiles_loaded_label}</span>
            </div>

            <div className="space-y-4">
              
              {/* Segment 1: Green Frequent */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 text-[11px] border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {dict.frequent_segment_lbl}
                  </span>
                  <span className="font-mono text-neutral-400">{freqCount} {lang === 'am' ? 'ደንበኞች' : 'clients'} ({freqPct}%)</span>
                </div>
                <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden border border-neutral-200/30">
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${freqPct}%` }} />
                </div>
              </div>

              {/* Segment 2: Yellow Occasional */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 text-[11px] border border-amber-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {dict.stable_segment_lbl}
                  </span>
                  <span className="font-mono text-neutral-400">{occCount} {lang === 'am' ? 'ደንበኞች' : 'clients'} ({occPct}%)</span>
                </div>
                <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden border border-neutral-200/30">
                  <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${occPct}%` }} />
                </div>
              </div>

              {/* Segment 3: Red At Risk */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-red-800 bg-red-50 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 text-[11px] border border-red-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {dict.atrisk_segment_lbl}
                  </span>
                  <span className="font-mono text-neutral-400">{riskCount} {lang === 'am' ? 'ደንበኞች' : 'clients'} ({riskPct}%)</span>
                </div>
                <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden border border-neutral-200/30">
                  <div className="bg-red-500 h-full rounded-full transition-all duration-500" style={{ width: `${riskPct}%` }} />
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Right Hand: Service Leaderboards & Targeted Segment Data Export */}
        <div className="space-y-6">
          
          {/* Daily History of Payments with Calendar */}
          <div className="bg-white p-6 rounded-[24px] border border-neutral-200/50 shadow-ios space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-neutral-400" />
                <h3 className="text-xs font-bold text-neutral-850 uppercase tracking-wider">
                  {lang === 'am' ? 'የዕለት ክፍያ ታሪክ' : 'Daily Payment History'}
                </h3>
              </div>
              {allVisits && (
                <span className="text-[10px] font-mono font-bold bg-neutral-100 text-neutral-600 px-2.5 py-0.5 rounded-full border border-neutral-200/40">
                  {allVisits.filter(v => v.visit_date && v.visit_date.split('T')[0] === selectedHistoryDate).reduce((acc, curr) => acc + (curr.price_charged || 0), 0).toLocaleString()} ETB
                </span>
              )}
            </div>

            {/* Calendar Controls (Calendar on the Top of History) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-neutral-50 p-2 rounded-2xl border border-neutral-200/40">
                <button
                  type="button"
                  onClick={() => {
                    const prev = new Date(selectedHistoryDate);
                    prev.setDate(prev.getDate() - 1);
                    const prevStr = prev.toISOString().split('T')[0];
                    if (userRole !== 'admin' && prevStr < minAllowedDateStr) {
                      return; // restricted
                    }
                    setSelectedHistoryDate(prevStr);
                  }}
                  disabled={userRole !== 'admin' && selectedHistoryDate <= minAllowedDateStr}
                  className={`p-2 rounded-xl transition-all border border-transparent ${
                    userRole !== 'admin' && selectedHistoryDate <= minAllowedDateStr
                      ? 'opacity-30 cursor-not-allowed'
                      : 'hover:bg-white hover:border-neutral-200/40 cursor-pointer'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4 text-neutral-600" />
                </button>
                
                {/* Date Input Box */}
                <div className="relative flex items-center gap-1 cursor-pointer">
                  <input
                    type="date"
                    value={selectedHistoryDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (userRole !== 'admin') {
                        if (val < minAllowedDateStr) {
                          setSelectedHistoryDate(minAllowedDateStr);
                          return;
                        }
                        if (val > maxAllowedDateStr) {
                          setSelectedHistoryDate(maxAllowedDateStr);
                          return;
                        }
                      }
                      setSelectedHistoryDate(val);
                    }}
                    min={userRole !== 'admin' ? minAllowedDateStr : undefined}
                    max={userRole !== 'admin' ? maxAllowedDateStr : undefined}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full z-10"
                    id="picker-history-date"
                  />
                  <span className="text-xs font-bold text-neutral-850 underline decoration-dotted decoration-neutral-400 underline-offset-4 cursor-pointer">
                    {new Date(selectedHistoryDate).toLocaleDateString(lang === 'am' ? 'am-ET' : 'en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const next = new Date(selectedHistoryDate);
                    next.setDate(next.getDate() + 1);
                    const nextStr = next.toISOString().split('T')[0];
                    if (userRole !== 'admin' && nextStr > maxAllowedDateStr) {
                      return; // restricted
                    }
                    setSelectedHistoryDate(nextStr);
                  }}
                  disabled={userRole !== 'admin' && selectedHistoryDate >= maxAllowedDateStr}
                  className={`p-2 rounded-xl transition-all border border-transparent ${
                    userRole !== 'admin' && selectedHistoryDate >= maxAllowedDateStr
                      ? 'opacity-30 cursor-not-allowed'
                      : 'hover:bg-white hover:border-neutral-200/40 cursor-pointer'
                  }`}
                >
                  <ChevronRight className="w-4 h-4 text-neutral-600" />
                </button>
              </div>

              {/* Horizontal slider for the surrounding 5 days */}
              <div className="grid grid-cols-5 gap-1 text-center">
                {(() => {
                  const base = new Date(selectedHistoryDate);
                  const result = [];
                  for (let i = -2; i <= 2; i++) {
                    const temp = new Date(base);
                    temp.setDate(base.getDate() + i);
                    result.push(temp);
                  }
                  return result;
                })().map((d) => {
                  const slug = d.toISOString().split('T')[0];
                  const isSelected = slug === selectedHistoryDate;
                  const isRestricted = userRole !== 'admin' && (slug < minAllowedDateStr || slug > maxAllowedDateStr);
                  const weekday = d.toLocaleDateString(lang === 'am' ? 'am-ET' : 'en-US', { weekday: 'narrow' });
                  const dayNum = d.getDate();
                  return (
                    <button
                      key={slug}
                      type="button"
                      disabled={isRestricted}
                      onClick={() => setSelectedHistoryDate(slug)}
                      className={`py-1.5 px-1 rounded-xl border flex flex-col items-center justify-center transition-all ${
                        isRestricted
                          ? 'bg-neutral-50 border-neutral-200/20 text-neutral-300 cursor-not-allowed opacity-40'
                          : isSelected
                          ? 'bg-neutral-900 border-neutral-900 text-white shadow-sm cursor-pointer'
                          : 'bg-white hover:bg-neutral-50 border-neutral-200/50 text-neutral-650 cursor-pointer'
                      }`}
                      title={isRestricted ? (lang === 'am' ? 'የአስተዳዳሪ ብቻ ታሪክ' : 'Admin Only History') : undefined}
                    >
                      <span className="text-[9px] uppercase tracking-wider font-extrabold opacity-60">
                        {isRestricted ? '🔒' : weekday}
                      </span>
                      <span className="text-xs font-black font-mono">{dayNum}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* List of Payments */}
            <div className="divide-y divide-neutral-100 max-h-72 overflow-y-auto pr-1" id="history-payment-list">
              {(() => {
                const visitsToDisplay = (allVisits || []).filter(v => v.visit_date && v.visit_date.split('T')[0] === selectedHistoryDate);
                if (visitsToDisplay.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <p className="text-xs text-neutral-400 italic">
                        {lang === 'am' ? 'በዚህ ቀን ምንም ክፍያዎች አልተመዘገቡም' : 'No payments registered on this date'}
                      </p>
                    </div>
                  );
                }

                return visitsToDisplay.map((v) => {
                  const client = (customers || []).find(c => c.id === v.customer_id);
                  const clientName = client ? client.full_name : (lang === 'am' ? 'የውጭ ደንበኛ (Walk-in)' : 'Walk-in Guest');
                  const timeStr = v.visit_date ? new Date(v.visit_date).toLocaleTimeString(lang === 'am' ? 'am-ET' : 'en-US', {
                    hour: 'numeric',
                    minute: '2-digit'
                  }) : '';

                  const itemsArr = Array.isArray(v.items_used) ? v.items_used : [];
                  
                  return (
                    <div key={v.id} className="py-3.5 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <p className="font-extrabold text-neutral-850">{clientName}</p>
                          {timeStr && <p className="text-[9px] font-mono text-neutral-400 mt-0.5">{timeStr}</p>}
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-neutral-850 font-mono text-xs">{v.price_charged || 0} ETB</span>
                          <span className="block text-[8px] font-bold text-neutral-400 uppercase tracking-wider mt-0.5">
                            {v.payment_method || (lang === 'am' ? 'ያልታወቀ' : 'Unknown')}
                          </span>
                        </div>
                      </div>

                      {/* Service pills inside list */}
                      {itemsArr.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {itemsArr.map((itemId) => {
                            const def = (salonServices || []).find(s => s.id === itemId);
                            const name = def ? def.name : itemId;
                            return (
                              <span key={itemId} className="text-[9px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-md font-medium border border-neutral-200/20">
                                {getPredefinedNameTranslated(name)}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Artist and Equipment Badges */}
                      {(v.assigned_staff_id || v.equipment_used) && (
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                          {v.assigned_staff_id && (() => {
                            const ids = v.assigned_staff_id.split(',').map(s => s.trim()).filter(Boolean);
                            return ids.map(id => {
                              const matchedStaff = (artistsList || []).find(s => s.id === id) || staffList.find(s => s.id === id);
                              if (!matchedStaff) return null;
                              let roleLabelStr = '';
                              if ('role' in matchedStaff) {
                                const role = (matchedStaff as any).role;
                                if (role === 'cashier') {
                                  roleLabelStr = lang === 'am' ? 'ካሽየር' : 'Cashier';
                                } else if (role === 'assistant') {
                                  roleLabelStr = lang === 'am' ? 'ረዳት' : 'Assistant';
                                } else {
                                  roleLabelStr = lang === 'am' ? 'የውበት ባለሙያ' : 'Treatment Artist';
                                }
                              } else {
                                roleLabelStr = lang === 'am' ? 'የውበት ባለሙያ' : 'Treatment Artist';
                              }
                              return (
                                <span key={id} className="inline-flex items-center gap-1 text-[9px] font-bold bg-neutral-150 text-neutral-700 px-1.5 py-0.5 rounded border border-neutral-200/30">
                                  👤 {translateName(matchedStaff.name, lang)} ({roleLabelStr})
                                </span>
                              );
                            });
                          })()}
                          {v.equipment_used && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-100/55">
                              🛠️ {v.equipment_used}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Export Center Container */}
          <div className="bg-white p-6 rounded-[24px] border border-neutral-200/50 shadow-ios space-y-4" id="target-export-card">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-neutral-400" />
              <h3 className="text-xs font-bold text-neutral-850 uppercase tracking-wider">{dict.export_center_title}</h3>
            </div>
            <p className="text-[11px] text-neutral-400">{dict.export_center_desc}</p>

            <div className="grid grid-cols-2 gap-2 bg-neutral-50 p-3 rounded-2xl border border-neutral-200/40">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">{dict.export_segment_label}</label>
                <select
                  value={selectedStatus}
                  onChange={(e: any) => setSelectedStatus(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-neutral-250 outline-none p-2 rounded-xl text-neutral-800 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all cursor-pointer"
                  id="export-status-select"
                >
                  <option value="All">{lang === 'am' ? 'ሁሉም ደንበኞች (All)' : 'All Customers (All)'}</option>
                  <option value="Green">{dict.frequent_segment_lbl}</option>
                  <option value="Yellow">{dict.stable_segment_lbl}</option>
                  <option value="Red">{dict.atrisk_segment_lbl}</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">{dict.export_format_label}</label>
                <select
                  value={exportFormat}
                  onChange={(e: any) => setExportFormat(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-neutral-250 outline-none p-2 rounded-xl text-neutral-800 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all cursor-pointer"
                  id="export-format-select"
                >
                  <option value="csv">{lang === 'am' ? 'ሲኤስቪ (CSV)' : 'CSV Spreadsheet'}</option>
                  <option value="json">{lang === 'am' ? 'ጄሰን (JSON)' : 'JSON Document'}</option>
                </select>
              </div>
            </div>

            {/* Direct download trigger button */}
            <button
              onClick={handleDownload}
              className="w-full py-3 bg-neutral-900 hover:bg-neutral-850 text-white font-bold text-xs rounded-full flex items-center justify-center gap-2 transition-all duration-200 shadow-ios ios-active-scale"
              id="btn-commence-download"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              {dict.download_btn} ({selectedStatus === 'All' ? (lang === 'am' ? 'ሁሉም' : 'All') : (selectedStatus === 'Green' ? dict.frequent_segment_lbl : selectedStatus === 'Yellow' ? dict.stable_segment_lbl : dict.atrisk_segment_lbl)})
            </button>

            {/* Inline list preview  */}
            <div className="border border-neutral-200/50 rounded-2xl overflow-hidden bg-neutral-50 p-3.5 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-extrabold text-neutral-500 uppercase tracking-wider text-[10px]">{dict.preview_title} ({previewList.length}):</span>
                {previewList.length > 0 && (
                  <span className="text-[9px] bg-white font-mono text-neutral-400 px-2.5 py-0.5 rounded-full border border-neutral-200/75 font-bold">
                    {dict.preview_active_badge}
                  </span>
                )}
              </div>
              
              {previewList.length === 0 ? (
                <p className="text-[11px] text-neutral-400 italic text-center py-4">{dict.no_customers_in_segment}</p>
              ) : (
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1" id="export-preview-list">
                  {previewList.map(item => (
                    <div key={item.id} className="text-[11px] p-2.5 bg-white rounded-xl border border-neutral-200/40 flex justify-between items-center shadow-xs">
                      <div>
                        <p className="font-bold text-neutral-800">{item.full_name}</p>
                        <p className="text-neutral-400 text-[10px] font-mono mt-0.5">{item.phone_number}</p>
                      </div>
                      <span className="text-[10px] text-neutral-400 italic block">
                        {dict.last_seen_prefix} {item.lastVisitDate ? new Date(item.lastVisitDate).toLocaleDateString(lang === 'am' ? 'am-ET' : 'en-US') : (lang === 'am' ? 'አሁን' : 'Never')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
