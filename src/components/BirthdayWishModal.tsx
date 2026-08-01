/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Customer, Language } from '../types';
import { X, Send, Gift, Calendar, CheckCircle, Sparkles } from 'lucide-react';
import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface BirthdayWishModalProps {
  customer: Customer;
  lang: Language;
  onClose: () => void;
  onSent?: () => void;
}

export default function BirthdayWishModal({ customer, lang, onClose, onSent }: BirthdayWishModalProps) {
  const [offerType, setOfferType] = useState<'none' | '50_percent' | 'free'>('50_percent');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [smsConfigEnabled, setSmsConfigEnabled] = useState(true);

  // Fetch SMS configuration status
  useEffect(() => {
    const fetchSmsConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'sms'));
        if (snap.exists()) {
          setSmsConfigEnabled(snap.data().enabled !== false);
        }
      } catch (err) {
        console.warn("Firestore settings lookup failed in BirthdayWishModal, using backend API fallback:", err);
        try {
          const apiRes = await fetch('/api/settings/sms-status').then(r => r.json());
          setSmsConfigEnabled(apiRes.enabled !== false);
        } catch (fallbackErr) {
          console.error("Backend SMS status fallback failed in BirthdayWishModal:", fallbackErr);
        }
      }
    };
    fetchSmsConfig();
  }, []);

  // Default templates based on language and offer type
  const getTemplate = (type: 'none' | '50_percent' | 'free', name: string) => {
    if (lang === 'am') {
      if (type === 'none') {
        return `መልካም ልደት ${name}! 🎉 በደስታ እና በውበት የተሞላ አስደሳች ቀን እንዲሆንልዎ ከልብ እንመኛለን። ከካልዳስ ሳሎን! 🎂`;
      } else if (type === '50_percent') {
        return `መልካም ልደት ${name}! 🎉 ልዩ ቀንዎን ለማክበር በሚቀጥለው ጉብኝትዎ ላይ የማንኛውም አገልግሎት የ 50% ቅናሽ በካልዳስ ሳሎን በስጦታ አዘጋጅተንልዎታል። በክፍያ ጊዜ ይህንን መልዕክት ያሳዩ። 🎁`;
      } else {
        return `መልካም ልደት ${name}! 🎉 ልዩ ቀንዎን ለማክበር በሚቀጥለው ጉብኝትዎ ላይ ማንኛውም የውበት አገልግሎት በነጻ በካልዳስ ሳሎን በስጦታ አዘጋጅተንልዎታል። በክፍያ ጊዜ ይህንን መልዕክት ያሳዩ። 🎁🎂`;
      }
    } else {
      if (type === 'none') {
        return `Happy Birthday ${name}! 🎉 Wishing you a wonderful day filled with joy and beauty. From all of us at Kaldas Salon! 🎂`;
      } else if (type === '50_percent') {
        return `Happy Birthday ${name}! 🎉 To celebrate your special day, Kaldas Salon is gifting you a 50% DISCOUNT on your next treatment! Show this message at checkout. 🎁`;
      } else {
        return `Happy Birthday ${name}! 🎉 To celebrate your special day, your next beauty service/treatment at Kaldas Salon is completely FREE! Show this message at checkout. 🎁🎂`;
      }
    }
  };

  // Sync message when offer type or customer changes
  useEffect(() => {
    setMessage(getTemplate(offerType, customer.full_name));
  }, [offerType, customer]);

  const handleSendWish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSending(true);
    try {
      // Send real SMS via backend GeezSMS gateway
      try {
        const smsRes = await fetch('/api/sms/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            phone: customer.phone_number,
            message: message.trim()
          })
        });
        
        if (!smsRes.ok) {
          const errData = await smsRes.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${smsRes.status}`);
        }
      } catch (smsErr: any) {
        console.error('Failed to dispatch real SMS via gateway:', smsErr);
        throw smsErr;
      }

      const wishId = `wish_${Date.now()}`;
      const wishRef = doc(collection(db, 'birthday_wishes'), wishId);
      
      const adminName = localStorage.getItem('kaldas_logged_user') || 'Admin1';

      await setDoc(wishRef, {
        id: wishId,
        customer_id: customer.id,
        customer_name: customer.full_name,
        customer_phone: customer.phone_number,
        message_text: message.trim(),
        offer_type: offerType,
        sent_at: new Date().toISOString(),
        sent_by: adminName,
        status: 'sent_live'
      });

      setSuccess(true);
      if (onSent) onSent();
      setTimeout(() => {
        onClose();
      }, 2200);
    } catch (err: any) {
      console.error('Error saving birthday wish: ', err);
      alert(lang === 'am' 
        ? `መልዕክት ለመላክ አልተቻለም! ስህተት: ${err.message || err}` 
        : `Failed to send/log birthday wish! Error: ${err.message || err}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[28px] border border-neutral-200/50 max-w-md w-full shadow-ios-lg overflow-hidden animate-fade-in relative">
        
        {/* Header */}
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
              <span className="text-base select-none">🎂</span>
            </div>
            <div>
              <h3 className="text-sm font-black text-neutral-900 tracking-tight">
                {lang === 'am' ? 'የልደት ምኞት እና የቅናሽ ማስተዋወቂያ' : 'Birthday Wish & Campaign Creator'}
              </h3>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                {lang === 'am' ? 'አስተዳዳሪ ብቻ' : 'Admin Only Panel'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        {!success ? (
          <form onSubmit={handleSendWish} className="p-5 space-y-4">
            
            {/* Customer Info Badge */}
            <div className="p-3 bg-neutral-55 border border-neutral-200/40 rounded-2xl flex items-center justify-between text-xs font-bold text-neutral-800">
              <div>
                <span className="block text-[9px] text-neutral-400 font-bold uppercase tracking-widest mb-0.5">
                  {lang === 'am' ? 'የደንበኛ ስም' : 'Recipient Client'}
                </span>
                {customer.full_name}
              </div>
              <div className="text-right">
                <span className="block text-[9px] text-neutral-400 font-bold uppercase tracking-widest mb-0.5">
                  {lang === 'am' ? 'ስልክ ቁጥር' : 'Phone Line'}
                </span>
                <span className="font-mono text-neutral-600">{customer.phone_number}</span>
              </div>
            </div>

            {/* Campaign/Promo Offer Type selector */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                <Gift className="w-3 h-3 text-neutral-400" />
                {lang === 'am' ? 'ልዩ የልደት ጉርሻ / ስጦታ' : 'Special Birthday Reward / Offer'}
              </label>
              
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setOfferType('none')}
                  className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all duration-200 ${
                    offerType === 'none'
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                      : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200'
                  }`}
                >
                  {lang === 'am' ? 'ምኞት ብቻ' : 'Wish Only'}
                </button>
                <button
                  type="button"
                  onClick={() => setOfferType('50_percent')}
                  className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all duration-200 flex flex-col items-center justify-center ${
                    offerType === '50_percent'
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                      : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200'
                  }`}
                >
                  <span className="text-[10px] uppercase font-black tracking-widest opacity-80">50% Off</span>
                  <span className="text-[9px] font-medium mt-0.5 opacity-90">{lang === 'am' ? 'ቅናሽ' : 'Discount'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOfferType('free')}
                  className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all duration-200 flex flex-col items-center justify-center ${
                    offerType === 'free'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                      : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200'
                  }`}
                >
                  <span className="text-[10px] uppercase font-black tracking-widest">FREE 🎉</span>
                  <span className="text-[9px] font-medium mt-0.5 opacity-90">{lang === 'am' ? 'ነጻ ስጦታ' : 'Free Gift'}</span>
                </button>
              </div>
            </div>

            {/* Compose SMS Input */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  {lang === 'am' ? 'መልዕክት ይፃፉ (SMS Message Content)' : 'Message Content (Draft SMS)'}
                </label>
                <span className="text-[9px] text-neutral-400 font-mono font-bold">
                  {message.length} {lang === 'am' ? 'ፊደላት' : 'chars'}
                </span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl p-3 text-xs focus:ring-1 focus:ring-neutral-900 focus:outline-none focus:border-neutral-900 font-medium text-neutral-800 leading-relaxed"
                placeholder={lang === 'am' ? 'የልደት ምኞት መልዕክት እዚህ ይፃፉ...' : 'Compose your birthday wish message here...'}
                required
              />
            </div>

            {!smsConfigEnabled && (
              <div className="p-3 bg-amber-50 border border-amber-200/50 rounded-2xl text-[11px] text-amber-800 font-bold flex items-center gap-2 animate-fade-in">
                <span>⚠️</span>
                <span>
                  {lang === 'am' 
                    ? 'በሳሎን ቅንጅቶች ውስጥ የኤስኤምኤስ መላኪያ ጠፍቷል። እባክዎ አስቀድመው ቅንጅቶች ውስጥ ያብሩት።' 
                    : 'SMS sending is disabled in Salon Settings. Please enable it first to send wishes.'}
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 border-t border-neutral-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition-colors"
              >
                {lang === 'am' ? 'ሰርዝ' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSending || !message.trim() || !smsConfigEnabled}
                className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ios-active-scale"
              >
                {isSending ? (
                  <span>{lang === 'am' ? 'በመላክ ላይ...' : 'Sending...'}</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>{lang === 'am' ? 'በኤስኤምኤስ (SMS) ላክ' : 'Send via SMS'}</span>
                  </>
                )}
              </button>
            </div>
            
            <p className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-2 text-center font-bold uppercase tracking-wider mt-1.5 italic">
              ℹ️ {lang === 'am' ? 'የኤስኤምኤስ ጌትዌይ (GeezSMS) ገብቷል! መልዕክቱ በቀጥታ ይላካል።' : 'GeezSMS Gateway active! Birthday wishes are delivered instantly to clients.'}
            </p>

          </form>
        ) : (
          /* Success Screen */
          <div className="p-8 text-center space-y-4 animate-scale-in">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto border border-emerald-100 shadow-xs">
              <CheckCircle className="w-10 h-10 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-neutral-900">
                {lang === 'am' ? 'የልደት ምኞት በተሳካ ሁኔታ ተልኳል!' : 'Birthday Wish Dispatched & Logged!'}
              </h4>
              <p className="text-xs text-neutral-400 font-medium leading-relaxed max-w-xs mx-auto">
                {lang === 'am' 
                  ? 'የልደት ምኞቱ እና የተመረጠው ስጦታ በሲስተሙ ተመዝግቧል። ኤስኤምኤስ በቀጥታ ተልኳል ወደ ' 
                  : 'The birthday wish and selected reward offer have been securely saved. Live SMS dispatched to '}
                <span className="font-mono font-bold text-neutral-800">{customer.phone_number}</span>.
              </p>
            </div>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 font-bold px-3 py-1 rounded-full border border-emerald-100">
                <Sparkles className="w-3 h-3 text-emerald-500" />
                {lang === 'am' ? 'CRM የውሂብ ጎታ ተዘምኗል' : 'CRM Database Synchronized'}
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
