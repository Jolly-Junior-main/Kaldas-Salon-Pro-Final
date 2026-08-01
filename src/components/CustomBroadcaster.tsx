import React, { useState, useMemo } from 'react';
import { Search, Send, Users, User, Info, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface Customer {
  id: string;
  full_name: string;
  phone_number: string;
}

interface CustomBroadcasterProps {
  customers: Customer[];
  lang: 'am' | 'en';
  dict: any;
  onRefreshLogs: () => void;
}

export default function CustomBroadcaster({ customers, lang, dict, onRefreshLogs }: CustomBroadcasterProps) {
  const [recipientType, setRecipientType] = useState<'single' | 'all'>('single');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  
  // Sending process states
  const [isSending, setIsSending] = useState(false);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [sendingResults, setSendingResults] = useState<{ phone: string; name: string; status: 'success' | 'failed'; error?: string }[]>([]);
  const [showStatusSummary, setShowStatusSummary] = useState(false);

  // Amharic character detection for SMS length estimation
  const isAmharic = useMemo(() => {
    if (!customMessage) return false;
    // Basic Ethiopic range is 1200-137F (Decimal 4608-4991)
    return /[\u1200-\u137F]/.test(customMessage);
  }, [customMessage]);

  const smsLengthSpecs = useMemo(() => {
    const len = customMessage.length;
    if (len === 0) return { chars: 0, parts: 0, maxPerPart: isAmharic ? 70 : 160 };
    const maxPerPart = isAmharic ? 70 : 160;
    const parts = Math.ceil(len / maxPerPart);
    return { chars: len, parts, maxPerPart };
  }, [customMessage, isAmharic]);

  // Filter matching customers for dropdown select
  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return [];
    return customers.filter(c => 
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone_number.includes(searchQuery)
    ).slice(0, 5);
  }, [searchQuery, customers]);

  // Handle single SMS dispatch
  const handleSendSingle = async () => {
    const targetPhone = selectedCustomer ? selectedCustomer.phone_number : null;
    const targetName = selectedCustomer ? selectedCustomer.full_name : '';
    
    if (!targetPhone || !customMessage.trim()) return;

    setIsSending(true);
    setProgressTotal(1);
    setProgressCurrent(0);
    setSuccessCount(0);
    setFailedCount(0);
    setSendingResults([]);
    setShowStatusSummary(true);

    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: targetPhone, message: customMessage.trim() })
      });
      
      const data = await res.json();
      setProgressCurrent(1);
      
      if (res.ok && data.success) {
        setSuccessCount(1);
        setSendingResults([{ phone: targetPhone, name: targetName, status: 'success' }]);
      } else {
        setFailedCount(1);
        setSendingResults([{ phone: targetPhone, name: targetName, status: 'failed', error: data.error || 'Server error' }]);
      }
    } catch (err) {
      setProgressCurrent(1);
      setFailedCount(1);
      setSendingResults([{ phone: targetPhone, name: targetName, status: 'failed', error: 'Network failure' }]);
    } finally {
      setIsSending(false);
      onRefreshLogs();
    }
  };

  // Handle bulk SMS dispatch
  const handleSendBulk = async () => {
    if (customers.length === 0 || !customMessage.trim()) return;

    const confirmMsg = lang === 'am'
      ? `እርግጠኛ ነዎት ይህንን የኤስኤምኤስ መልዕክት ለሁሉም ${customers.length} ደንበኞች መላክ ይፈልጋሉ?`
      : `Are you sure you want to broadcast this custom SMS to all ${customers.length} registered customers?`;

    if (!window.confirm(confirmMsg)) return;

    setIsSending(true);
    setProgressTotal(customers.length);
    setProgressCurrent(0);
    setSuccessCount(0);
    setFailedCount(0);
    setSendingResults([]);
    setShowStatusSummary(true);

    // Dispatch SMS sequentially to prevent rate limits or overloading
    for (let i = 0; i < customers.length; i++) {
      const client = customers[i];
      setProgressCurrent(i + 1);

      try {
        const res = await fetch('/api/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: client.phone_number, message: customMessage.trim() })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          setSuccessCount(prev => prev + 1);
          setSendingResults(prev => [...prev, { phone: client.phone_number, name: client.full_name, status: 'success' }]);
        } else {
          setFailedCount(prev => prev + 1);
          setSendingResults(prev => [...prev, { phone: client.phone_number, name: client.full_name, status: 'failed', error: data.error || 'Gateway rejected' }]);
        }
      } catch (err) {
        setFailedCount(prev => prev + 1);
        setSendingResults(prev => [...prev, { phone: client.phone_number, name: client.full_name, status: 'failed', error: 'Connection failed' }]);
      }

      // Small pause between dispatches to behave nicely
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setIsSending(false);
    onRefreshLogs();
  };

  const handleReset = () => {
    setSelectedCustomer(null);
    setSearchQuery('');
    setCustomMessage('');
    setShowStatusSummary(false);
    setSendingResults([]);
  };

  return (
    <div className="bg-neutral-50/50 border border-neutral-200/50 rounded-2xl p-5 md:p-6 space-y-4 animate-fade-in" id="custom-sms-broadcaster">
      <div className="flex items-center justify-between border-b border-neutral-200/40 pb-3">
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#A89F91] flex items-center gap-1.5">
            <span>📢</span> {lang === 'am' ? 'የበዓል እና ልዩ ኤስኤምኤስ መላኪያ ማዕከል' : 'Holiday & Event Custom SMS Broadcaster'}
          </h3>
          <p className="text-[10px] text-neutral-400 mt-1 font-medium">
            {lang === 'am' 
              ? 'ለደንበኞችዎ የበዓል ምኞቶች ወይም ጠቅላላ ማስታወቂያዎችን በአንድ ጊዜ ወይም በተናጠል ይላኩ።' 
              : 'Broadcast custom holiday greetings, special announcements, or custom updates to your client base.'}
          </p>
        </div>
      </div>

      {/* Recipient Mode Selection */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setRecipientType('single'); handleReset(); }}
          className={`flex-1 flex items-center justify-center gap-2 p-3.5 rounded-xl border transition-all duration-200 ${
            recipientType === 'single'
              ? 'bg-neutral-900 border-neutral-900 text-white shadow-sm'
              : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          <User className="w-4 h-4" />
          <div className="text-left">
            <p className="text-[11px] font-extrabold leading-tight">
              {lang === 'am' ? 'ለአንድ ደንበኛ' : 'Single Recipient'}
            </p>
            <p className={`text-[8.5px] leading-tight mt-0.5 ${recipientType === 'single' ? 'text-neutral-300' : 'text-neutral-400'}`}>
              {lang === 'am' ? 'አንድ የተመረጠ ደንበኛ' : 'Select a specific client'}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => { setRecipientType('all'); handleReset(); }}
          className={`flex-1 flex items-center justify-center gap-2 p-3.5 rounded-xl border transition-all duration-200 ${
            recipientType === 'all'
              ? 'bg-neutral-900 border-neutral-900 text-white shadow-sm'
              : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <div className="text-left">
            <p className="text-[11px] font-extrabold leading-tight">
              {lang === 'am' ? 'ለሁሉም ደንበኞች' : 'Bulk Broadcast'}
            </p>
            <p className={`text-[8.5px] leading-tight mt-0.5 ${recipientType === 'all' ? 'text-neutral-300' : 'text-neutral-400'}`}>
              {lang === 'am' ? `ለሁሉም ${customers.length} ደንበኞች` : `Broadcast to all ${customers.length} clients`}
            </p>
          </div>
        </button>
      </div>

      {/* Single Customer Selection Dropdown */}
      {recipientType === 'single' && (
        <div className="space-y-2 animate-fade-in">
          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
            {lang === 'am' ? 'ደንበኛ ይምረጡ' : 'Select Customer'}
          </label>
          
          {selectedCustomer ? (
            <div className="flex items-center justify-between p-3 bg-white border border-neutral-200 rounded-xl">
              <div className="text-xs">
                <p className="font-extrabold text-neutral-850">{selectedCustomer.full_name}</p>
                <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{selectedCustomer.phone_number}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-lg"
              >
                {lang === 'am' ? 'ቀይር' : 'Change'}
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'am' ? 'የደንበኛ ስም ወይም ስልክ ቁጥር በመጻፍ ይፈልጉ...' : 'Search customer by name or phone...'}
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 font-medium text-neutral-800 placeholder:text-neutral-350"
              />
              
              {filteredCustomers.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-neutral-200/80 rounded-xl shadow-lg z-10 overflow-hidden divide-y divide-neutral-100 animate-fade-in">
                  {filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(c);
                        setSearchQuery('');
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-neutral-50 flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <span className="font-bold text-neutral-800">{c.full_name}</span>
                        <span className="text-[10px] text-neutral-400 font-mono ml-2">({c.phone_number})</span>
                      </div>
                      <span className="text-[9px] font-bold bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded">
                        {lang === 'am' ? 'ይምረጡ' : 'Select'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Message Writing Area */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            {lang === 'am' ? 'የመልዕክት ይዘት' : 'Custom Message Content'}
          </label>
          <span className="text-[10px] text-neutral-400 font-mono">
            {smsLengthSpecs.chars} chars • <strong>{smsLengthSpecs.parts} {lang === 'am' ? 'ክፍል' : 'part(s)'}</strong> ({smsLengthSpecs.maxPerPart} limit)
          </span>
        </div>
        <textarea
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          rows={4}
          placeholder={lang === 'am' 
            ? 'ውድ ደንበኛችን፥ እንኳን ለብርሃነ መስቀሉ አደረሳችሁ እያልን፤ በሳሎናችን ልዩ ልዩ ቅናሾች ተዘጋጅተዋል። ካልዳስ ውበት ሳሎን!'
            : 'Dear Valued Client, wishing you a wonderful Holiday season! We are offering an exclusive 15% VIP discount on hair & nails this week at Kaldas Beauty Salon. Call to book!'}
          className="w-full p-4 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 font-medium text-neutral-800 placeholder:text-neutral-350 leading-relaxed"
          maxLength={500}
        />
        <div className="flex items-center gap-1.5 bg-[#FAF8F5] p-2.5 rounded-xl border border-[#E5D5C8]/40 text-[9.5px] text-[#846E54] font-medium leading-normal">
          <Info className="w-3.5 h-3.5 shrink-0 text-[#A37E3E]" />
          <span>
            {isAmharic 
              ? (lang === 'am' ? 'ማሳሰቢያ፦ የሳባ/አማርኛ ሆሄያት ስላሉበት አንድ ኤስኤምኤስ በ 70 ፊደላት ይገደባል።' : 'Notice: Ethiopic/Unicode text detected. SMS charging is limited to 70 chars per page.')
              : (lang === 'am' ? 'ማሳሰቢያ፦ የላቲን ፊደላት ብቻ ስላሉበት አንድ ኤስኤምኤስ በ 160 ፊደላት ይገደባል።' : 'Notice: Latin characters only. Standard 160 characters per SMS limit applies.')}
          </span>
        </div>
      </div>

      {/* Action dispatch button */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={recipientType === 'single' ? handleSendSingle : handleSendBulk}
          disabled={isSending || !customMessage.trim() || (recipientType === 'single' && !selectedCustomer)}
          className="flex-1 py-3 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md ios-active-scale"
        >
          {isSending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                {lang === 'am' 
                  ? `በመላክ ላይ... (${progressCurrent}/${progressTotal})` 
                  : `Dispatching... (${progressCurrent}/${progressTotal})`}
              </span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>
                {recipientType === 'single'
                  ? (lang === 'am' ? 'አሁን ላክ' : 'Send SMS Now')
                  : (lang === 'am' ? `ለሁሉም መልክተኛ ላክ (${customers.length})` : `Broadcast to All (${customers.length})`)}
              </span>
            </>
          )}
        </button>

        {customMessage && (
          <button
            type="button"
            onClick={handleReset}
            disabled={isSending}
            className="px-4 py-3 border border-neutral-200 hover:bg-neutral-50 rounded-xl text-xs font-bold text-neutral-600 transition-colors"
          >
            {lang === 'am' ? 'አጽዳ' : 'Clear'}
          </button>
        )}
      </div>

      {/* Sending Report and Live Status Summary */}
      {showStatusSummary && (
        <div className="bg-white border border-neutral-200/60 rounded-xl p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
            <h4 className="text-[11px] font-extrabold text-neutral-800">
              {lang === 'am' ? 'የመላክ ሁኔታ ማጠቃለያ' : 'Dispatch Summary Report'}
            </h4>
            <button
              type="button"
              onClick={() => setShowStatusSummary(false)}
              className="text-[10px] text-neutral-400 hover:text-neutral-600"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-neutral-50 p-2 rounded-lg">
              <span className="block text-[8px] uppercase tracking-wider font-extrabold text-neutral-400">{lang === 'am' ? 'ጠቅላላ' : 'Total'}</span>
              <span className="text-sm font-bold text-neutral-800">{progressTotal}</span>
            </div>
            <div className="bg-emerald-50 text-emerald-800 p-2 rounded-lg">
              <span className="block text-[8px] uppercase tracking-wider font-extrabold text-emerald-500">{lang === 'am' ? 'የተሳካ' : 'Success'}</span>
              <span className="text-sm font-bold text-emerald-700">{successCount}</span>
            </div>
            <div className="bg-rose-50 text-rose-800 p-2 rounded-lg">
              <span className="block text-[8px] uppercase tracking-wider font-extrabold text-rose-500">{lang === 'am' ? 'ያልተሳካ' : 'Failed'}</span>
              <span className="text-sm font-bold text-rose-700">{failedCount}</span>
            </div>
          </div>

          {/* Progress bar */}
          {isSending && (
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] font-bold text-neutral-400">
                <span>{lang === 'am' ? 'በማስተላለፍ ላይ...' : 'Progress:'}</span>
                <span>{Math.round((progressCurrent / progressTotal) * 100)}%</span>
              </div>
              <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-neutral-900 h-full transition-all duration-300"
                  style={{ width: `${(progressCurrent / progressTotal) * 100}%` }}
                />
              </div>
            </div>
          )}

          {sendingResults.some(r => r.status === 'failed' && r.error && r.error.toLowerCase().includes('safaricom')) && (
            <div className="p-2.5 rounded-lg bg-amber-50 text-[10px] text-amber-850 leading-normal border border-amber-200/50">
              💡 <strong>{lang === 'am' ? 'የሳፋሪኮም ማሳሰቢያ' : 'Safaricom Notice'}:</strong>{' '}
              {lang === 'am'
                ? 'ለሳፋሪኮም ስልኮች ለመላክ የላኪ ስም (Sender Name) በሳፋሪኮም መጽደቅ አለበት። እባክዎ GeezSMSን ያነጋግሩ።'
                : 'To send messages to Safaricom numbers, your Sender Name must be whitelisted on Safaricom. Please contact GeezSMS support.'}
            </div>
          )}

          {/* Scrollable list of results */}
          {sendingResults.length > 0 && (
            <div className="max-h-32 overflow-y-auto divide-y divide-neutral-100 text-[10px] border border-neutral-150 rounded-lg">
              {sendingResults.map((r, idx) => (
                <div key={idx} className="p-2 flex items-center justify-between">
                  <div className="font-medium">
                    <span className="font-bold text-neutral-800">{r.name}</span>{' '}
                    <span className="text-neutral-400 font-mono">({r.phone})</span>
                  </div>
                  <div className="flex items-center gap-1 font-bold">
                    {r.status === 'success' ? (
                      <span className="text-emerald-600 flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        {lang === 'am' ? 'ተልኳል' : 'Sent'}
                      </span>
                    ) : (
                      <span className="text-rose-600 flex items-center gap-0.5" title={r.error}>
                        <XCircle className="w-3 h-3 text-rose-500" />
                        {lang === 'am' ? 'አልተሳካም' : 'Failed'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
