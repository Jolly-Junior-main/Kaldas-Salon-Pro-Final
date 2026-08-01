/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CustomerWithRetention, Language, DEFAULT_SMS_TEMPLATES, formatSmsTemplate } from '../types';
import { Dict } from '../translations';
import { PlusCircle, AlertCircle, Sparkles, X } from 'lucide-react';
import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { classifyCustomer } from '../lib/retention';
import { convertToGregorian, ETHIOPIAN_MONTHS_EN, ETHIOPIAN_MONTHS_AM } from '../lib/ethiopianCalendar';

interface RegistrationFormProps {
  existingCustomers: CustomerWithRetention[];
  onRegisterSuccess: (newCustomer: CustomerWithRetention) => void;
  lang: Language;
  dict: Dict;
  onClose: () => void;
}

export default function RegistrationForm({ existingCustomers, onRegisterSuccess, lang, dict, onClose }: RegistrationFormProps) {
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [notes, setNotes] = useState('');

  // Ethiopian birthday selectors
  const [calendarType, setCalendarType] = useState<'Gregorian' | 'Ethiopian'>('Gregorian');
  const [etYear, setEtYear] = useState(1990);
  const [etMonth, setEtMonth] = useState(1);
  const [etDay, setEtDay] = useState(1);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [matchedCustomer, setMatchedCustomer] = useState<CustomerWithRetention | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Normalize phone number to do an instant validation query
  useEffect(() => {
    const cleanPhone = phoneNumber.trim().replace(/[\s\-\(\)\+]/g, '');
    if (cleanPhone.length < 5) {
      setIsDuplicate(false);
      setMatchedCustomer(null);
      return;
    }

    const matched = existingCustomers.find(c => {
      const existingClean = c.phone_number.replace(/[\s\-\(\)\+]/g, '');
      return existingClean === cleanPhone;
    });

    if (matched) {
      setIsDuplicate(true);
      setMatchedCustomer(matched);
    } else {
      setIsDuplicate(false);
      setMatchedCustomer(null);
    }
  }, [phoneNumber, existingCustomers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phoneNumber.trim()) {
      setErrorMsg(dict.req_warning);
      return;
    }

    if (isDuplicate) {
      setErrorMsg(dict.invalid_dup_phone);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const newCustRef = doc(collection(db, 'customers'));
      const customerId = newCustRef.id;
      const created_at = new Date().toISOString();
      let finalBirthDate: string | null = birthDate || null;
      if (calendarType === 'Ethiopian') {
        const gregDate = convertToGregorian(etYear, etMonth, etDay);
        if (gregDate) {
          const gY = gregDate.getFullYear();
          const gM = String(gregDate.getMonth() + 1).padStart(2, '0');
          const gD = String(gregDate.getDate()).padStart(2, '0');
          finalBirthDate = `${gY}-${gM}-${gD}`;
        }
      }

      const rawCustomer = {
        id: customerId,
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim(),
        birth_date: finalBirthDate,
        created_at,
        notes_preferences: notes.trim() || null
      };

      await setDoc(newCustRef, rawCustomer);

      // Send Welcoming SMS via backend GeezSMS proxy
      try {
        // Check if SMS is enabled in Firestore settings with fallback to backend API
        let isSmsEnabled = true;
        try {
          const smsConfigSnap = await getDoc(doc(db, 'settings', 'sms'));
          isSmsEnabled = smsConfigSnap.exists() ? smsConfigSnap.data().enabled !== false : true;
        } catch (err) {
          console.warn("Firestore settings lookup failed in RegistrationForm, using backend API fallback:", err);
          try {
            const apiRes = await fetch('/api/settings/sms-status').then(r => r.json());
            isSmsEnabled = apiRes.enabled !== false;
          } catch (fallbackErr) {
            console.error("Backend SMS status fallback failed:", fallbackErr);
          }
        }

        if (!isSmsEnabled) {
          console.log('[GeezSMS] SMS sending is disabled in settings. Skipping welcome SMS.');
        } else {
          let welcomeMsg = '';
          try {
            const templatesSnap = await getDoc(doc(db, 'settings', 'sms_templates'));
            const data = templatesSnap.exists() ? templatesSnap.data() : null;
            const template = lang === 'am'
              ? (data?.welcome_am || DEFAULT_SMS_TEMPLATES.welcome_am)
              : (data?.welcome_en || DEFAULT_SMS_TEMPLATES.welcome_en);
            welcomeMsg = formatSmsTemplate(template, { name: fullName.trim() });
          } catch (err) {
            console.warn("Firestore templates lookup failed in RegistrationForm, using default:", err);
            const template = lang === 'am' ? DEFAULT_SMS_TEMPLATES.welcome_am : DEFAULT_SMS_TEMPLATES.welcome_en;
            welcomeMsg = formatSmsTemplate(template, { name: fullName.trim() });
          }

          await fetch('/api/sms/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              phone: phoneNumber.trim(),
              message: welcomeMsg
            })
          });
          console.log('[GeezSMS] Welcome SMS triggered successfully');
        }
      } catch (smsErr) {
        console.error('[GeezSMS] Bypassed or failed welcome SMS dispatch:', smsErr);
      }
      
      const classified = classifyCustomer(
        {
          id: rawCustomer.id,
          full_name: rawCustomer.full_name,
          phone_number: rawCustomer.phone_number,
          birth_date: rawCustomer.birth_date || undefined,
          created_at: rawCustomer.created_at,
          notes_preferences: rawCustomer.notes_preferences || undefined
        },
        [],
        new Date()
      );

      setShowSuccess(true);
      onRegisterSuccess(classified);
      
      // Reset State
      setFullName('');
      setPhoneNumber('');
      setBirthDate('');
      setNotes('');
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || (lang === 'am' ? 'የግንኙነት ችግር አጋጥሟል።' : 'System connectivity issue.'));
      handleFirestoreError(err, OperationType.WRITE, 'customers');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-[#2D2D2D]/40 backdrop-blur-xs z-40 animate-fade-in transition-opacity" 
        onClick={onClose}
      />

      {/* Centered Modal */}
      <div 
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-md w-[95%] bg-white rounded-3xl shadow-ios-lg z-50 flex flex-col border border-neutral-200/50 animate-fade-in font-sans text-neutral-800 p-6 max-h-[90vh] overflow-y-auto"
        id="registration-panel-modal"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute right-5 top-5 p-2 rounded-full hover:bg-neutral-100 transition-colors text-neutral-400 hover:text-neutral-700"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-5 mt-1 pr-8">
          <div className="p-2 rounded-xl bg-neutral-100 text-neutral-800">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold font-sans text-neutral-900 tracking-tight">{dict.reg_title}</h2>
            <p className="text-[11px] text-neutral-400 font-medium">{dict.reg_desc}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">
              {dict.label_fullname} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={lang === 'am' ? 'ለምሳሌ ፦ አበባ መንግስቱ' : 'e.g. Abeba Mengistu'}
              className="w-full px-4 py-2.5 text-sm bg-neutral-50 border border-neutral-200/65 rounded-xl focus:outline-none focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 placeholder:text-neutral-300 text-neutral-800 transition-all font-medium"
              id="reg-fullname"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">
              {dict.label_phone} <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder={lang === 'am' ? 'ለምሳሌ ፦ +251 911 234 567' : 'e.g. +251 911 234 567'}
              className={`w-full px-4 py-2.5 text-sm bg-neutral-50 border rounded-xl focus:outline-none focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 placeholder:text-neutral-300 text-neutral-800 transition-all font-mono font-medium ${
                isDuplicate ? 'border-red-400 focus:ring-red-400/30 focus:border-red-400' : 'border-neutral-200/65'
              }`}
              id="reg-phone"
            />

            {/* Real-time floating check duplicate warning */}
            {isDuplicate && matchedCustomer && (
              <div className="mt-2.5 flex items-start gap-2 p-3 bg-red-50 rounded-xl text-red-600 text-xs animate-fade-in border border-red-100">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <div>
                  <span className="font-bold">{dict.dup_warning}</span> {dict.dup_desc.replace('matches.', `matches ${matchedCustomer.full_name}.`)}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  {dict.label_birthday}
                </label>
                
                {/* Calendar Type Selector */}
                <div className="flex bg-neutral-100 p-0.5 rounded-lg text-[9px] font-extrabold uppercase border border-neutral-200/30">
                  <button
                    type="button"
                    onClick={() => setCalendarType('Gregorian')}
                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                      calendarType === 'Gregorian'
                        ? 'bg-white text-neutral-850 shadow-xs'
                        : 'text-neutral-400'
                    }`}
                  >
                    GREG
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarType('Ethiopian')}
                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                      calendarType === 'Ethiopian'
                        ? 'bg-white text-neutral-850 shadow-xs'
                        : 'text-neutral-400'
                    }`}
                  >
                    ETH
                  </button>
                </div>
              </div>

              {calendarType === 'Gregorian' ? (
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-neutral-50 border border-neutral-200/65 rounded-xl focus:outline-none focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 text-neutral-800 transition-all font-medium"
                  id="reg-birthdate"
                />
              ) : (
                <div className="flex gap-1">
                  {/* Month */}
                  <select
                    value={etMonth}
                    onChange={(e) => setEtMonth(parseInt(e.target.value, 10))}
                    className="w-[45%] text-[11px] font-bold bg-neutral-50 border border-neutral-200/65 rounded-xl outline-none focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 text-neutral-800 transition-all cursor-pointer py-2 px-1 text-center"
                  >
                    {(lang === 'am' ? ETHIOPIAN_MONTHS_AM : ETHIOPIAN_MONTHS_EN).map((mName, ix) => (
                      <option key={ix} value={ix + 1}>
                        {mName.substring(0, 5)}
                      </option>
                    ))}
                  </select>

                  {/* Day */}
                  <select
                    value={etDay}
                    onChange={(e) => setEtDay(parseInt(e.target.value, 10))}
                    className="w-[25%] text-[11px] font-bold bg-neutral-50 border border-neutral-200/65 rounded-xl outline-none focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 text-neutral-800 transition-all cursor-pointer py-2 px-1 text-center"
                  >
                    {Array.from({ length: etMonth === 13 ? 6 : 30 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>

                  {/* Year */}
                  <select
                    value={etYear}
                    onChange={(e) => setEtYear(parseInt(e.target.value, 10))}
                    className="w-[30%] text-[11px] font-bold bg-neutral-50 border border-neutral-200/65 rounded-xl outline-none focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 text-neutral-800 transition-all cursor-pointer py-2 px-1 text-center font-mono"
                  >
                    {Array.from({ length: 90 }, (_, i) => 2018 - i).map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">
                {dict.label_sensitivities}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={lang === 'am' ? 'ለምሳሌ ፦ ለኬሚካል ቀለሞች ስሜታዊ ናት' : 'e.g. Sensitive to chemical dyes'}
                className="w-full px-4 py-2.5 text-sm bg-neutral-50 border border-neutral-200/65 rounded-xl focus:outline-none focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 placeholder:text-neutral-300 text-neutral-800 transition-all font-medium"
                id="reg-notes"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl flex items-center gap-1.5 border border-red-100 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {showSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-xl flex items-center gap-1.5 border border-emerald-100 animate-fade-in">
              <span>{dict.reg_success_feedback}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || isDuplicate}
            className={`w-full py-3 px-4 rounded-full font-semibold text-xs flex items-center justify-center gap-2 transition-all duration-200 ios-active-scale ${
              isDuplicate 
                ? 'bg-neutral-50 text-neutral-300 border border-neutral-200 cursor-not-allowed' 
                : 'bg-neutral-950 text-white hover:bg-neutral-900 active:scale-[0.98] shadow-ios'
            }`}
            id="btn-register"
          >
            <PlusCircle className="w-4 h-4" />
            {isSubmitting ? dict.btn_registering : dict.btn_register}
          </button>
        </form>
      </div>
    </>
  );
}
