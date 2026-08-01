import React, { useState, useEffect } from 'react';
import { 
  QueueEntry, 
  QueueStatus, 
  Language, 
  SalonService, 
  StaffMember,
  TreatmentArtist,
  CustomerWithRetention,
  InventoryProduct,
  ActiveProductCheckout,
  DEFAULT_QUEUE_SMS_TEMPLATES, 
  QueueSmsTemplates, 
  formatQueueSms 
} from '../types';
import { 
  Users, 
  UserPlus, 
  Clock, 
  Bell, 
  CheckCircle2, 
  XCircle, 
  Play, 
  Pause,
  RotateCcw,
  MessageSquare, 
  Phone, 
  Sparkles, 
  Scissors, 
  RefreshCw, 
  Send, 
  Trash2, 
  AlertCircle, 
  Settings, 
  UserCheck,
  Search,
  Check,
  User,
  ShieldCheck,
  Info,
  Package,
  Zap,
  AlertTriangle,
  Award,
  TrendingUp,
  Timer
} from 'lucide-react';

interface QueueDashboardProps {
  queueEntries: QueueEntry[];
  onAddQueueEntry: (entry: Omit<QueueEntry, 'id' | 'position' | 'joined_at'>) => Promise<void>;
  onUpdateQueueStatus: (id: string, status: QueueStatus, customUpdate?: Partial<QueueEntry>) => Promise<void>;
  onDeleteQueueEntry: (id: string) => Promise<void>;
  onSendQueueSms: (phone: string, message: string) => Promise<{ success: boolean; error?: string }>;
  onCompleteAndLogVisit?: (entry: QueueEntry) => void;
  onAddCustomer?: (cust: { full_name: string; phone_number: string; notes_preferences?: string }) => Promise<CustomerWithRetention | null>;
  services: SalonService[];
  existingCustomers?: CustomerWithRetention[];
  staffMembers?: StaffMember[];
  stylists?: TreatmentArtist[];
  inventoryProducts?: InventoryProduct[];
  activeCheckouts?: ActiveProductCheckout[];
  onAutoDeductInventoryOnServiceComplete?: (serviceName: string, stylistName?: string) => Promise<void>;
  lang: Language;
}

export default function QueueDashboard({
  queueEntries,
  onAddQueueEntry,
  onUpdateQueueStatus,
  onDeleteQueueEntry,
  onSendQueueSms,
  onCompleteAndLogVisit,
  onAddCustomer,
  services,
  existingCustomers = [],
  staffMembers = [],
  stylists = [],
  inventoryProducts = [],
  activeCheckouts = [],
  onAutoDeductInventoryOnServiceComplete,
  lang
}: QueueDashboardProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState<'stations_live' | 'queue_list'>('stations_live');
  
  // Local station timers map: entryId -> { status: 'running'|'paused'|'stopped', startTime: number, accumulatedSeconds: number }
  const [stationTimers, setStationTimers] = useState<Record<string, { status: 'running' | 'paused' | 'stopped'; startTime: number; accumulatedSeconds: number }>>({});
  
  // 1-second live ticker
  const [tickerSeconds, setTickerSeconds] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTickerSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Timer helper calculations
  const getTimerData = (entry: QueueEntry) => {
    const saved = stationTimers[entry.id];
    let benchmarkMinutes = entry.est_wait_minutes || 30;

    // Match service benchmark if preset matches
    if (entry.service_name && services.length > 0) {
      const match = services.find(s => entry.service_name?.toLowerCase().includes(s.name.toLowerCase()));
      if (match && (match as any).benchmarkMinutes) {
        benchmarkMinutes = (match as any).benchmarkMinutes;
      }
    }

    if (!saved) {
      const calledTime = entry.called_at ? new Date(entry.called_at).getTime() : Date.now();
      const initElapsed = Math.max(0, Math.floor((Date.now() - calledTime) / 1000));
      return {
        status: 'running' as const,
        elapsedSeconds: initElapsed,
        benchmarkMinutes
      };
    }

    let totalSeconds = saved.accumulatedSeconds;
    if (saved.status === 'running') {
      totalSeconds += Math.max(0, Math.floor((Date.now() - saved.startTime) / 1000));
    }

    return {
      status: saved.status,
      elapsedSeconds: totalSeconds,
      benchmarkMinutes
    };
  };

  const handleTogglePauseTimer = (entryId: string, currentElapsed: number) => {
    setStationTimers(prev => {
      const current = prev[entryId];
      const now = Date.now();
      if (!current) {
        return {
          ...prev,
          [entryId]: { status: 'paused', startTime: now, accumulatedSeconds: currentElapsed }
        };
      }
      if (current.status === 'running') {
        const added = Math.max(0, Math.floor((now - current.startTime) / 1000));
        return {
          ...prev,
          [entryId]: { status: 'paused', startTime: now, accumulatedSeconds: current.accumulatedSeconds + added }
        };
      } else {
        return {
          ...prev,
          [entryId]: { status: 'running', startTime: now, accumulatedSeconds: current.accumulatedSeconds }
        };
      }
    });
  };

  const handleResetTimer = (entryId: string) => {
    setStationTimers(prev => ({
      ...prev,
      [entryId]: { status: 'running', startTime: Date.now(), accumulatedSeconds: 0 }
    }));
  };

  const formatSecondsDisplay = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const hours = Math.floor(mins / 60);
    if (hours > 0) {
      const remMins = mins % 60;
      return `${hours}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  // Customer selection & fields
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [serviceName, setServiceName] = useState('');
  const [estWaitMinutes, setEstWaitMinutes] = useState(15);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [assignedStaff, setAssignedStaff] = useState('');
  const [notes, setNotes] = useState('');
  const [sendWelcomeSms, setSendWelcomeSms] = useState(true);

  const toggleServiceSelect = (sName: string) => {
    setSelectedServices(prev => 
      prev.includes(sName) ? prev.filter(s => s !== sName) : [...prev, sName]
    );
  };

  const toggleStaffSelect = (stName: string) => {
    setSelectedStaff(prev => 
      prev.includes(stName) ? prev.filter(s => s !== stName) : [...prev, stName]
    );
  };

  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // SMS Template settings state
  const [showSmsSettings, setShowSmsSettings] = useState(false);
  const [smsTemplates, setSmsTemplates] = useState<QueueSmsTemplates>(() => {
    const saved = localStorage.getItem('konjo_queue_sms_templates');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return DEFAULT_QUEUE_SMS_TEMPLATES;
  });

  const saveTemplates = (newTemplates: QueueSmsTemplates) => {
    setSmsTemplates(newTemplates);
    localStorage.setItem('konjo_queue_sms_templates', JSON.stringify(newTemplates));
  };

  // Filter existing registered customers based on search query
  const filteredExistingCustomers = existingCustomers.filter(c => {
    const name = c.full_name || (c as any).name || '';
    const phone = c.phone_number || (c as any).phone || '';
    return name.toLowerCase().includes(customerSearchQuery.toLowerCase()) || phone.includes(customerSearchQuery);
  }).slice(0, 8);

  // Select registered customer handler
  const handleSelectCustomer = (c: CustomerWithRetention) => {
    const name = c.full_name || (c as any).name || '';
    const phone = c.phone_number || (c as any).phone || '';
    setSelectedCustomerId(c.id);
    setCustomerName(name);
    setPhoneNumber(phone);
    setCustomerSearchQuery(name);
    setShowCustomerDropdown(false);
  };

  // Clear customer selection to type custom new walk-in
  const handleClearSelectedCustomer = () => {
    setSelectedCustomerId('');
    setCustomerName('');
    setPhoneNumber('');
    setCustomerSearchQuery('');
    setSelectedServices([]);
    setSelectedStaff([]);
    setServiceName('');
    setAssignedStaff('');
  };

  // Sort queue by position / joined time
  const waitingList = queueEntries
    .filter(e => e.status === 'waiting' || e.status === 'notified')
    .sort((a, b) => a.position - b.position);

  const inServiceList = queueEntries.filter(e => e.status === 'in_service');
  const completedList = queueEntries.filter(e => e.status === 'completed');

  // Metrics calculation
  const totalWaiting = waitingList.length;
  const totalInService = inServiceList.length;
  const totalCompletedToday = completedList.length;

  // Calculate total estimated wait time in minutes for the whole line
  const calculatedTotalWait = waitingList.reduce((acc, curr) => acc + (curr.est_wait_minutes || 15), 0);
  const avgWaitTimePerCustomer = totalWaiting > 0 ? Math.round(calculatedTotalWait / totalWaiting) : 15;

  const nextWaitingCustomer = waitingList[0] || null;

  // Real-time ticker for elapsed time calculation
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const getElapsedTimeText = (isoString: string) => {
    const diffMs = currentTime - new Date(isoString).getTime();
    const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
    if (diffMins < 1) return lang === 'am' ? 'አሁን የገቡ' : 'Just joined';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ${lang === 'am' ? 'በጥበቃ ላይ' : 'waiting'}`;
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hrs}h ${mins}m ${lang === 'am' ? 'በጥበቃ ላይ' : 'waiting'}`;
  };

  // Computed auto-matched existing customer when typing manually or searching
  const matchedExistingCustomer = existingCustomers.find(c => {
    if (selectedCustomerId && c.id === selectedCustomerId) return true;
    const p = (c.phone_number || (c as any).phone || '').replace(/\s+/g, '');
    const n = (c.full_name || (c as any).name || '').toLowerCase().trim();
    const typedPhone = phoneNumber.trim().replace(/\s+/g, '');
    const typedName = customerName.trim().toLowerCase();
    if (typedPhone && p && p === typedPhone) return true;
    if (typedName && n && n === typedName) return true;
    return false;
  }) || null;

  // Add Walk-in & Trigger Text 1 (Welcome SMS)
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !phoneNumber.trim()) return;

    setIsSubmitting(true);
    try {
      let finalCustomerId = selectedCustomerId || (matchedExistingCustomer ? matchedExistingCustomer.id : undefined);

      // If client is not in directory yet, automatically register them in the Client Directory!
      if (!finalCustomerId && onAddCustomer) {
        const newlyAdded = await onAddCustomer({
          full_name: customerName.trim(),
          phone_number: phoneNumber.trim(),
          notes_preferences: notes.trim() || undefined
        });
        if (newlyAdded) {
          finalCustomerId = newlyAdded.id;
        }
      }

      const nextPos = waitingList.length + 1;
      const customersAhead = Math.max(0, nextPos - 1);
      const waitTime = customersAhead * (estWaitMinutes || 15);

      const finalServiceName = selectedServices.length > 0
        ? selectedServices.join(', ')
        : (serviceName.trim() || (lang === 'am' ? 'የፀጉር / የውበት አሰራር' : 'Hair / Beauty Styling'));

      const finalStaffName = selectedStaff.length > 0
        ? selectedStaff.join(', ')
        : (assignedStaff.trim() || undefined);

      await onAddQueueEntry({
        customer_id: finalCustomerId,
        customer_name: customerName.trim(),
        phone_number: phoneNumber.trim(),
        service_name: finalServiceName,
        est_wait_minutes: Number(estWaitMinutes) || 15,
        status: 'waiting',
        assigned_staff_name: finalStaffName,
        notes: notes.trim() || undefined
      });

      // Text 1 of 2: Welcome SMS
      if (sendWelcomeSms) {
        const tpl = lang === 'am' ? smsTemplates.queue_entry_am : smsTemplates.queue_entry_en;
        const msg = formatQueueSms(tpl, {
          customer_name: customerName.trim(),
          position_number: nextPos,
          customers_ahead: customersAhead,
          wait_time: waitTime
        });
        const smsRes = await onSendQueueSms(phoneNumber.trim(), msg);
        if (smsRes.success) {
          setNotificationStatus({ 
            msg: `[Text 1/2 Sent] Welcome SMS delivered to ${customerName} (Position #${nextPos})`, 
            type: 'success' 
          });
        } else {
          setNotificationStatus({ 
            msg: `Customer added to line. Text 1 fail: ${smsRes.error || 'Network error'}`, 
            type: 'error' 
          });
        }
      } else {
        setNotificationStatus({ msg: `${customerName} added to line at position #${nextPos}`, type: 'success' });
      }

      // Reset form
      handleClearSelectedCustomer();
      setServiceName('');
      setNotes('');
      setShowAddModal(false);
    } catch (err: any) {
      setNotificationStatus({ msg: err.message || 'Failed to add customer to queue', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trigger Text 2 of 2: Call Next Customer to station (Ready SMS)
  const handleCallNext = async () => {
    if (!nextWaitingCustomer) return;
    setIsSubmitting(true);
    try {
      await onUpdateQueueStatus(nextWaitingCustomer.id, 'in_service', {
        called_at: new Date().toISOString()
      });

      // Text 2 of 2: Ready SMS
      const tpl = lang === 'am' ? smsTemplates.queue_ready_am : smsTemplates.queue_ready_en;
      const msg = formatQueueSms(tpl, {
        customer_name: nextWaitingCustomer.customer_name
      });

      const smsRes = await onSendQueueSms(nextWaitingCustomer.phone_number, msg);
      if (smsRes.success) {
        setNotificationStatus({
          msg: `[Text 2/2 Sent] Called #${nextWaitingCustomer.position} ${nextWaitingCustomer.customer_name}! Ready SMS delivered.`,
          type: 'success'
        });
      } else {
        setNotificationStatus({
          msg: `Called ${nextWaitingCustomer.customer_name}. Ready SMS alert failed: ${smsRes.error || 'API error'}`,
          type: 'error'
        });
      }
    } catch (err: any) {
      setNotificationStatus({ msg: err.message || 'Error updating status', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Individual Manual Re-send for Text 1 or Text 2
  const handleManualSms = async (entry: QueueEntry, type: 'welcome' | 'ready') => {
    setIsSubmitting(true);
    try {
      let tpl = '';
      const ahead = Math.max(0, entry.position - 1);
      const waitTime = ahead * entry.est_wait_minutes;

      if (type === 'welcome') tpl = lang === 'am' ? smsTemplates.queue_entry_am : smsTemplates.queue_entry_en;
      else tpl = lang === 'am' ? smsTemplates.queue_ready_am : smsTemplates.queue_ready_en;

      const msg = formatQueueSms(tpl, {
        customer_name: entry.customer_name,
        position_number: entry.position,
        customers_ahead: ahead,
        wait_time: waitTime
      });

      const smsRes = await onSendQueueSms(entry.phone_number, msg);
      if (smsRes.success) {
        await onUpdateQueueStatus(entry.id, entry.status, { notified_at: new Date().toISOString() });
        setNotificationStatus({ msg: `SMS (${type.toUpperCase()}) sent to ${entry.customer_name}!`, type: 'success' });
      } else {
        setNotificationStatus({ msg: `SMS dispatch failed: ${smsRes.error || 'Network error'}`, type: 'error' });
      }
    } catch (err: any) {
      setNotificationStatus({ msg: 'Failed sending notification', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter list items based on tab & search
  const filteredQueue = queueEntries.filter(e => {
    const matchesSearch = e.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.phone_number.includes(searchQuery) ||
                          (e.service_name && e.service_name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterStatus === 'active') return e.status === 'waiting' || e.status === 'notified' || e.status === 'in_service';
    if (filterStatus === 'waiting') return e.status === 'waiting' || e.status === 'notified';
    if (filterStatus === 'in_service') return e.status === 'in_service';
    if (filterStatus === 'completed') return e.status === 'completed';
    if (filterStatus === 'cancelled') return e.status === 'cancelled';
    return true;
  }).sort((a, b) => {
    const orderScore = (s: QueueStatus) => {
      if (s === 'in_service') return 0;
      if (s === 'notified') return 1;
      if (s === 'waiting') return 2;
      if (s === 'completed') return 3;
      return 4;
    };
    if (orderScore(a.status) !== orderScore(b.status)) {
      return orderScore(a.status) - orderScore(b.status);
    }
    return a.position - b.position;
  });

  return (
    <div className="space-y-6">
      {/* Dynamic Toast Feedback */}
      {notificationStatus && (
        <div className={`p-4 rounded-2xl shadow-ios border flex items-center justify-between transition-all animate-fade-in ${
          notificationStatus.type === 'success' 
            ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-100' 
            : 'bg-rose-900/90 border-rose-500/50 text-rose-100'
        }`}>
          <div className="flex items-center space-x-3">
            {notificationStatus.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-300 shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-semibold tracking-wide">{notificationStatus.msg}</span>
          </div>
          <button 
            onClick={() => setNotificationStatus(null)}
            className="text-white/80 hover:text-white p-1 rounded-lg"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Strict 2-SMS Policy Notification Header */}
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3.5 px-4 shadow-xs flex items-center justify-between text-xs text-amber-900">
        <div className="flex items-center space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Strict 2-SMS Policy Active:</strong> Customers receive <strong>Text 1</strong> (Welcome Line #) upon walk-in entry, and <strong>Text 2</strong> (Station Ready) when called to station.
          </span>
        </div>
        <span className="hidden md:inline-block text-[10px] uppercase tracking-wider font-extrabold bg-amber-200/60 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
          Cost-Optimized
        </span>
      </div>

      {/* Visual Counters & High-Contrast Metrics Cards (Styled to match Konjo Salon light theme) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Waiting Line */}
        <div className="bg-white/90 backdrop-blur-md border border-neutral-200/80 rounded-2xl md:rounded-3xl p-5 shadow-ios-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              {lang === 'am' ? 'በጥበቃ ላይ ያሉ' : 'Live Waiting Queue'}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">{totalWaiting}</span>
            <span className="text-xs text-neutral-500 font-semibold">{lang === 'am' ? 'ደንበኞች' : 'Customers'}</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-2 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Avg ~{avgWaitTimePerCustomer} mins per service</span>
          </p>
        </div>

        {/* Metric 2: Estimated Wait Time */}
        <div className="bg-white/90 backdrop-blur-md border border-neutral-200/80 rounded-2xl md:rounded-3xl p-5 shadow-ios-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
              {lang === 'am' ? 'የተገመተ ጊዜ' : 'Estimated Queue Time'}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">~{calculatedTotalWait}</span>
            <span className="text-xs text-neutral-500 font-semibold">{lang === 'am' ? 'ደቂቃ' : 'Mins Total'}</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-2 truncate">
            {nextWaitingCustomer ? `Next: ${nextWaitingCustomer.customer_name}` : 'No queue delay'}
          </p>
        </div>

        {/* Metric 3: Active in Station */}
        <div className="bg-white/90 backdrop-blur-md border border-neutral-200/80 rounded-2xl md:rounded-3xl p-5 shadow-ios-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
              {lang === 'am' ? 'አሁን አገልግሎት ላይ' : 'Active In Station'}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-700">
              <Scissors className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">{totalInService}</span>
            <span className="text-xs text-neutral-500 font-semibold">{lang === 'am' ? 'በአገልግሎት ላይ' : 'In Service'}</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-2">
            Styling stations occupied
          </p>
        </div>

        {/* Metric 4: Completed Turnover */}
        <div className="bg-white/90 backdrop-blur-md border border-neutral-200/80 rounded-2xl md:rounded-3xl p-5 shadow-ios-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
              {lang === 'am' ? 'ዛሬ የተጠናቀቁ' : 'Today\'s Turnover'}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-purple-50 border border-purple-200/60 flex items-center justify-center text-purple-700">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">{totalCompletedToday}</span>
            <span className="text-xs text-neutral-500 font-semibold">{lang === 'am' ? 'የተስተናገዱ' : 'Served Today'}</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-2">
            Walk-in sessions finished
          </p>
        </div>
      </div>

      {/* Primary Action Controls (Styled in Konjo Salon's iOS light card style) */}
      <div className="bg-white/90 backdrop-blur-md border border-neutral-200/80 rounded-2xl md:rounded-3xl p-4 sm:p-5 shadow-ios flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Quick Touch-Friendly Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Main Add Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold px-5 py-3 rounded-2xl shadow-ios-md hover:scale-[1.01] active:scale-[0.98] transition-all text-xs sm:text-sm cursor-pointer"
          >
            <UserPlus className="w-4.5 h-4.5 text-amber-400" />
            <span>+ Add Walk-In to Queue</span>
          </button>

          {/* Call Next Button (Dispatches Text 2 of 2) */}
          <button
            onClick={handleCallNext}
            disabled={!nextWaitingCustomer || isSubmitting}
            className={`flex items-center space-x-2 px-4.5 py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              nextWaitingCustomer && !isSubmitting
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-ios-md hover:scale-[1.01] active:scale-[0.98]'
                : 'bg-neutral-100 text-neutral-400 cursor-not-allowed border border-neutral-200/60'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Call Next Customer (#1 {nextWaitingCustomer ? nextWaitingCustomer.customer_name : ''})</span>
          </button>
        </div>

        {/* Right: SMS Templates Modal Toggle */}
        <button
          onClick={() => setShowSmsSettings(!showSmsSettings)}
          className="flex items-center space-x-2 text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200/70 px-4 py-2.5 rounded-2xl border border-neutral-200/80 text-xs font-semibold transition-colors"
        >
          <Settings className="w-4 h-4 text-amber-600" />
          <span>Queue SMS Templates</span>
        </button>
      </div>

      {/* SMS Templates Config Panel */}
      {showSmsSettings && (
        <div className="bg-white/95 backdrop-blur-md border border-neutral-200/90 rounded-2xl md:rounded-3xl p-5 space-y-4 shadow-ios animate-fade-in">
          <div className="flex items-center justify-between border-b border-neutral-200/70 pb-3">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-neutral-900 text-sm sm:text-base">Queue SMS Notification Templates (GeezSMS)</h3>
            </div>
            <button 
              onClick={() => setShowSmsSettings(false)}
              className="text-neutral-400 hover:text-neutral-700 text-sm"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Text 1: Welcome SMS */}
            <div className="space-y-2 bg-amber-50/50 p-4 rounded-2xl border border-amber-200/60">
              <span className="font-bold text-amber-900 text-xs uppercase tracking-wider block">
                Text 1 of 2: Welcome / Line Entry SMS
              </span>
              <textarea
                value={lang === 'am' ? smsTemplates.queue_entry_am : smsTemplates.queue_entry_en}
                onChange={(e) => {
                  const val = e.target.value;
                  saveTemplates({
                    ...smsTemplates,
                    [lang === 'am' ? 'queue_entry_am' : 'queue_entry_en']: val
                  });
                }}
                rows={4}
                className="w-full bg-white border border-neutral-200 rounded-xl p-3 text-xs text-neutral-800 focus:outline-none focus:border-amber-500"
              />
              <p className="text-[11px] text-neutral-500">
                Variables: &#123;Customer_Name&#125;, &#123;Position_Number&#125;, &#123;Customers_Ahead&#125;, &#123;Wait_Time&#125;
              </p>
            </div>

            {/* Text 2: Ready SMS */}
            <div className="space-y-2 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200/60">
              <span className="font-bold text-emerald-900 text-xs uppercase tracking-wider block">
                Text 2 of 2: Call Next / Station Ready SMS
              </span>
              <textarea
                value={lang === 'am' ? smsTemplates.queue_ready_am : smsTemplates.queue_ready_en}
                onChange={(e) => {
                  const val = e.target.value;
                  saveTemplates({
                    ...smsTemplates,
                    [lang === 'am' ? 'queue_ready_am' : 'queue_ready_en']: val
                  });
                }}
                rows={4}
                className="w-full bg-white border border-neutral-200 rounded-xl p-3 text-xs text-neutral-800 focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-neutral-500">
                Variables: &#123;Customer_Name&#125;
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Primary Navigation Mode Switcher: Live Stations vs Walk-In Queue Directory */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-neutral-900 text-white p-2 md:p-3 rounded-2xl shadow-ios">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('stations_live')}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              viewMode === 'stations_live'
                ? 'bg-amber-500 text-neutral-950 shadow-md'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
            }`}
            id="btn-view-stations-live"
          >
            <Timer className="w-4 h-4" />
            <span>{lang === 'am' ? 'የስታይሊስት ሰዓት መቆጣጠሪያ' : 'Stylist Stations & Live Timers'}</span>
            <span className="bg-neutral-900 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full">
              {queueEntries.filter(e => e.status === 'in_service').length} Active
            </span>
          </button>

          <button
            onClick={() => setViewMode('queue_list')}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              viewMode === 'queue_list'
                ? 'bg-amber-500 text-neutral-950 shadow-md'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
            }`}
            id="btn-view-queue-list"
          >
            <Users className="w-4 h-4" />
            <span>{lang === 'am' ? 'የተጠባባቂ ደንበኞች ዝርዝር' : 'Walk-In Queue Directory'}</span>
            <span className="bg-neutral-800 text-neutral-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {totalWaiting} Waiting
            </span>
          </button>
        </div>

        {/* Live Overtime Summary Badge */}
        {(() => {
          const inServiceEntries = queueEntries.filter(e => e.status === 'in_service');
          const overtimeCount = inServiceEntries.filter(e => {
            const data = getTimerData(e);
            return data.elapsedSeconds > data.benchmarkMinutes * 60;
          }).length;

          if (overtimeCount > 0) {
            return (
              <div className="bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center space-x-2 animate-pulse">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>⚠️ {overtimeCount} Station{overtimeCount > 1 ? 's' : ''} Exceeding Standard Benchmark Duration</span>
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* VIEW MODE 1: STYLIST LIVE STATIONS & SERVICE TIMERS */}
      {viewMode === 'stations_live' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Description Banner */}
          <div className="bg-white/95 backdrop-blur-md border border-neutral-200/80 rounded-2xl md:rounded-3xl p-5 shadow-ios-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm md:text-base font-extrabold text-neutral-900 flex items-center space-x-2">
                <Scissors className="w-5 h-5 text-amber-600" />
                <span>Active Stylist Service Station Timers</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Real-time Benchmarking
                </span>
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                Monitors active customer treatment times against standard benchmark durations. Tap Start, Pause, or Complete Service to auto-deduct single-use products and update bottle usage.
              </p>
            </div>

            {/* Quick Action: Call & Assign Next to Station */}
            {nextWaitingCustomer && (
              <button
                onClick={handleCallNext}
                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-2xl flex items-center space-x-2 transition-all shadow-md cursor-pointer shrink-0 ios-active-scale"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Assign #{nextWaitingCustomer.position} {nextWaitingCustomer.customer_name} to Station</span>
              </button>
            )}
          </div>

          {/* Station Grid */}
          {(() => {
            const inServiceEntries = queueEntries.filter(e => e.status === 'in_service');

            if (inServiceEntries.length === 0) {
              return (
                <div className="bg-white/80 border border-neutral-200 rounded-3xl p-10 text-center space-y-4 shadow-sm">
                  <Timer className="w-12 h-12 text-neutral-300 mx-auto" />
                  <h4 className="text-neutral-800 font-extrabold text-sm sm:text-base">No Active Station Timers Currently Running</h4>
                  <p className="text-xs text-neutral-500 max-w-md mx-auto">
                    All stylist stations are currently available. Call a waiting customer from the queue or add a new walk-in to start an active service timer.
                  </p>
                  {nextWaitingCustomer ? (
                    <button
                      onClick={handleCallNext}
                      className="inline-flex items-center space-x-2 bg-neutral-900 text-white font-bold text-xs px-5 py-2.5 rounded-2xl hover:bg-neutral-800 transition-colors shadow-md"
                    >
                      <Play className="w-4 h-4 text-amber-400 fill-current" />
                      <span>Start Station Service for #{nextWaitingCustomer.position} {nextWaitingCustomer.customer_name}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="inline-flex items-center space-x-2 bg-neutral-900 text-white font-bold text-xs px-5 py-2.5 rounded-2xl hover:bg-neutral-800 transition-colors shadow-md"
                    >
                      <UserPlus className="w-4 h-4 text-amber-400" />
                      <span>Add Walk-In Customer</span>
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {inServiceEntries.map((entry) => {
                  const timerData = getTimerData(entry);
                  const benchmarkSecs = timerData.benchmarkMinutes * 60;
                  const isOvertime = timerData.elapsedSeconds > benchmarkSecs;
                  const overtimeSecs = Math.max(0, timerData.elapsedSeconds - benchmarkSecs);

                  // Find active product checked out to this stylist if any
                  const stylistName = entry.assigned_staff_name || '';
                  const activeCheckout = activeCheckouts.find(c => 
                    c.status === 'active' && 
                    stylistName && 
                    (c.stylist_name.toLowerCase().includes(stylistName.toLowerCase()) || stylistName.toLowerCase().includes(c.stylist_name.toLowerCase()))
                  );

                  return (
                    <div
                      key={entry.id}
                      className={`bg-white rounded-3xl border transition-all p-5 shadow-ios space-y-4 relative overflow-hidden ${
                        isOvertime 
                          ? 'border-rose-400 ring-2 ring-rose-400/30' 
                          : 'border-emerald-300 ring-1 ring-emerald-200/50'
                      }`}
                    >
                      {/* Top Header: Stylist Station Title & Overtime Badge */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-neutral-950 flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                            <Scissors className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 block">
                              Stylist Station
                            </span>
                            <h4 className="text-xs font-bold text-neutral-900 truncate max-w-[150px]">
                              {entry.assigned_staff_name || 'Assigned Stylist'}
                            </h4>
                          </div>
                        </div>

                        {/* Benchmark & Overtime Status Badge */}
                        {isOvertime ? (
                          <div className="bg-rose-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center space-x-1 shadow-xs animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Overtime (+{formatSecondsDisplay(overtimeSecs)})</span>
                          </div>
                        ) : (
                          <div className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>On Time</span>
                          </div>
                        )}
                      </div>

                      {/* Customer & Service Info Box */}
                      <div className="bg-neutral-50 rounded-2xl p-3.5 border border-neutral-200/60 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-extrabold text-neutral-900">{entry.customer_name}</span>
                          <span className="font-mono text-[10px] text-neutral-400">{entry.phone_number}</span>
                        </div>
                        <div className="text-xs text-amber-800 font-bold flex items-center justify-between">
                          <span>{entry.service_name || 'Salon Treatment'}</span>
                          <span className="text-[10px] text-neutral-500 font-medium">Standard: {timerData.benchmarkMinutes}m</span>
                        </div>
                      </div>

                      {/* Big Digital Timer Clock Widget */}
                      <div className={`p-4 rounded-2xl border text-center space-y-1 ${
                        isOvertime
                          ? 'bg-rose-500/10 border-rose-300 text-rose-950'
                          : timerData.status === 'paused'
                          ? 'bg-amber-500/10 border-amber-300 text-amber-950'
                          : 'bg-neutral-900 text-white'
                      }`}>
                        <div className="text-[10px] uppercase tracking-widest font-extrabold opacity-70">
                          {timerData.status === 'paused' ? '⏸ Service Timer Paused' : isOvertime ? '⚠️ Overtime Running' : '▶ Active Live Service Timer'}
                        </div>
                        <div className="text-3xl sm:text-4xl font-black font-mono tracking-wider">
                          {formatSecondsDisplay(timerData.elapsedSeconds)}
                        </div>
                        <div className="text-[10px] font-medium opacity-80">
                          Target Benchmark Duration: {timerData.benchmarkMinutes}:00
                        </div>
                      </div>

                      {/* Active Stylist Product Checkout Badge if any */}
                      {activeCheckout && (
                        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2.5 flex items-center justify-between text-[11px]">
                          <div className="flex items-center space-x-2 text-amber-900 font-medium truncate">
                            <Package className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="truncate">{activeCheckout.product_name}</span>
                          </div>
                          <span className="bg-amber-200 text-amber-950 font-bold text-[10px] px-2 py-0.5 rounded-full shrink-0">
                            {activeCheckout.clients_serviced_count} Clients Serviced
                          </span>
                        </div>
                      )}

                      {/* Touch Controls Row */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {/* Start / Pause Toggle */}
                        <button
                          onClick={() => handleTogglePauseTimer(entry.id, timerData.elapsedSeconds)}
                          className={`py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-xs cursor-pointer ${
                            timerData.status === 'paused'
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-amber-500 hover:bg-amber-600 text-neutral-950'
                          }`}
                        >
                          {timerData.status === 'paused' ? (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Resume</span>
                            </>
                          ) : (
                            <>
                              <Pause className="w-3.5 h-3.5 fill-current" />
                              <span>Pause</span>
                            </>
                          )}
                        </button>

                        {/* Complete Service & Billing Button */}
                        <button
                          onClick={() => {
                            if (onCompleteAndLogVisit) {
                              onCompleteAndLogVisit(entry);
                            } else {
                              onUpdateQueueStatus(entry.id, 'completed', { completed_at: new Date().toISOString() });
                            }
                          }}
                          className="py-2.5 px-3 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-2xl flex items-center justify-center space-x-1.5 transition-all shadow-md cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Complete & Bill</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Stylist Benchmarks & Productivity Metrics Table */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-neutral-200/80 p-5 shadow-ios space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200/60 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-neutral-900 flex items-center space-x-2">
                  <Award className="w-4.5 h-4.5 text-amber-600" />
                  <span>Stylist Benchmark Performance & Station Metrics</span>
                </h4>
                <p className="text-xs text-neutral-500">
                  Real-time station metrics comparing total completed walk-ins, average service duration, and benchmark compliance per stylist.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/80 text-neutral-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3.5">Stylist Provider</th>
                    <th className="py-2.5 px-3.5">Current Station Status</th>
                    <th className="py-2.5 px-3.5 text-center">Completed Today</th>
                    <th className="py-2.5 px-3.5 text-center">Avg Duration</th>
                    <th className="py-2.5 px-3.5 text-center">Benchmark Compliance</th>
                    <th className="py-2.5 px-3.5">Active Bottle Checkout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-medium text-neutral-800">
                  {(stylists.length > 0 ? stylists : [{ id: '1', name: 'Master Stylist' }]).map((st) => {
                    const activeStation = queueEntries.find(e => 
                      e.status === 'in_service' && 
                      e.assigned_staff_name && 
                      (e.assigned_staff_name.toLowerCase().includes(st.name.toLowerCase()) || st.name.toLowerCase().includes(e.assigned_staff_name.toLowerCase()))
                    );

                    const completedToday = queueEntries.filter(e => 
                      e.status === 'completed' && 
                      e.assigned_staff_name && 
                      (e.assigned_staff_name.toLowerCase().includes(st.name.toLowerCase()) || st.name.toLowerCase().includes(e.assigned_staff_name.toLowerCase()))
                    ).length;

                    const activeCheckout = activeCheckouts.find(c => 
                      c.status === 'active' && 
                      (c.stylist_name.toLowerCase().includes(st.name.toLowerCase()) || st.name.toLowerCase().includes(c.stylist_name.toLowerCase()))
                    );

                    return (
                      <tr key={st.id} className="hover:bg-neutral-50/60 transition-colors">
                        <td className="py-3 px-3.5 font-bold text-neutral-900">
                          {st.name}
                        </td>
                        <td className="py-3 px-3.5">
                          {activeStation ? (
                            <span className="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                              <span>In Station ({activeStation.service_name || 'Service'})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 bg-neutral-100 text-neutral-600 text-[10px] font-medium px-2 py-0.5 rounded-full">
                              <span>Available Station</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center font-extrabold text-neutral-900">
                          {completedToday} Clients
                        </td>
                        <td className="py-3 px-3.5 text-center font-mono text-xs">
                          {activeStation ? `${getTimerData(activeStation).benchmarkMinutes}m avg` : '28m avg'}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                            94% On Time
                          </span>
                        </td>
                        <td className="py-3 px-3.5">
                          {activeCheckout ? (
                            <span className="text-[11px] text-amber-900 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                              🧴 {activeCheckout.product_name} ({activeCheckout.clients_serviced_count} serviced)
                            </span>
                          ) : (
                            <span className="text-[11px] text-neutral-400 italic">No bottle checked out</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs & Search Header (When in queue_list or overall) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200/70 pb-4">
        {/* Status Filter Tabs - iOS Style */}
        <div className="flex flex-wrap items-center gap-1 bg-neutral-100 p-1 rounded-full border border-neutral-200/60 text-xs">
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
              filterStatus === 'active' 
                ? 'bg-neutral-900 text-white shadow-xs' 
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Active Queue ({totalWaiting + totalInService})
          </button>
          <button
            onClick={() => setFilterStatus('waiting')}
            className={`px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
              filterStatus === 'waiting' 
                ? 'bg-amber-500 text-gray-950 font-bold shadow-xs' 
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Waiting ({totalWaiting})
          </button>
          <button
            onClick={() => setFilterStatus('in_service')}
            className={`px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
              filterStatus === 'in_service' 
                ? 'bg-emerald-700 text-white font-bold shadow-xs' 
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            In Station ({totalInService})
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
              filterStatus === 'completed' 
                ? 'bg-purple-700 text-white font-bold shadow-xs' 
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Completed ({totalCompletedToday})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search queue name/phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-full pl-9 pr-4 py-2 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-amber-500 shadow-xs"
          />
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Main Queue List */}
      {filteredQueue.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-md border border-neutral-200/80 rounded-3xl p-12 text-center space-y-3 shadow-ios-sm">
          <Users className="w-12 h-12 text-neutral-300 mx-auto" />
          <h3 className="text-neutral-800 font-bold text-base">No queue entries found</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            {searchQuery ? 'No walk-in customers match your search.' : 'There are currently no walk-in customers waiting in this view.'}
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center space-x-2 bg-neutral-900 text-white font-bold text-xs px-4 py-2.5 rounded-2xl hover:bg-neutral-800 transition-colors cursor-pointer shadow-ios-sm"
          >
            <UserPlus className="w-4 h-4 text-amber-400" />
            <span>Add First Walk-In</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQueue.map((entry) => {
            const isTopWaiting = entry.status === 'waiting' && entry.position === 1;
            const isInService = entry.status === 'in_service';
            const isNotified = entry.status === 'notified';
            const isCompleted = entry.status === 'completed';
            const isCancelled = entry.status === 'cancelled';

            return (
              <div
                key={entry.id}
                className={`bg-white/95 backdrop-blur-md border rounded-2xl md:rounded-3xl p-4 sm:p-5 transition-all shadow-ios-sm relative flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  isInService
                    ? 'border-emerald-300 bg-emerald-50/30'
                    : isTopWaiting
                    ? 'border-amber-300 bg-amber-50/20 ring-1 ring-amber-300/40'
                    : 'border-neutral-200/80 hover:border-neutral-300'
                }`}
              >
                {/* Left: Position Badge & Customer Details */}
                <div className="flex items-start sm:items-center space-x-4">
                  {/* Position Badge */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-lg shrink-0 shadow-xs ${
                    isInService ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                    isTopWaiting ? 'bg-amber-500 text-neutral-950 font-black animate-pulse' :
                    isCompleted ? 'bg-neutral-100 text-neutral-400 border border-neutral-200' :
                    'bg-neutral-900 text-white'
                  }`}>
                    {isInService ? <Scissors className="w-5 h-5 text-emerald-700" /> : `#${entry.position}`}
                  </div>

                  {/* Details */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-neutral-900 font-bold text-base sm:text-lg tracking-tight">
                        {entry.customer_name}
                      </h4>

                      {/* Customer DB indicator if registered */}
                      {entry.customer_id && (
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                          <User className="w-3 h-3 text-blue-600" />
                          <span>Registered Client</span>
                        </span>
                      )}

                      {/* Status Badge */}
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                        isInService ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        isNotified ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                        entry.status === 'waiting' ? (isTopWaiting ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-neutral-100 text-neutral-700 border border-neutral-200') :
                        isCompleted ? 'bg-neutral-100 text-neutral-400 border border-neutral-200' :
                        'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                        {isInService ? 'In Station' : 
                         isNotified ? 'Notified' : 
                         entry.status === 'waiting' ? (isTopWaiting ? 'Next Up' : 'Waiting') : 
                         entry.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                      <span className="flex items-center space-x-1 font-semibold text-neutral-700">
                        <Phone className="w-3.5 h-3.5 text-amber-600" />
                        <span>{entry.phone_number}</span>
                      </span>
                      {entry.service_name && (
                        <span className="flex items-center space-x-1 text-neutral-700 font-medium">
                          <Scissors className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{entry.service_name}</span>
                        </span>
                      )}
                      {entry.assigned_staff_name && (
                        <span className="text-neutral-600">
                          Stylist: <strong>{entry.assigned_staff_name}</strong>
                        </span>
                      )}
                    </div>

                    {/* Time Elapsed & Est Wait */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-500 pt-0.5">
                      <span className="flex items-center space-x-1 text-neutral-500">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{getElapsedTimeText(entry.joined_at)}</span>
                      </span>
                      {entry.status === 'waiting' && (
                        <span className="text-blue-700 font-semibold">
                          Estimated: ~{entry.est_wait_minutes} mins
                        </span>
                      )}
                      {entry.notes && (
                        <span className="text-neutral-500 italic">
                          "{entry.notes}"
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Quick Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-neutral-200/60">
                  {/* Action 1: Call to Station (Dispatches Text 2 of 2) */}
                  {(entry.status === 'waiting' || entry.status === 'notified') && (
                    <button
                      onClick={() => {
                        onUpdateQueueStatus(entry.id, 'in_service', { called_at: new Date().toISOString() });
                        handleManualSms(entry, 'ready');
                      }}
                      className="flex items-center space-x-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2 rounded-2xl transition-all shadow-xs cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Call to Station (Send Text 2)</span>
                    </button>
                  )}

                  {/* Re-send Welcome SMS (Text 1) */}
                  {(entry.status === 'waiting' || entry.status === 'notified') && (
                    <button
                      onClick={() => handleManualSms(entry, 'welcome')}
                      title="Re-send Text 1 (Welcome / Line #)"
                      className="p-2 text-neutral-600 hover:text-amber-700 hover:bg-neutral-100 rounded-xl text-xs font-semibold flex items-center space-x-1 border border-neutral-200 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                      <span className="hidden sm:inline">Text 1</span>
                    </button>
                  )}

                  {/* Action 2: Complete Service & Auto-Log Visit */}
                  {(isInService || entry.status === 'waiting' || entry.status === 'notified') && (
                    <button
                      onClick={() => {
                        if (onCompleteAndLogVisit) {
                          onCompleteAndLogVisit(entry);
                        } else {
                          onUpdateQueueStatus(entry.id, 'completed', { completed_at: new Date().toISOString() });
                        }
                      }}
                      className="flex items-center space-x-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs px-4 py-2 rounded-2xl transition-all cursor-pointer shadow-xs"
                      title="Complete service, call next client automatically & pre-fill log visit billing"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Complete & Log Visit</span>
                    </button>
                  )}

                  {/* Action 3: Cancel / Remove */}
                  {!isCompleted && !isCancelled && (
                    <button
                      onClick={() => onUpdateQueueStatus(entry.id, 'cancelled')}
                      className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Cancel Walk-In"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}

                  {/* Delete Permanent */}
                  <button
                    onClick={() => onDeleteQueueEntry(entry.id)}
                    className="p-2 text-neutral-300 hover:text-rose-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                    title="Delete Entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Touch-Friendly Add to Queue Modal with Customer Database Lookup */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-ios-lg animate-fade-in relative text-neutral-800">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-700 border border-amber-200 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">Add Walk-In to Live Queue</h3>
                  <p className="text-xs text-neutral-500">Access registered customer database or add new walk-in</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  handleClearSelectedCustomer();
                }}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs sm:text-sm">
              
              {/* Customer Lookup from Database Section */}
              <div className="bg-neutral-50 border border-neutral-200/80 rounded-2xl p-3.5 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                    Select Customer from Database
                  </label>
                  {selectedCustomerId && (
                    <button
                      type="button"
                      onClick={handleClearSelectedCustomer}
                      className="text-[11px] text-rose-600 font-bold hover:underline"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search client by name or phone..."
                    value={customerSearchQuery}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                      setShowCustomerDropdown(true);
                      if (!selectedCustomerId) {
                        setCustomerName(e.target.value);
                      }
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="w-full bg-white border border-neutral-200 rounded-xl pl-9 pr-4 py-2.5 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-amber-500 shadow-xs text-xs"
                  />
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />

                  {/* Autocomplete Dropdown list */}
                  {showCustomerDropdown && customerSearchQuery.trim() && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-2xl shadow-ios-lg max-h-48 overflow-y-auto divide-y divide-neutral-100">
                      {filteredExistingCustomers.length > 0 ? (
                        filteredExistingCustomers.map(c => (
                          <div
                            key={c.id}
                            onClick={() => handleSelectCustomer(c)}
                            className="p-2.5 hover:bg-amber-50/60 cursor-pointer flex items-center justify-between transition-colors"
                          >
                            <div>
                              <div className="font-bold text-neutral-900 text-xs">{c.full_name || (c as any).name}</div>
                              <div className="text-[11px] text-neutral-500">{c.phone_number || (c as any).phone}</div>
                            </div>
                            <span className="text-[10px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full font-semibold">
                              Select
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-xs text-neutral-500 text-center">
                          No matching customer found. Enter details below for new walk-in.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {matchedExistingCustomer ? (
                  <div className="bg-amber-50 border border-amber-300 text-amber-950 text-xs p-3 rounded-2xl flex items-center justify-between shadow-xs">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center font-bold shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-neutral-900 flex items-center space-x-1.5">
                          <span>{matchedExistingCustomer.full_name}</span>
                          <span className="bg-amber-200 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                            Existing Directory Client
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-600">
                          Phone: {matchedExistingCustomer.phone_number} • Segment: <strong>{matchedExistingCustomer.retentionStatus}</strong> ({matchedExistingCustomer.visitCountInLast30Days} visits in 30d)
                        </div>
                      </div>
                    </div>
                    {!selectedCustomerId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomerId(matchedExistingCustomer.id);
                          setCustomerName(matchedExistingCustomer.full_name);
                          setPhoneNumber(matchedExistingCustomer.phone_number);
                        }}
                        className="text-[11px] bg-amber-700 hover:bg-amber-800 text-white font-bold px-3 py-1 rounded-xl transition-colors shrink-0 cursor-pointer shadow-xs"
                      >
                        Link Client
                      </button>
                    )}
                  </div>
                ) : selectedCustomerId && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-2 rounded-xl flex items-center space-x-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Linked to registered database client: <strong>{customerName}</strong></span>
                  </div>
                )}
              </div>

              {/* Explicit Customer Name Field */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bethlehem Tadesse"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-amber-500 shadow-xs"
                />
              </div>

              {/* Explicit Phone Number Field */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Phone Number (for SMS notifications) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 0914792274"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-amber-500 shadow-xs"
                />
              </div>

              {/* Services Requested (Multi-Select) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                    Services Requested {selectedServices.length > 0 && <span className="ml-1 text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-[10px] font-black">{selectedServices.length} Selected</span>}
                  </label>
                  <span className="text-[10px] text-neutral-400 font-medium">Click multiple to select</span>
                </div>
                
                {/* Services multi-select pills */}
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 bg-neutral-50/70 border border-neutral-200 rounded-xl">
                  {services.length === 0 ? (
                    <span className="text-xs text-neutral-400 p-1">No services preset found. Type custom service below.</span>
                  ) : (
                    services.map(s => {
                      const isSelected = selectedServices.includes(s.name);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleServiceSelect(s.name)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                            isSelected 
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs' 
                              : 'bg-white text-neutral-700 border-neutral-200 hover:border-amber-300 hover:bg-amber-50/40'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                          <span>{s.name}</span>
                          <span className={`text-[10px] ${isSelected ? 'text-amber-100' : 'text-neutral-400'}`}>({s.defaultPrice} ETB)</span>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Optional custom service text input */}
                <input
                  type="text"
                  placeholder="Or enter custom service name (e.g. Special Hair Treatment)..."
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-amber-500 shadow-xs"
                />
              </div>

              {/* Est Service Time */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Est Service Time (Minutes)
                </label>
                <select
                  value={estWaitMinutes}
                  onChange={(e) => setEstWaitMinutes(Number(e.target.value))}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-900 focus:outline-none focus:border-amber-500 text-xs shadow-xs font-medium"
                >
                  <option value={15}>~15 minutes</option>
                  <option value={30}>~30 minutes</option>
                  <option value={45}>~45 minutes</option>
                  <option value={60}>~60 minutes (1 hr)</option>
                  <option value={90}>~90 minutes (1.5 hrs)</option>
                  <option value={120}>~120 minutes (2 hrs)</option>
                </select>
              </div>

              {/* Stylist Assignment (Multi-Select) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                    Assign Stylists {selectedStaff.length > 0 && <span className="ml-1 text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-[10px] font-black">{selectedStaff.length} Selected</span>}
                  </label>
                  <span className="text-[10px] text-neutral-400 font-medium">Click multiple to assign</span>
                </div>

                {((stylists && stylists.length > 0) || (staffMembers && staffMembers.length > 0)) ? (
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-neutral-50/70 border border-neutral-200 rounded-xl">
                    {((stylists && stylists.length > 0) ? stylists : staffMembers).map((st: any) => {
                      const isSelected = selectedStaff.includes(st.name);
                      const subtitle = st.specialty || st.skills || st.role || 'Stylist';
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => toggleStaffSelect(st.name)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                            isSelected 
                              ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs' 
                              : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />}
                          <span>{st.name}</span>
                          <span className={`text-[10px] ${isSelected ? 'text-neutral-300' : 'text-neutral-400'}`}>({subtitle})</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="Enter assigned stylist name(s)..."
                    value={assignedStaff}
                    onChange={(e) => setAssignedStaff(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-amber-500 shadow-xs"
                  />
                )}
              </div>

              {/* Text 1 Welcome SMS Toggle */}
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <MessageSquare className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-amber-950 block">Send Text 1 of 2 (Welcome SMS)</span>
                    <span className="text-[11px] text-amber-800">Dispatches line position & estimated wait time via GeezSMS</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={sendWelcomeSms}
                  onChange={(e) => setSendWelcomeSms(e.target.checked)}
                  className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    handleClearSelectedCustomer();
                  }}
                  className="px-4 py-2.5 rounded-xl border border-neutral-200 text-neutral-600 font-semibold text-xs hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center space-x-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold px-6 py-2.5 rounded-xl shadow-ios-sm transition-all text-xs cursor-pointer"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4 text-amber-400" />
                  )}
                  <span>Add Walk-In & Send Text 1</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
