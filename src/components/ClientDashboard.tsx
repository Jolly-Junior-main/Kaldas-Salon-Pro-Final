/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CustomerWithRetention, Visit, PREDEFINED_SERVICES, Language, TreatmentArtist } from '../types';
import { Dict, translateName, translateServiceName } from '../translations';
import { Phone, Calendar, ClipboardList, PenTool, Check, Notebook, Clock, FileSpreadsheet, Plus, Edit2, Save, Trash2, X as CloseIcon } from 'lucide-react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import BirthdayWishModal from './BirthdayWishModal';

interface ClientDashboardProps {
  customer: CustomerWithRetention | null;
  onLogVisitForCustomer: (customer: CustomerWithRetention) => void;
  onRefreshTrigger: () => void;
  lang: Language;
  dict: Dict;
  allVisits?: Visit[];
  staffList?: any[];
  artistsList?: TreatmentArtist[];
  smsLogs?: any[];
}

export default function ClientDashboard({ customer, onLogVisitForCustomer, onRefreshTrigger, lang, dict, allVisits = [], staffList = [], artistsList = [], smsLogs = [] }: ClientDashboardProps) {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [notesFeedback, setNotesFeedback] = useState(false);
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);

  // Profile fields editing states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBirthday, setEditBirthday] = useState('');
  const [profileError, setProfileError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Derive dynamic client's visit chronology from our synchronized real-time props!
  const history = React.useMemo(() => {
    if (!customer) return [];
    return allVisits
      .filter(v => v.customer_id === customer.id)
      .sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());
  }, [customer, allVisits]);

  // Synchronize fields when customer switches
  useEffect(() => {
    if (customer) {
      setEditName(customer.full_name);
      setEditPhone(customer.phone_number);
      setEditBirthday(customer.birth_date || '');
      setEditedNotes(customer.notes_preferences || '');
      setProfileError('');
      setIsEditingProfile(false);
      setIsEditingNotes(false);
      setNotesFeedback(false);
      setIsConfirmingDelete(false);
    }
  }, [customer]);

  const handleNotesUpdate = async () => {
    if (!customer) return;
    try {
      await updateDoc(doc(db, 'customers', customer.id), {
        notes_preferences: editedNotes.trim() || null
      });
      setNotesFeedback(true);
      setTimeout(() => setNotesFeedback(false), 3000);
      setIsEditingNotes(false);
      onRefreshTrigger();
    } catch (e) {
      console.error('Failed to update notes in Firestore:', e);
      handleFirestoreError(e, OperationType.UPDATE, 'customers');
    }
  };

  const handleProfileSave = async () => {
    if (!customer) return;
    if (!editName.trim() || !editPhone.trim()) {
      setProfileError(lang === 'am' ? 'ሙሉ ስም እና ስልክ ቁጥር ያስፈልጋል' : 'Full Name and Phone Number are required fields');
      return;
    }
    setIsSavingProfile(true);
    setProfileError('');
    try {
      await updateDoc(doc(db, 'customers', customer.id), {
        full_name: editName.trim(),
        phone_number: editPhone.trim(),
        birth_date: editBirthday || null
      });
      setIsEditingProfile(false);
      onRefreshTrigger();
    } catch (e) {
      console.error('Failed to edit customer details in Firestore:', e);
      setProfileError(lang === 'am' ? 'የአውታረ መረብ ስህተት' : 'Network error updating customer profile');
      handleFirestoreError(e, OperationType.UPDATE, 'customers');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customer) return;
    try {
      // 1. Delete all visits of this customer to prevent orphaned entries in database
      for (const visit of history) {
        await deleteDoc(doc(db, 'visits', visit.id));
      }
      // 2. Delete customer document itself
      await deleteDoc(doc(db, 'customers', customer.id));
      
      setIsConfirmingDelete(false);
      onRefreshTrigger();
    } catch (e) {
      console.error('Failed to delete customer:', e);
      setProfileError(lang === 'am' ? 'የደንበኛ መረጃን መሰረዝ አልተቻለም' : 'Failed to delete customer profile');
      handleFirestoreError(e, OperationType.DELETE, 'customers');
    }
  };

  if (!customer) {
    return (
      <div className="bg-white rounded-[24px] border border-neutral-200/50 shadow-ios p-8 text-center flex flex-col items-center justify-center h-full min-h-[300px]" id="dashboard-placeholder">
        <div className="w-16 h-16 rounded-full bg-neutral-50 flex items-center justify-center text-neutral-400 mb-5 border border-neutral-200/50">
          <Notebook className="w-7 h-7" />
        </div>
        <h3 className="text-neutral-800 font-sans text-lg font-bold">{dict.no_client_title}</h3>
        <p className="text-neutral-400 text-xs max-w-xs mt-2 leading-relaxed">{dict.no_client_desc}</p>
      </div>
    );
  }

  // Segment styling mappings - Natural Tones colors mapping
  const getSegmentAttr = (status: string) => {
    switch (status) {
      case 'Frequent':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-100',
          dot: 'bg-emerald-500',
          desc: lang === 'am' ? 'ባለፉት 30 ቀናት ውስጥ 2+ ጊዜ ጎብኝተዋል። እጅግ በጣም ጥሩ ታማኝነት።' : 'Visited 2+ times in rolling 30 days. Outstanding loyalty.'
        };
      case 'Occasional':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-100',
          dot: 'bg-amber-500',
          desc: lang === 'am' ? 'አልፎ አልፎ የሚጎበኝ የተረጋጋ ደንበኛ። ባለፉት 60 ቀናት ውስጥ ጎብኝተዋል።' : 'Stable occasional visitor. Visited within rolling 60 days.'
        };
      case 'At-Risk':
      default:
        return {
          bg: 'bg-red-50 text-red-800 border-red-100',
          dot: 'bg-red-500',
          desc: lang === 'am' ? 'ባለፉት 60+ ቀናት ውስጥ ምንም ጉብኝት የለም። ለማቆም የተቃረበ ደንበኛ።' : 'No visits in last 60+ days. Churn warning target.'
        };
    }
  };

  const segment = getSegmentAttr(customer.retentionStatus);

  const getServiceName = (srvId: string) => {
    const match = PREDEFINED_SERVICES.find(s => s.id === srvId);
    const fallbackName = match ? match.name : srvId;
    return translateServiceName(srvId, fallbackName, lang);
  };

  // Maps IDs back to beautiful labels
  const renderItemNames = (itemIds: string[]) => {
    return itemIds.map(id => getServiceName(id)).join(', ');
  };

  return (
    <div className="bg-white rounded-[24px] border border-neutral-200/50 shadow-ios overflow-hidden flex flex-col h-full transition-all duration-300" id="client-profile-dashboard">
      
      {/* 1. Header Snapshot */}
      <div className="p-6 border-b border-neutral-200/50 bg-neutral-50/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-neutral-800 border border-neutral-200/60 bg-white shadow-ios">
              {customer.full_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {isEditingProfile ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-sm font-bold font-sans text-neutral-950 bg-white border border-neutral-300 rounded px-2.5 py-1 outline-none focus:ring-1 focus:ring-neutral-900"
                    placeholder={dict.label_fullname}
                  />
                ) : (
                  <h2 className="text-lg font-bold font-sans text-neutral-900 tracking-tight">{customer.full_name}</h2>
                )}

                {/* Edit & Delete Toggle Icons */}
                {!isEditingProfile ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="p-1.5 text-neutral-400 hover:text-neutral-900 transition-colors bg-white rounded-full border border-neutral-200/50 shadow-xs hover:shadow-xs ios-active-scale"
                      title={lang === 'am' ? 'መገለጫ አርትዕ' : 'Edit Profile'}
                      id="btn-trigger-edit-profile"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setIsConfirmingDelete(true)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors bg-white rounded-full border border-neutral-200/50 shadow-xs hover:shadow-xs ios-active-scale"
                      title={lang === 'am' ? 'ደንበኛ ሰርዝ' : 'Delete Customer'}
                      id="btn-trigger-delete-profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 ml-1">
                    <button
                      onClick={handleProfileSave}
                      disabled={isSavingProfile}
                      className="p-1 px-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-full text-[10.5px] font-bold flex items-center gap-1 transition-colors ios-active-scale shadow-xs"
                      id="btn-save-edit-profile"
                    >
                      <Save className="w-3.5 h-3.5" /> {lang === 'am' ? 'አስቀምጥ' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingProfile(false);
                        setEditName(customer.full_name);
                        setEditPhone(customer.phone_number);
                        setEditBirthday(customer.birth_date || '');
                        setProfileError('');
                      }}
                      className="p-1 px-3 bg-red-50 hover:bg-red-100 text-red-800 rounded-full text-[10.5px] font-bold flex items-center gap-1 transition-colors ios-active-scale"
                    >
                      <CloseIcon className="w-3.5 h-3.5" /> {lang === 'am' ? 'ሰርዝ' : 'Cancel'}
                    </button>
                  </div>
                )}

                <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold border ${segment.bg}`} id="badge-segment">
                  <span className={`w-1.5 h-1.5 rounded-full ${segment.dot}`} />
                  {customer.retentionStatus === 'Frequent' ? (lang === 'am' ? 'ተደጋጋሚ' : 'Frequent') : customer.retentionStatus === 'Occasional' ? (lang === 'am' ? 'ቋሚ / መካከለኛ' : 'Regular') : (lang === 'am' ? 'ክትትል የሚሻ' : 'Needs Care')}
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1 font-mono uppercase tracking-wider">ID: {customer.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
               onClick={() => onLogVisitForCustomer(customer)}
              className="py-2.5 px-5 rounded-full text-xs font-semibold bg-neutral-900 text-white hover:bg-neutral-800 transition-all flex items-center gap-1.5 active:scale-95 shadow-ios ios-active-scale"
              id="btn-add-visit-direct"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              {dict.btn_log_visit_direct}
            </button>
          </div>

        </div>
        
        {/* Delete Confirmation Banner */}
        {isConfirmingDelete && (
          <div className="mt-4 p-4 bg-red-50 rounded-2xl border border-red-200/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in" id="delete-confirmation-banner">
            <div className="flex items-center gap-2">
              <span className="text-red-600 text-lg">⚠️</span>
              <div>
                <h4 className="text-xs font-bold text-red-900">
                  {lang === 'am' ? 'እርግጠኛ ነዎት ይህንን ደንበኛ መሰረዝ ይፈልጋሉ?' : 'Are you sure you want to delete this client?'}
                </h4>
                <p className="text-[10px] text-red-700">
                  {lang === 'am' ? 'ይህ ድርጊት ደንበኛውን እና ሁሉንም የጉብኝት ታሪክ በቋሚነት ያጠፋል።' : 'This action permanently deletes the client and all visit history.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleDeleteCustomer}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full text-[11px] font-bold transition-all ios-active-scale shadow-xs"
                id="btn-confirm-delete-customer"
              >
                {lang === 'am' ? 'አዎ፥ ሰርዝ' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => setIsConfirmingDelete(false)}
                className="px-3 py-1.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-full text-[11px] font-bold transition-all ios-active-scale"
                id="btn-cancel-delete-customer"
              >
                {lang === 'am' ? 'ተው' : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-neutral-200/40">
          <div className="flex items-center gap-2.5 bg-white p-3 rounded-2xl border border-neutral-200/50 shadow-xs">
            <Phone className="w-4 h-4 text-neutral-400 shrink-0" />
            <div className="truncate w-full">
              <span className="block text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">{dict.label_contact}</span>
              {isEditingProfile ? (
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full text-xs font-bold text-neutral-800 bg-neutral-50 px-2 py-1 rounded-lg outline-none border border-neutral-200/60 focus:border-neutral-900 mt-1"
                />
              ) : (
                <span className="text-xs font-bold text-neutral-800 block truncate">{customer.phone_number}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-white p-3 rounded-2xl border border-neutral-200/50 shadow-xs">
            <Calendar className="w-4 h-4 text-neutral-400 shrink-0" />
            <div className="w-full">
              <span className="block text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">{dict.label_birthday_title}</span>
              {isEditingProfile ? (
                <input
                  type="date"
                  value={editBirthday}
                  onChange={(e) => setEditBirthday(e.target.value)}
                  className="w-full text-xs font-bold text-neutral-800 bg-neutral-50 px-2 py-1 rounded-lg outline-none border border-neutral-200/60 focus:border-neutral-900 mt-1"
                />
              ) : (
                <>
                  <span className="text-xs font-bold text-neutral-800 block">
                    {customer.birth_date ? new Date(customer.birth_date).toLocaleDateString(lang === 'am' ? 'am-ET' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : (lang === 'am' ? 'አልተሰጠም' : 'Not provided')}
                  </span>
                  {customer.birth_date && localStorage.getItem('kaldas_user_role') === 'admin' && (
                    <button
                      onClick={() => setShowBirthdayModal(true)}
                      className="mt-1.5 text-[9px] font-extrabold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-0.5 rounded border border-amber-200/50 flex items-center gap-0.5 transition-all ios-active-scale uppercase tracking-wide cursor-pointer"
                    >
                      ✉️ {lang === 'am' ? 'የልደት ምኞት ላክ' : 'Send Wish SMS'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-white p-3 rounded-2xl border border-neutral-200/50 shadow-xs">
            <Clock className="w-4 h-4 text-neutral-400 shrink-0" />
            <div>
              <span className="block text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">{dict.label_registered_title}</span>
              <span className="text-xs font-bold text-neutral-800 block font-mono">
                {new Date(customer.created_at).toLocaleDateString(lang === 'am' ? 'am-ET' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {profileError && (
          <p className="mt-4 text-xs font-bold text-red-700 bg-red-50 p-3 rounded-2xl border border-red-200/50 text-center animate-fade-in">
            ⚠️ {profileError}
          </p>
        )}
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-y-auto">
        
        {/* Left Column: Preference logs, history tracker, status details */}
        <div className="lg:col-span-1 space-y-4">
          
          <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-200/50 shadow-xs">
            <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2.5">{dict.telemetry_title}</h4>
            <p className="text-xs leading-relaxed text-neutral-700 font-medium">{segment.desc}</p>
            <div className="mt-4 pt-3 border-t border-neutral-200/40 text-[11px] text-neutral-400 flex justify-between">
              <span className="font-semibold">{lang === 'am' ? 'ጉብኝቶች (በ30 ቀን ውስጥ):' : 'Visits (30d):'}</span>
              <span className="font-bold text-neutral-800 font-mono">{customer.visitCountInLast30Days}</span>
            </div>
          </div>

          {/* Style Diary & Allergies Preferences */}
          <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200/50 shadow-xs space-y-3 relative">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-neutral-400" /> {dict.notes_title}
              </h4>
              {!isEditingNotes ? (
                <button
                  type="button"
                  onClick={() => setIsEditingNotes(true)}
                  className="text-[10px] font-bold text-neutral-700 hover:text-neutral-905 hover:bg-neutral-100 border border-neutral-200 bg-white rounded-full px-3 py-1 hover:shadow-ios transition-all duration-150 ios-active-scale"
                  id="btn-edit-notes"
                >
                  {dict.btn_edit_note}
                </button>
              ) : (
                <div className="flex gap-1.5 animate-fade-in">
                  <button
                    type="button"
                    onClick={handleNotesUpdate}
                    className="text-[10px] font-bold text-white bg-neutral-900 hover:bg-neutral-850 rounded-full px-2.5 py-1 ios-active-scale"
                    id="btn-save-notes"
                  >
                    {dict.btn_save_note}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingNotes(false);
                      setEditedNotes(customer.notes_preferences || '');
                    }}
                    className="text-[10px] font-bold text-red-800 bg-red-50 hover:bg-red-100 rounded-full px-2.5 py-1 ios-active-scale"
                  >
                    {dict.btn_cancel_note}
                  </button>
                </div>
              )}
            </div>

            {isEditingNotes ? (
              <textarea
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                rows={4}
                className="w-full text-xs bg-white border border-neutral-200 rounded-xl p-3 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 focus:outline-none text-neutral-800 transition-all"
                placeholder={dict.placeholder_note_edit}
                id="notes-textarea"
              />
            ) : (
              <p className="text-xs leading-relaxed text-neutral-600 font-medium whitespace-pre-wrap italic">
                {customer.notes_preferences ? `"${customer.notes_preferences}"` : dict.no_formulations_recorded}
              </p>
            )}

            {notesFeedback && (
              <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2.5 py-1 border border-emerald-100 rounded-full block text-center animate-fade-in font-bold">
                {dict.note_saved_success}
              </span>
            )}
          </div>

          {/* SMS Dispatch & Delivery Status */}
          <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200/50 shadow-xs space-y-3" id="client-sms-telemetry">
            <h4 className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              ✉️ {lang === 'am' ? 'የኤስኤምኤስ ታሪክ እና ሁኔታ' : 'SMS Dispatch & Delivery Status'}
            </h4>
            
            {(() => {
              // Normalize numbers to match robustly on the last 9 digits
              const last9Digits = (num: string) => {
                const cleaned = num.trim().replace(/[\s\-\(\)\+]/g, '');
                return cleaned.substring(Math.max(0, cleaned.length - 9));
              };
              const clientPhoneLast9 = last9Digits(customer.phone_number);
              const matchedLogs = (smsLogs || []).filter(log => {
                if (!log.phone) return false;
                return last9Digits(log.phone) === clientPhoneLast9;
              });

              if (matchedLogs.length === 0) {
                return (
                  <div className="text-center py-6 text-neutral-400">
                    <p className="text-xs font-medium">📭 {lang === 'am' ? 'እስካሁን ምንም የተላከ ኤስኤምኤስ ታሪክ የለም።' : 'No SMS dispatches recorded for this client.'}</p>
                    <p className="text-[10px] text-neutral-350 mt-1 leading-normal">
                      {lang === 'am' 
                        ? 'ለዚህ ደንበኛ የደስታ ምኞት፣ የጉብኝት ማረጋገጫ ወይም ሌላ የኤስኤምኤስ መልዕክት ሲላክ እዚህ ሁኔታውን ማየት ይችላሉ።' 
                        : 'Status indicators (Sent/Failed) will appear in real-time once a welcome, thank-you, birthday, or custom message is triggered.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1" id="client-sms-logs-list">
                  {matchedLogs.map(log => {
                    const logDate = new Date(log.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(log.sent_at).toLocaleDateString();
                    return (
                      <div key={log.id} className="p-3 bg-white border border-neutral-200/60 rounded-xl space-y-1.5 shadow-2xs" id={`client-log-${log.id}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-mono font-bold text-neutral-400">{logDate}</span>
                          {log.status === 'Sent' ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              {lang === 'am' ? 'ተልኳል' : 'Sent'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full" title={log.error_message}>
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              {lang === 'am' ? 'አልተላከም' : 'Failed'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-semibold text-neutral-700 leading-snug break-words">
                          {log.message}
                        </p>
                        {log.error_message && (
                          <p className="text-[9px] text-red-500 font-extrabold bg-red-50/40 p-1.5 rounded-md border border-red-100 leading-normal">
                            ⚠️ {log.error_message}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

        </div>

        {/* Right Column: Visits Chronology table */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{dict.chrono_title} ({history.length})</h3>
          
          {history.length === 0 ? (
            <div className="p-10 text-center border border-neutral-200/50 rounded-2xl bg-neutral-50 shadow-xs">
              <FileSpreadsheet className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
              <p className="text-xs text-neutral-400 font-semibold leading-relaxed">{dict.no_history_captured}</p>
              <button
                onClick={() => onLogVisitForCustomer(customer)}
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-neutral-700 underline hover:text-neutral-900"
              >
                {dict.log_first_visit}
              </button>
            </div>
          ) : (
            <div className="border border-neutral-200/50 rounded-2xl overflow-hidden bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-50/80 border-b border-neutral-200/50 text-neutral-400 uppercase font-bold tracking-wider text-[9px]">
                      <th className="py-3 px-4">{dict.table_date}</th>
                      <th className="py-3 px-4">{dict.table_treatments}</th>
                      <th className="py-3 px-4 text-right">{dict.table_price}</th>
                      <th className="py-3 px-4 text-center">{dict.table_channel}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {history.map((h) => (
                      <tr key={h.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-neutral-800 whitespace-nowrap">
                          {new Date(h.visit_date).toLocaleDateString(lang === 'am' ? 'am-ET' : 'en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-neutral-600 font-medium max-w-xs shrink">
                          <p className="font-semibold text-neutral-800">{renderItemNames(h.items_used)}</p>
                          {(h.assigned_staff_id || h.equipment_used) && (
                            <div className="flex flex-wrap gap-2 mt-1.5">
                              {h.assigned_staff_id && (() => {
                                const ids = h.assigned_staff_id.split(',').map(s => s.trim()).filter(Boolean);
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
                                    <span key={id} className="inline-flex items-center gap-1 text-[10px] font-bold bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-md border border-neutral-200/45">
                                      👤 {translateName(matchedStaff.name, lang)} ({roleLabelStr})
                                    </span>
                                  );
                                });
                              })()}
                              {h.equipment_used && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-100">
                                  🛠️ {h.equipment_used}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold font-mono text-neutral-800">
                          {Number(h.price_charged).toFixed(2)} ETB
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-neutral-100 text-[10px] font-bold text-neutral-800 font-mono border border-neutral-200/40">
                            {h.payment_method === 'Telebirr' ? (lang === 'am' ? 'ቴሌብር' : 'Telebirr') :
                             h.payment_method === 'CBE Birr' ? (lang === 'am' ? 'ሲቢኢ ብር' : 'CBE Birr') :
                             h.payment_method === 'M-Pesa' ? (lang === 'am' ? 'ኤም-ፔሳ' : 'M-Pesa') :
                             h.payment_method === 'Bank Transfer' ? (lang === 'am' ? 'ባንክ ማስተላለፍ' : 'Bank Transfer') :
                             h.payment_method === 'Cash' ? (lang === 'am' ? 'ጥሬ ገንዘብ' : 'Cash') : (lang === 'am' ? 'ካርድ' : 'Card')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </div>
      
      {showBirthdayModal && customer && (
        <BirthdayWishModal
          customer={customer}
          lang={lang}
          onClose={() => setShowBirthdayModal(false)}
        />
      )}
    </div>
  );
}
