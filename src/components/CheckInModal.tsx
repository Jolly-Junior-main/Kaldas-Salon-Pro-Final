/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CustomerWithRetention, PaymentMethod, SalonService, Language, Visit, StaffMember, TreatmentArtist, UserRole, DEFAULT_SMS_TEMPLATES, formatSmsTemplate } from '../types';
import { Dict, translateName, translateSkills, translateServiceName, translateCategory } from '../translations';
import { Search, X, Check, Landmark, CreditCard, DollarSign, Receipt, Sparkles, Coins, Users, Hammer, Lock, PlusCircle, ShieldCheck } from 'lucide-react';
import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError, cleanUndefined } from '../lib/firebase';
import { classifyCustomer } from '../lib/retention';

interface CheckInModalProps {
  customers: CustomerWithRetention[];
  preSelectedCustomer?: CustomerWithRetention | null;
  preSelectedServiceIds?: string[];
  preSelectedArtistIds?: string[];
  onClose: () => void;
  onVisitLogged: (updatedCustomer: CustomerWithRetention) => void;
  lang: Language;
  dict: Dict;
  salonServices?: SalonService[];
  allVisits?: Visit[];
  staffList?: StaffMember[];
  artistsList?: TreatmentArtist[];
  userRole?: UserRole | null;
}

export default function CheckInModal({
  customers,
  preSelectedCustomer,
  preSelectedServiceIds,
  preSelectedArtistIds,
  onClose,
  onVisitLogged,
  lang,
  dict,
  salonServices = [],
  allVisits = [],
  staffList = [],
  artistsList = [],
  userRole
}: CheckInModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [priceCharged, setPriceCharged] = useState<number>(0);
  const [paymentChannel, setPaymentChannel] = useState<PaymentMethod>('Cash');
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Locked walk-in registered services & Cashier extra additions
  const [lockedWalkinServiceIds, setLockedWalkinServiceIds] = useState<string[]>([]);
  const [cashierExtraServiceIds, setCashierExtraServiceIds] = useState<string[]>([]);
  const [cashierNotes, setCashierNotes] = useState('');

  // Custom added features states
  const [selectedArtistIds, setSelectedArtistIds] = useState<string[]>([]);
  const [equipmentUsed, setEquipmentUsed] = useState('');

  // Birthday checkout override pop-up state
  const [showBirthdayOverlay, setShowBirthdayOverlay] = useState(false);

  const isBirthdayToday = (birthDateStr?: string) => {
    if (!birthDateStr) return false;
    const bdate = new Date(birthDateStr);
    const today = new Date();
    // Use UTC or local uniformly to avoid timezone mismatch
    const birthDateLocalObj = new Date(birthDateStr);
    return birthDateLocalObj.getMonth() === today.getMonth() && birthDateLocalObj.getDate() === today.getDate();
  };

  const selectedClient = customers.find(c => c.id === selectedCustomerId);

  useEffect(() => {
    if (selectedClient && selectedClient.retentionStatus === 'Frequent' && isBirthdayToday(selectedClient.birth_date)) {
      setShowBirthdayOverlay(true);
      setPriceCharged(0);
    } else {
      setShowBirthdayOverlay(false);
    }
  }, [selectedCustomerId]);

  // Initialize if pre-selected customer/services/artists were handed in
  useEffect(() => {
    if (preSelectedCustomer) {
      setSelectedCustomerId(preSelectedCustomer.id);
    }
  }, [preSelectedCustomer]);

  useEffect(() => {
    if (preSelectedServiceIds && preSelectedServiceIds.length > 0) {
      setLockedWalkinServiceIds(preSelectedServiceIds);
      setSelectedServices(preSelectedServiceIds);
    }
  }, [preSelectedServiceIds]);

  useEffect(() => {
    if (preSelectedArtistIds && preSelectedArtistIds.length > 0) {
      setSelectedArtistIds(preSelectedArtistIds);
    }
  }, [preSelectedArtistIds]);

  // Keep selectedServices updated as the combination of locked walk-in + cashier extra additions
  useEffect(() => {
    const combined = Array.from(new Set([...lockedWalkinServiceIds, ...cashierExtraServiceIds]));
    setSelectedServices(combined);
  }, [lockedWalkinServiceIds, cashierExtraServiceIds]);

  // Handle service state price aggregation
  useEffect(() => {
    const total = selectedServices.reduce((sum, sId) => {
      const match = salonServices.find(s => s.id === sId);
      return sum + (match ? match.defaultPrice : 0);
    }, 0);
    setPriceCharged(total);
  }, [selectedServices, salonServices]);

  // Filter clients based on search query
  const filteredCustomers = searchQuery.trim() === ''
    ? customers.slice(0, 5)
    : customers.filter(c =>
        (c?.full_name || (c as any)?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c?.phone_number || '').includes(searchQuery)
      );

  const toggleServiceSelection = (id: string) => {
    if (selectedServices.includes(id)) {
      setSelectedServices(selectedServices.filter(sId => sId !== id));
    } else {
      setSelectedServices([...selectedServices, id]);
    }
  };

  const handlePostVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setErrorText(lang === 'am' ? 'እባክዎ መጀመሪያ የደንበኛ መገለጫ ይምረጡ ወይም ይፈልጉ።' : 'Please select or search a client profile first before submitting.');
      return;
    }
    if (selectedServices.length === 0) {
      setErrorText(lang === 'am' ? 'እባክዎ ቢያንስ አንድ የውበት አገልግሎት ወይም ምርት ይምረጡ።' : 'Please select at least one beauty service or product.');
      return;
    }
    if (priceCharged === undefined || isNaN(priceCharged) || priceCharged < 0) {
      setErrorText(lang === 'am' ? 'እባክዎ ትክክለኛ ዋጋ መጠን ያስገቡ።' : 'Please specify a valid price amount.');
      return;
    }

    setIsSaving(true);
    setErrorText('');

    try {
      const visitDate = new Date().toISOString();
      const newVisitRef = doc(collection(db, 'visits'));
      const visitId = newVisitRef.id;
      const rawClientName = selectedClient?.full_name || (preSelectedCustomer as any)?.customer_name || (preSelectedCustomer as any)?.full_name || (preSelectedCustomer as any)?.name || searchQuery.trim();
      const clientName = (rawClientName && rawClientName !== 'Valued Client' && rawClientName !== 'Client Visit' && rawClientName !== 'Valued Clients' && rawClientName !== 'Valued Customer')
        ? rawClientName
        : (selectedClient?.phone_number || (preSelectedCustomer as any)?.phone_number ? `Client (${selectedClient?.phone_number || (preSelectedCustomer as any)?.phone_number})` : 'Walk-in Client');
      const clientPhone = selectedClient?.phone_number || (preSelectedCustomer as any)?.phone_number || '';

      const combinedItems = Array.from(new Set([...lockedWalkinServiceIds, ...cashierExtraServiceIds, ...selectedServices]));

      const newVisit: Visit = {
        id: visitId,
        customer_id: selectedCustomerId,
        customer_name: clientName,
        phone_number: clientPhone,
        items_used: combinedItems,
        walkin_service_ids: lockedWalkinServiceIds.length > 0 ? lockedWalkinServiceIds : undefined,
        cashier_service_ids: cashierExtraServiceIds.length > 0 ? cashierExtraServiceIds : undefined,
        cashier_notes: cashierNotes.trim() || undefined,
        price_charged: Number(priceCharged),
        payment_method: paymentChannel,
        visit_date: visitDate,
      };

      if (selectedArtistIds && selectedArtistIds.length > 0) {
        newVisit.assigned_staff_id = selectedArtistIds.join(',');
      }
      if (equipmentUsed && equipmentUsed.trim()) {
        newVisit.equipment_used = equipmentUsed.trim();
      }

      await setDoc(newVisitRef, cleanUndefined(newVisit));
      setIsSuccess(true);

      // Send Real-time Visit Completed / Payment Received SMS via GeezSMS with fallback
      const recipientPhone = selectedClient?.phone_number || (preSelectedCustomer as any)?.phone_number || '';
      const recipientName = clientName;

      if (recipientPhone) {
        try {
          let isSmsEnabled = true;
          try {
            const smsConfigSnap = await getDoc(doc(db, 'settings', 'sms'));
            isSmsEnabled = smsConfigSnap.exists() ? smsConfigSnap.data().enabled !== false : true;
          } catch (err) {
            console.warn("Firestore settings lookup failed in CheckInModal, using fallback:", err);
          }

          if (!isSmsEnabled) {
            console.log('[GeezSMS] SMS sending is disabled in settings. Skipping SMS dispatch.');
          } else {
            let thanksMsg = '';
            try {
              const templatesSnap = await getDoc(doc(db, 'settings', 'sms_templates'));
              const data = templatesSnap.exists() ? templatesSnap.data() : null;
              const template = lang === 'am'
                ? (data?.billing_am || DEFAULT_SMS_TEMPLATES.billing_am)
                : (data?.billing_en || DEFAULT_SMS_TEMPLATES.billing_en);
              thanksMsg = formatSmsTemplate(template, { name: recipientName, amount: Number(priceCharged) });
            } catch (err) {
              const template = lang === 'am' ? DEFAULT_SMS_TEMPLATES.billing_am : DEFAULT_SMS_TEMPLATES.billing_en;
              thanksMsg = formatSmsTemplate(template, { name: recipientName, amount: Number(priceCharged) });
            }

            const geezToken = 'm3tCICfmNSGx1OweNguDXAhwChkF6m4Q';
            let cleanPhone = recipientPhone.trim().replace(/[\s\-\(\)\+]/g, '');
            if (cleanPhone.startsWith('0')) cleanPhone = '251' + cleanPhone.substring(1);

            try {
              const res = await fetch('/api/sms/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: cleanPhone, message: thanksMsg })
              });
              const contentType = res.headers.get('content-type');
              if (!contentType || !contentType.includes('application/json')) {
                // Direct fallback to GeezSMS API for Cloudflare static environment
                await fetch('https://api.geezsms.com/api/v1/sms/send', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token: geezToken, phone: cleanPhone, msg: thanksMsg })
                });
              }
            } catch (netErr) {
              // Direct fallback to GeezSMS API
              await fetch('https://api.geezsms.com/api/v1/sms/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: geezToken, phone: cleanPhone, msg: thanksMsg })
              });
            }
            console.log('[GeezSMS] Payment Thank You SMS triggered successfully to', cleanPhone);
          }
        } catch (smsErr) {
          console.error('[GeezSMS] Bypassed or failed visit thank you SMS dispatch:', smsErr);
        }
      }
      
      // Calculate updated customer state on the fly of the newly added visit
      setTimeout(() => {
        const activeCustRawInfo = customers.find(c => c.id === selectedCustomerId);
        if (activeCustRawInfo) {
          const simulatedVisits = [...allVisits, newVisit];
          const updatedCustomer = classifyCustomer(activeCustRawInfo, simulatedVisits, new Date());
          onVisitLogged(updatedCustomer);
        }
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorText(err.message || (lang === 'am' ? 'የኔትወርክ ግንኙነት ችግር ተከስቷል።' : 'Network anomaly sending visit record.'));
      handleFirestoreError(err, OperationType.WRITE, 'visits');
    } finally {
      setIsSaving(false);
    }
  };


  // Big, interactive tab options for payment method styling
  const paymentOptions: { key: PaymentMethod; icon: React.ReactNode; desc: string }[] = [
    {
      key: 'Telebirr',
      icon: (
        <div className="flex items-center justify-center font-sans font-extrabold text-[8px] tracking-tighter uppercase px-1 py-0.5 rounded bg-cyan-600 text-white leading-none shadow-xs" style={{ width: '42px', height: '16px' }}>
          <span>tele</span><span className="text-yellow-300 font-black">birr</span>
        </div>
      ),
      desc: lang === 'am' ? 'ቴሌብር' : 'Telebirr Pay'
    },
    {
      key: 'M-Pesa',
      icon: (
        <div className="flex items-center justify-center font-sans font-black text-[8px] tracking-tight uppercase px-1 py-0.5 rounded bg-[#4EAB24] text-white leading-none shadow-xs" style={{ width: '42px', height: '16px' }}>
          <span>M-</span><span className="text-red-500 font-extrabold">Pesa</span>
        </div>
      ),
      desc: lang === 'am' ? 'ኤም-ፔሳ' : 'M-Pesa Pay'
    },
    {
      key: 'CBE Birr',
      icon: (
        <div className="flex items-center justify-center font-sans font-extrabold text-[8px] tracking-tighter uppercase px-1 py-0.5 rounded bg-[#4d148c] text-white leading-none shadow-xs" style={{ width: '42px', height: '16px' }}>
          <span>CBE</span><span className="text-amber-300 font-black">birr</span>
        </div>
      ),
      desc: lang === 'am' ? 'ሲቢኢ ብር' : 'CBE Birr Mobile'
    },
    { key: 'Bank Transfer', icon: <Landmark className="w-4 h-4 text-neutral-600" />, desc: lang === 'am' ? 'ባንክ ማስተላለፍ' : 'Direct Transfer' },
    { key: 'Cash', icon: <Coins className="w-4 h-4 text-neutral-600" />, desc: lang === 'am' ? 'ጥሬ ገንዘብ' : 'Physical Cash' },
    { key: 'Card', icon: <CreditCard className="w-4 h-4 text-neutral-600" />, desc: lang === 'am' ? 'ካርድ ክፍያ' : 'POS Terminal' }
  ];

  // Helper dictionary of predefined service names mapped into beautiful Amharic corresponding types!
  const getServiceName = (srv: SalonService) => {
    return translateServiceName(srv.id, srv.name, lang);
  };

  const getServiceCategoryName = (category: string) => {
    return translateCategory(category, lang);
  };

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-2xl w-[95%] max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-ios-lg z-50 flex flex-col border border-neutral-200/50 animate-fade-in font-sans text-neutral-800" id="check-in-panel">
      {/* Drawer Header */}
      <div className="p-6 border-b border-neutral-200/50 flex items-center justify-between bg-neutral-50/80">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-neutral-500" /> {dict.drawer_title}
          </h2>
          <p className="text-[11px] text-neutral-400 font-medium mt-0.5">{dict.drawer_desc}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors ios-active-scale"
          id="btn-close-modal"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handlePostVisit} className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Step 1: Customer identification search */}
        <div>
          <label className="block text-xs font-bold text-[#A89F91] uppercase tracking-wider mb-2.5">
            {dict.step1_label}
          </label>

          {preSelectedCustomer ? (
            <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/50 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-neutral-850">{preSelectedCustomer.full_name}</p>
                <p className="text-[11px] text-neutral-400 font-mono mt-0.5">{preSelectedCustomer.phone_number}</p>
              </div>
              <span className="text-[10px] uppercase font-extrabold tracking-wider px-3 py-1 bg-neutral-900 text-white rounded-full">
                {dict.active_client}
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder={dict.step1_placeholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-neutral-50 border border-neutral-200/60 rounded-full focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 text-neutral-800 placeholder:text-neutral-400 transition-all"
                  id="client-search-field"
                />
              </div>

              {selectedCustomerId ? (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/50 flex items-center justify-between text-xs text-neutral-850">
                  <span className="truncate">{dict.selected_label} <strong>{selectedClient?.full_name}</strong></span>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerId('')}
                    className="text-neutral-900 hover:underline font-extrabold uppercase text-[10px] tracking-wider"
                  >
                    {dict.change_client}
                  </button>
                </div>
              ) : (
                <div className="border border-neutral-200/60 rounded-2xl divide-y divide-neutral-100 overflow-hidden bg-white max-h-40 overflow-y-auto">
                  {filteredCustomers.length === 0 ? (
                    <p className="p-3 text-xs text-[#A89F91] text-center bg-[#FAF9F6]/50">{dict.no_profiles_match}</p>
                  ) : (
                    filteredCustomers.map(c => {
                      let badgeStyle = 'bg-red-50 text-red-800 border-red-100';
                      if (c.retentionStatus === 'Frequent') {
                        badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-100';
                      } else if (c.retentionStatus === 'Occasional') {
                        badgeStyle = 'bg-amber-50 text-amber-800 border-amber-100';
                      }

                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCustomerId(c.id)}
                          className="w-full px-4 py-3 text-left text-xs hover:bg-neutral-50 flex items-center justify-between transition-colors ios-active-scale"
                        >
                          <div>
                            <p className="font-bold text-neutral-800">{c.full_name}</p>
                            <p className="text-neutral-400 text-[10px] font-mono mt-0.5">{c.phone_number}</p>
                          </div>
                          <span className={`text-[9px] uppercase px-2.5 py-0.5 rounded-full font-extrabold tracking-wider border ${badgeStyle}`}>
                            {c.retentionStatus === 'Frequent' ? (lang === 'am' ? 'ተደጋጋሚ' : 'Frequent') : c.retentionStatus === 'Occasional' ? (lang === 'am' ? 'የተረጋጋ' : 'Stable') : (lang === 'am' ? 'ለማቋረጥ የተቃረበ' : 'At-Risk')}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Registered Walk-in Services & Cashier Extra Additions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-[#A89F91] uppercase tracking-wider">
              {dict.step2_label}
            </label>
            {lockedWalkinServiceIds.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-full">
                <Lock className="w-3 h-3 text-amber-600" />
                {lang === 'am' ? 'የWalk-in አሰራር ተቆልፏል' : 'Walk-in Services Locked'}
              </span>
            )}
          </div>

          {/* Section A: Walk-in Registered Services (Locked for Cashier Security) */}
          {lockedWalkinServiceIds.length > 0 && (
            <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/70 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-amber-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  {lang === 'am' ? '🔒 በWalk-in የተመዘገቡ አገልግሎቶች (መቀየር አይቻልም)' : '🔒 Walk-in Registered Services (Locked)'}
                </h4>
                <span className="text-[10px] font-extrabold text-amber-700 uppercase">
                  {lockedWalkinServiceIds.length} {lang === 'am' ? 'አገልግሎት' : 'Item(s)'}
                </span>
              </div>
              <p className="text-[10px] text-amber-800 font-medium">
                {lang === 'am' 
                  ? 'ለደህንነት እና ጥበቃ ሲባል በWalk-in የተመዘገቡት አገልግሎቶች በካሽየር ሊሰረዙ ወይም ሊቀነሱ አይችሉም።'
                  : 'For security audit control, services registered at the Walk-in station cannot be removed by the Cashier.'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                {lockedWalkinServiceIds.map(id => {
                  const srv = salonServices.find(s => s.id === id);
                  return (
                    <div key={id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-300/60 shadow-xs">
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-neutral-900">{srv ? getServiceName(srv) : id}</span>
                          {srv && <p className="text-[9px] font-bold text-amber-700 uppercase">{getServiceCategoryName(srv.category)}</p>}
                        </div>
                      </div>
                      <span className="text-xs font-bold font-mono text-amber-900">{srv ? `${srv.defaultPrice.toFixed(2)} ETB` : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section B: Cashier Extra Services / Additions */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5 uppercase tracking-wider">
                <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                {lockedWalkinServiceIds.length > 0 
                  ? (lang === 'am' ? '➕ በካሽየር የታከሉ ተጨማሪ አገልግሎቶች (ተጨማሪ)' : '➕ Cashier Additional Services / Extra Items')
                  : dict.step2_desc}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {salonServices.map((srv) => {
                const isLocked = lockedWalkinServiceIds.includes(srv.id);
                const isCashierExtra = cashierExtraServiceIds.includes(srv.id);
                const isSelected = isLocked || isCashierExtra || selectedServices.includes(srv.id);

                return (
                  <button
                    key={srv.id}
                    type="button"
                    disabled={isLocked}
                    onClick={() => {
                      if (isLocked) return;
                      if (isCashierExtra) {
                        setCashierExtraServiceIds(cashierExtraServiceIds.filter(id => id !== srv.id));
                      } else {
                        setCashierExtraServiceIds([...cashierExtraServiceIds, srv.id]);
                      }
                    }}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all duration-200 ios-active-scale ${
                      isLocked
                        ? 'border-amber-300 bg-amber-50/50 cursor-not-allowed opacity-90'
                        : isCashierExtra
                        ? 'border-emerald-600 bg-emerald-50/60 shadow-ios'
                        : isSelected
                        ? 'border-neutral-900 bg-neutral-50 shadow-ios'
                        : 'border-neutral-200 hover:border-neutral-400 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-4 h-4 rounded-md mt-0.5 flex items-center justify-center border transition-colors ${
                        isLocked
                          ? 'bg-amber-600 border-amber-600 text-white'
                          : isCashierExtra
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : isSelected
                          ? 'bg-neutral-900 border-neutral-900 text-white'
                          : 'border-neutral-300 bg-white'
                      }`}>
                        {isLocked ? <Lock className="w-3 h-3 stroke-[2.5]" /> : isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-neutral-800">{getServiceName(srv)}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-bold tracking-widest text-neutral-400 uppercase">{getServiceCategoryName(srv.category)}</span>
                          {isLocked && <span className="text-[8px] font-black text-amber-700 bg-amber-100/80 px-1.5 py-0.2 rounded uppercase">Walk-in</span>}
                          {isCashierExtra && <span className="text-[8px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded uppercase">Cashier Added</span>}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-neutral-800 font-mono">{srv.defaultPrice.toFixed(2)} ETB</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cashier Addition Explanation Note */}
          {cashierExtraServiceIds.length > 0 && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-1.5 animate-fade-in">
              <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                📝 {lang === 'am' ? 'የካሽየር ማብራሪያ ማስታወሻ (ለአስተዳዳሪ ማረጋገጫ)' : 'Cashier Addition Reason / Note (For Admin Audit)'}
              </label>
              <input
                type="text"
                value={cashierNotes}
                onChange={(e) => setCashierNotes(e.target.value)}
                placeholder={lang === 'am' ? 'ለምሳሌ ፦ በደንበኛ ጥያቄ መሰረት ተጨማሪ የጸጉር ታክምና የታከለበት ምክንያት' : 'e.g. Added Hair Treatment & Polish per customer request during payment'}
                className="w-full px-3 py-2 text-xs bg-white border border-emerald-300/70 rounded-xl focus:outline-none focus:border-emerald-700 font-medium text-neutral-800"
              />
            </div>
          )}
        </div>

        {/* Price Override */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-bold text-[#A89F91] uppercase tracking-wider">
              {dict.step3_label}
            </label>
            <span className="text-[10px] text-[#A89F91] italic">{dict.step3_desc}</span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-3.5 text-neutral-400 font-sans text-[10px] font-bold">ETB</span>
            <input
              type="number"
              step="0.01"
              value={priceCharged}
              onChange={(e) => setPriceCharged(Number(e.target.value))}
              placeholder="0.00"
              className="w-full pl-11 pr-4 py-3 text-xs bg-neutral-50 border border-neutral-200/65 rounded-xl focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 font-bold font-mono text-neutral-800 transition-all animate-fade-in"
              id="price-charged-field"
            />
          </div>
        </div>

        {/* Service Provider Selection */}
        <div>
          <label className="block text-xs font-bold text-[#A89F91] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-neutral-400" />
            {lang === 'am' ? 'የውበት ባለሙያዎች (Treatment Artists)' : 'Treatment Artists / Service Providers'}
          </label>
          {artistsList.length === 0 ? (
            <p className="text-xs text-neutral-400 italic">
              {lang === 'am' ? 'ምንም የውበት ባለሙያ አልተመዘገበም።' : 'No treatment artists registered.'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {artistsList.map((m) => {
                const isSelected = selectedArtistIds.includes(m.id);
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedArtistIds(selectedArtistIds.filter((id) => id !== m.id));
                      } else {
                        setSelectedArtistIds([...selectedArtistIds, m.id]);
                      }
                    }}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-neutral-950 border-neutral-950 text-white shadow-ios'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-800 hover:border-neutral-400'
                    }`}
                  >
                    👤 {translateName(m.name, lang)}
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Equipment Used Custom Box Field */}
        <div>
          <label className="block text-xs font-bold text-[#A89F91] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Hammer className="w-3.5 h-3.5 text-[#A89F91]" />
            {lang === 'am' ? 'ጥቅም ላይ የዋሉ እቃዎች / መሳሪያዎች' : 'Equipment or Materials Used'}
          </label>
          <input
            type="text"
            value={equipmentUsed}
            onChange={(e) => setEquipmentUsed(e.target.value)}
            placeholder={lang === 'am' ? 'ለምሳሌ፡ የፀጉር ማድረቂያ፣ የጥፍር ማሽን፣ ቶነር...' : 'e.g. Dyson Hair Dryer, UV Gel Lamp, Steamer, Ceramic Flat Iron...'}
            className="w-full px-4 py-3 text-xs bg-neutral-50 border border-neutral-200/65 rounded-xl focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 font-bold text-neutral-800 transition-all placeholder:text-neutral-400"
            id="equipment-used-field"
          />
        </div>

        {/* Payment Channel Options selector */}
        <div>
          <label className="block text-xs font-bold text-[#A89F91] uppercase tracking-wider mb-2.5">
            {dict.step4_label}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {paymentOptions.map((opt) => {
              const isSelected = paymentChannel === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPaymentChannel(opt.key)}
                  className={`py-2 px-3.5 rounded-2xl border text-left flex flex-col justify-between h-14 transition-all duration-200 ios-active-scale ${
                    isSelected
                      ? 'border-neutral-950 bg-neutral-950 text-white shadow-ios font-medium'
                      : 'border-neutral-200/70 hover:border-neutral-400 bg-neutral-50 text-neutral-800'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className={opt.key === 'Telebirr' || opt.key === 'CBE Birr' || opt.key === 'M-Pesa' ? '' : `p-1 rounded-lg ${isSelected ? 'bg-white/20 text-[#FAF9F6]' : 'bg-[#FAF9F6] text-[#2D2D2D]/70'}`}>
                      {opt.icon}
                    </span>
                    {isSelected && (
                      <div className="w-1.5 h-1.5 bg-[#FAF9F6] rounded-full" />
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold leading-none">
                      {opt.key === 'Telebirr' ? (lang === 'am' ? 'ቴሌብር' : 'Telebirr') : 
                       opt.key === 'CBE Birr' ? (lang === 'am' ? 'ሲቢኢ ብር' : 'CBE Birr') : 
                       opt.key === 'M-Pesa' ? (lang === 'am' ? 'ኤም-ፔሳ' : 'M-Pesa') :
                       opt.key === 'Bank Transfer' ? (lang === 'am' ? 'ባንክ ማስተላለፍ' : 'Bank Transfer') : 
                       opt.key === 'Cash' ? (lang === 'am' ? 'ጥሬ ገንዘብ' : 'Cash') : (lang === 'am' ? 'ካርድ' : 'Card')}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {errorText && (
          <p className="text-xs text-[#804242] bg-[#F2D5D5] p-3 rounded-xl text-center border border-[#804242]/10" id="visit-error-alert">{errorText}</p>
        )}

        {isSuccess && (
          <div className="p-3 bg-[#D1E2D3] text-[#3E5241] text-xs rounded-xl flex items-center justify-center gap-2 border border-[#3E5241]/20 animate-fade-in" id="visit-success-alert">
            <span className="font-bold text-center">{dict.visit_success_banner}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSaving || isSuccess}
          className={`w-full py-3.5 rounded-full font-bold text-xs text-center text-white transition-all duration-200 ios-active-scale shadow-ios ${
            isSuccess ? 'bg-emerald-600' : 'bg-neutral-900 hover:bg-neutral-800 active:scale-[0.98]'
          }`}
          id="btn-confirm-checkin"
        >
          {isSaving ? dict.btn_completing : isSuccess ? (lang === 'am' ? 'ጉብኝት ተመዝግቧል! ✓' : 'Visit Registered! ✓') : dict.btn_complete_visit}
        </button>

      </form>

      {/* Birthday pop-out overlay */}
      {showBirthdayOverlay && (
        <div className="fixed inset-0 bg-neutral-950/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in text-center">
          <div className="bg-white rounded-[32px] p-8 max-w-sm w-full space-y-5 border border-neutral-200/50 shadow-ios-lg animate-scale-up">
            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto border border-amber-100">
              <span className="text-4xl animate-bounce">🎂</span>
            </div>
            <div className="space-y-2">
              <h3 className="text-neutral-900 font-extrabold text-lg tracking-tight">
                {lang === 'am' ? 'መልካም ልደት! 🎉' : 'Happy Birthday! 🎉'}
              </h3>
              <p className="text-xs text-neutral-500 font-medium leading-relaxed">
                {lang === 'am' 
                  ? `${selectedClient?.full_name} ዛሬ ልደትዋ ነው። ተደጋጋሚ ደንበኛ ስለሆነች የዛሬው ህክምና ሙሉ በሙሉ በነጻ ይደረግላታል።` 
                  : `${selectedClient?.full_name} is celebrating their birthday today. Since she is a frequent loyal customer, today's visit is on the house!`}
              </p>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 text-xs font-bold text-emerald-800 uppercase tracking-wider">
              {lang === 'am' ? 'መልካም ልደት ዛሬ በነፃ ነው!' : "Happy Birthday It's on the House today"}
            </div>
            <button
              type="button"
              onClick={() => setShowBirthdayOverlay(false)}
              className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-full font-bold text-xs shadow-ios transition-all active:scale-95"
            >
              {lang === 'am' ? 'አመሰግናለሁ (ቀጥል)' : 'Thank You! 😊'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
