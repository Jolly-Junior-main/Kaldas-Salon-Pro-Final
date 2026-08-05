/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  CustomerWithRetention, 
  Language, 
  Visit, 
  PREDEFINED_SERVICES, 
  SmsTemplates, 
  DEFAULT_SMS_TEMPLATES, 
  QueueEntry, 
  QueueStatus, 
  DEFAULT_QUEUE_SMS_TEMPLATES, 
  formatQueueSms,
  InventoryProduct,
  ActiveProductCheckout,
  InventoryLog,
  PREDEFINED_INVENTORY_PRODUCTS,
  UserRole
} from './types';
import { TRANSLATIONS, translateName, translateServiceName, translateCategory, translateSkills } from './translations';
import RegistrationForm from './components/RegistrationForm';
import CheckInModal from './components/CheckInModal';
import ClientDashboard from './components/ClientDashboard';
import AdminAnalytics from './components/AdminAnalytics';
import QueueDashboard from './components/QueueDashboard';
import InventoryDashboard from './components/InventoryDashboard';
import KonjoLogo from './components/KonjoLogo';
import BirthdayWishModal from './components/BirthdayWishModal';
import CustomBroadcaster from './components/CustomBroadcaster';
// @ts-expect-error - Vite handles jpg asset loading, TS bypass
import salonInterior from './assets/images/luxury_beauty_salon_1781874528973.jpg';
// @ts-expect-error - Vite handles jpg asset loading, TS bypass
import salonVector from './assets/images/salon_vector_1781800194768.jpg';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError, cleanUndefined } from './lib/firebase';
import { classifyCustomer } from './lib/retention';
import { convertToEthiopian, formatEthiopianDate } from './lib/ethiopianCalendar';
import { 
  Users, 
  Search, 
  UserPlus, 
  Sparkles, 
  HelpCircle, 
  Smartphone, 
  MessageSquare,
  Filter, 
  Award, 
  Plus, 
  ChevronRight, 
  Calendar,
  Layers,
  LineChart,
  UserCheck,
  Trash2,
  Settings,
  LogOut,
  Gift,
  ChevronDown,
  ChevronUp,
  Scissors,
  X,
  Eye,
  EyeOff,
  Clock,
  Package,
  CreditCard
} from 'lucide-react';

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [rawCustomers, setRawCustomers] = useState<any[]>([]);
  const [allVisits, setAllVisits] = useState<any[]>([]);
  const [isBirthdayCollapsed, setIsBirthdayCollapsed] = useState(false);

  useEffect(() => {
    // Detect mobile and auto-collapse the birthday notification by default
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsBirthdayCollapsed(true);
    }
  }, []);

  // Real-time calculated reactive customers classification pipeline
  const customers = React.useMemo(() => {
    const curTime = new Date();
    return rawCustomers.map((c) => classifyCustomer(c, allVisits, curTime));
  }, [rawCustomers, allVisits]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<'All' | 'Frequent' | 'Occasional' | 'At-Risk'>('All');
  const [activeTab, setActiveTab] = useState<'clients' | 'queue' | 'inventory' | 'analytics' | 'settings' | 'sms-logs'>('queue');
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProduct[]>([]);
  const [activeCheckouts, setActiveCheckouts] = useState<ActiveProductCheckout[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [showCheckInDrawer, setShowCheckInDrawer] = useState(false);
  const [preSelectedForVisit, setPreSelectedForVisit] = useState<CustomerWithRetention | null>(null);
  const [preSelectedServicesForVisit, setPreSelectedServicesForVisit] = useState<string[]>([]);
  const [preSelectedArtistsForVisit, setPreSelectedArtistsForVisit] = useState<string[]>([]);
  const [uiFeedback, setUiFeedback] = useState<string | null>(null);
  // Cashier real-time payment popup alert — set when walkin marks service complete
  const [cashierPaymentAlert, setCashierPaymentAlert] = useState<QueueEntry | null>(null);
  
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [isSmsSaving, setIsSmsSaving] = useState(false);
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplates>(DEFAULT_SMS_TEMPLATES);
  const [isTemplatesSaving, setIsTemplatesSaving] = useState(false);

  const [tempWelcomeAm, setTempWelcomeAm] = useState('');
  const [tempWelcomeEn, setTempWelcomeEn] = useState('');
  const [tempBillingAm, setTempBillingAm] = useState('');
  const [tempBillingEn, setTempBillingEn] = useState('');

  useEffect(() => {
    if (smsTemplates) {
      setTempWelcomeAm(smsTemplates.welcome_am || DEFAULT_SMS_TEMPLATES.welcome_am);
      setTempWelcomeEn(smsTemplates.welcome_en || DEFAULT_SMS_TEMPLATES.welcome_en);
      setTempBillingAm(smsTemplates.billing_am || DEFAULT_SMS_TEMPLATES.billing_am);
      setTempBillingEn(smsTemplates.billing_en || DEFAULT_SMS_TEMPLATES.billing_en);
    }
  }, [smsTemplates]);
  
  const [showRegPanel, setShowRegPanel] = useState(false);
  const [loading, setLoading] = useState(true);

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('kaldas_logged_in') === 'true';
  });
  const [userRole, setUserRole] = useState<UserRole | null>(() => {
    return (localStorage.getItem('kaldas_user_role') as UserRole) || null;
  });
  const [loggedInUser, setLoggedInUser] = useState<string>(() => {
    return localStorage.getItem('kaldas_logged_user') || '';
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Staff registry state
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState<UserRole>('cashier');
  const [staffPassword, setStaffPassword] = useState('');

  // Role Access Control Helpers
  const isTabAllowedForRole = (tab: typeof activeTab, role: UserRole | null): boolean => {
    if (!role) return false;
    if (role === 'admin') return true;
    if (tab === 'queue') return role === 'walkin' || role === 'cashier' || role === 'assistant';
    if (tab === 'clients') return role === 'cashier' || role === 'walkin';
    if (tab === 'inventory') return role === 'inventory';
    return false;
  };

  const getDefaultTabForUserRole = (role: UserRole | null): typeof activeTab => {
    if (role === 'inventory') return 'inventory';
    if (role === 'cashier') return 'clients';
    if (role === 'walkin' || role === 'assistant' || role === 'admin') return 'queue';
    return 'queue';
  };

  // Auto-enforce tab access permission
  useEffect(() => {
    if (isLoggedIn && userRole) {
      if (!isTabAllowedForRole(activeTab, userRole)) {
        setActiveTab(getDefaultTabForUserRole(userRole));
      }
    }
  }, [isLoggedIn, userRole, activeTab]);

  // Treatment Artists state
  const [artistsList, setArtistsList] = useState<any[]>([]);
  const [artistName, setArtistName] = useState('');
  const [artistSkills, setArtistSkills] = useState('');
  const [artistSpecialty, setArtistSpecialty] = useState<'Hair' | 'Nails' | 'Skin' | 'Massage' | 'General'>('General');

  // Services state
  const [salonServices, setSalonServices] = useState<any[]>([]);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState<'Hair' | 'Nails' | 'Skin' | 'Massage' | 'Product'>('Hair');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingServiceName, setEditingServiceName] = useState('');
  const [editingServiceCategory, setEditingServiceCategory] = useState<'Hair' | 'Nails' | 'Skin' | 'Massage' | 'Product'>('Hair');
  const [editingServicePrice, setEditingServicePrice] = useState('');

  // Birthday wishes states
  const [birthdayWishes, setBirthdayWishes] = useState<any[]>([]);
  const [birthdayWishCustomer, setBirthdayWishCustomer] = useState<any | null>(null);
  const [bdaySearchQuery, setBdaySearchQuery] = useState('');

  const dict = TRANSLATIONS[lang];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (cleanUser === 'admin1' && (cleanPass === 'Admin1' || cleanPass === 'admin1')) {
      setIsLoggedIn(true);
      setUserRole('admin');
      setLoggedInUser('Admin1');
      localStorage.setItem('kaldas_logged_in', 'true');
      localStorage.setItem('kaldas_user_role', 'admin');
      localStorage.setItem('kaldas_logged_user', 'Admin1');
      setActiveTab('queue');
      setLoginError('');
      return;
    }

    const matched = staffList.find(s => (s?.name || '').trim().toLowerCase() === cleanUser && s.password === cleanPass);
    if (matched) {
      const role = matched.role as UserRole;
      setIsLoggedIn(true);
      setUserRole(role);
      setLoggedInUser(matched.name);
      localStorage.setItem('kaldas_logged_in', 'true');
      localStorage.setItem('kaldas_user_role', role);
      localStorage.setItem('kaldas_logged_user', matched.name);
      setActiveTab(getDefaultTabForUserRole(role));
      setLoginError('');
    } else {
      setLoginError(lang === 'am' ? 'የተሳሳተ የተጠቃሚ ስም ወይም የይለፍ ቃል!' : 'Incorrect username or password!');
    }
  };

  // Subscribe to staff members — always use live Firestore data for login matching
  useEffect(() => {
    const unsubStaff = onSnapshot(collection(db, 'staff'), (snapshot) => {
      const staffData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setStaffList(staffData);
    }, (err) => {
      console.warn('Firestore Staff Subscribe Error:', err);
    });

    return () => unsubStaff();
  }, []);

  // Real-time synchronization listeners for operational collections
  useEffect(() => {
    if (!isLoggedIn) return;

    // 1. Subscribe to Services — always use live Firestore data
    const unsubServices = onSnapshot(collection(db, 'services'), (snapshot) => {
      const servicesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSalonServices(servicesData);
    }, (err) => {
      console.warn('Firestore Services Subscribe Error:', err);
    });

    // 2. Subscribe to Visits
    const unsubVisits = onSnapshot(collection(db, 'visits'), (snapshot) => {
      const visitsData: any[] = [];
      snapshot.forEach((doc) => {
        visitsData.push({ id: doc.id, ...doc.data() });
      });
      setAllVisits(visitsData);
    }, (err) => {
      console.warn("Firestore Visits Subscribe Error:", err);
    });

    // 3. Subscribe to Customers
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const customersData: any[] = [];
      snapshot.forEach((doc) => {
        customersData.push({ id: doc.id, ...doc.data() });
      });
      setRawCustomers(customersData);
      setLoading(false);
    }, (err) => {
      console.warn("Firestore Customers Subscribe Error:", err);
      // Even on error, clear loading so UI doesn't hang on "Syncing..."
      setLoading(false);
    });

    // Safety net: clear loading state after 5s in case Firestore never responds
    const loadingTimeout = setTimeout(() => setLoading(false), 5000);

    // 4. Subscribe to Treatment Artists — always use live Firestore data
    const unsubArtists = onSnapshot(collection(db, 'artists'), (snapshot) => {
      const artistsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setArtistsList(artistsData);
    }, (err) => {
      console.warn('Firestore Artists Subscribe Error:', err);
    });

    // 5. Subscribe to Birthday wishes campaign log
    const unsubWishes = onSnapshot(collection(db, 'birthday_wishes'), (snapshot) => {
      const wishesData: any[] = [];
      snapshot.forEach((doc) => {
        wishesData.push({ id: doc.id, ...doc.data() });
      });
      setBirthdayWishes(wishesData.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()));
    }, (err) => {
      console.error("Firestore Birthday Wishes Subscribe Error:", err);
    });

    // 5b. Subscribe to SMS logs collection (real-time with REST fallback)
    const unsubSmsLogs = onSnapshot(collection(db, 'sms_logs'), (snapshot) => {
      const logsData: any[] = [];
      snapshot.forEach((doc) => {
        logsData.push({ id: doc.id, ...doc.data() });
      });
      setSmsLogs(logsData.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()));
    }, (err) => {
      console.warn("Firestore SMS Logs subscription bypassed:", err);
    });

    // 5c. Subscribe to Queue Entries — real-time across ALL logged-in windows
    const unsubQueue = onSnapshot(collection(db, 'queue_entries'), (snapshot) => {
      const qData: QueueEntry[] = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as QueueEntry));

      // Always update state with whatever Firestore gives us (empty = no active queue right now)
      setQueueEntries(qData);

      // ─── Instant Cashier Payment Popup ───────────────────────────────────────
      // Detect entries that just became completed+unbilled (came from walkin role)
      // Use sessionStorage to track which entries we've already shown a popup for
      if (qData.length > 0) {
        const alreadyAlerted = new Set<string>(
          JSON.parse(sessionStorage.getItem('kaldas_alerted_payments') || '[]')
        );
        const newlyCompleted = qData.filter(e =>
          e.status === 'completed' &&
          !(e as any).billed &&
          !alreadyAlerted.has(e.id)
        );
        if (newlyCompleted.length > 0) {
          const latest = newlyCompleted.sort((a, b) =>
            new Date((b as any).completed_at || b.joined_at).getTime() -
            new Date((a as any).completed_at || a.joined_at).getTime()
          )[0];
          newlyCompleted.forEach(e => alreadyAlerted.add(e.id));
          sessionStorage.setItem('kaldas_alerted_payments', JSON.stringify([...alreadyAlerted]));
          const currentRole = localStorage.getItem('kaldas_user_role');
          if (currentRole === 'cashier' || currentRole === 'admin') {
            setCashierPaymentAlert(latest);
          }
        }
      }
    }, (err) => {
      console.warn('Firestore Queue Subscribe Error:', err);
    });

    // Fetch initial SMS logs from cache endpoint
    fetch('/api/sms/logs')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSmsLogs(prev => {
            // merge logs avoiding duplicates, sorted by sent_at
            const combined = [...data];
            prev.forEach(p => {
              if (!combined.some(c => c.id === p.id)) {
                combined.push(p);
              }
            });
            return combined.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
          });
        }
      })
      .catch(err => console.debug("Initial cached SMS logs load bypassed:", err));

    // Fetch initial SMS status from REST API instantly as a reliable failsafe
    fetch('/api/settings/sms-status')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.enabled === 'boolean') {
          setSmsEnabled(data.enabled);
        }
      })
      .catch(err => console.debug("Initial REST SMS status load bypassed:", err));

    // 6. Subscribe to SMS config setting (real-time toggle with REST API fallback)
    let isSubscribed = true;
    let fallbackInterval: NodeJS.Timeout | null = null;

    const unsubSmsConfig = onSnapshot(doc(db, 'settings', 'sms'), (docSnap) => {
      if (!isSubscribed) return;
      if (docSnap.exists()) {
        const val = docSnap.data().enabled !== false;
        setSmsEnabled(val);
        // Keep backend server in sync
        fetch('/api/settings/sms-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: val })
        }).catch(err => console.debug("Error syncing SMS status to server:", err));
      } else {
        // Initialize in Firestore if it doesn't exist yet
        setDoc(doc(db, 'settings', 'sms'), { enabled: true }).catch(err => {
          console.debug("Bypassed settings/sms Firestore auto-creation:", err);
        });
        setSmsEnabled(true);
      }
    }, (err) => {
      console.warn("Firestore SMS Config subscription bypassed, falling back to REST polling:", err.message);
      
      // If Firestore subscription is blocked or propagating, fall back to REST API polling
      if (isSubscribed && !fallbackInterval) {
        fallbackInterval = setInterval(() => {
          fetch('/api/settings/sms-status')
            .then(res => res.json())
            .then(data => {
              if (data && typeof data.enabled === 'boolean' && isSubscribed) {
                setSmsEnabled(data.enabled);
              }
            })
            .catch(e => console.debug("REST polling SMS status failed:", e));
        }, 5000);
      }
    });

    // 6b. Subscribe to SMS Custom Templates in Firestore
    const unsubSmsTemplates = onSnapshot(doc(db, 'settings', 'sms_templates'), (docSnap) => {
      if (!isSubscribed) return;
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSmsTemplates({
          welcome_am: data.welcome_am || DEFAULT_SMS_TEMPLATES.welcome_am,
          welcome_en: data.welcome_en || DEFAULT_SMS_TEMPLATES.welcome_en,
          billing_am: data.billing_am || DEFAULT_SMS_TEMPLATES.billing_am,
          billing_en: data.billing_en || DEFAULT_SMS_TEMPLATES.billing_en,
        });
      } else {
        setSmsTemplates(DEFAULT_SMS_TEMPLATES);
      }
    }, (err) => {
      console.warn("Firestore SMS Templates subscription bypassed:", err);
    });

    // 6c. Subscribe to Inventory Products — always use live Firestore data
    const unsubInvProducts = onSnapshot(collection(db, 'inventory_products'), (snapshot) => {
      const prods: InventoryProduct[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InventoryProduct));
      setInventoryProducts(prods);
    }, (err) => console.warn('Firestore Inventory Products subscribe error:', err));

    // 6d. Subscribe to Active Checkouts collection
    const unsubCheckouts = onSnapshot(collection(db, 'active_checkouts'), (snapshot) => {
      const checkouts: ActiveProductCheckout[] = [];
      snapshot.forEach((docSnap) => {
        checkouts.push({ id: docSnap.id, ...docSnap.data() } as ActiveProductCheckout);
      });
      setActiveCheckouts(checkouts);
    }, (err) => console.warn("Firestore Active Checkouts subscribe error:", err));

    // 6e. Subscribe to Inventory Audit Logs collection
    const unsubInvLogs = onSnapshot(collection(db, 'inventory_logs'), (snapshot) => {
      const logs: InventoryLog[] = [];
      snapshot.forEach((docSnap) => {
        logs.push({ id: docSnap.id, ...docSnap.data() } as InventoryLog);
      });
      setInventoryLogs(logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }, (err) => console.warn("Firestore Inventory Logs subscribe error:", err));

    return () => {
      isSubscribed = false;
      unsubServices();
      unsubVisits();
      unsubCustomers();
      unsubArtists();
      unsubWishes();
      unsubSmsLogs();
      unsubQueue();
      unsubSmsConfig();
      unsubSmsTemplates();
      unsubInvProducts();
      unsubCheckouts();
      unsubInvLogs();
      clearTimeout(loadingTimeout);
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [isLoggedIn]);

  const handleSaveTemplates = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTemplatesSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'sms_templates'), {
        welcome_am: tempWelcomeAm.trim(),
        welcome_en: tempWelcomeEn.trim(),
        billing_am: tempBillingAm.trim(),
        billing_en: tempBillingEn.trim(),
      });
      setUiFeedback(lang === 'am' ? 'የኤስኤምኤስ ቴምፕሌቶች በተሳካ ሁኔታ ተቀምጠዋል!' : 'SMS templates saved successfully!');
      setTimeout(() => setUiFeedback(null), 3000);
    } catch (err: any) {
      console.error("Error saving templates to Firestore:", err);
      alert(lang === 'am' ? 'ቴምፕሌቶችን ማስቀመጥ አልተቻለም።' : 'Failed to save templates.');
    } finally {
      setIsTemplatesSaving(false);
    }
  };

  // --- QUEUE MANAGEMENT ACTION HANDLERS ---
  const handleAddQueueEntry = async (entry: Omit<QueueEntry, 'id' | 'position' | 'joined_at'>) => {
    const id = `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const waitingCount = queueEntries.filter(e => e.status === 'waiting' || e.status === 'notified').length;
    const position = waitingCount + 1;
    const newEntry: QueueEntry = {
      ...entry,
      id,
      position,
      joined_at: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'queue_entries', id), cleanUndefined(newEntry));
    } catch (e) {
      console.warn("Firestore queue setDoc fallback:", e);
    }
    setQueueEntries(prev => {
      const updated = [...prev, newEntry];
      localStorage.setItem('konjo_queue_entries_cache', JSON.stringify(updated));
      return updated;
    });
  };

  const autoAdvanceQueueNext = async (currentQueue: QueueEntry[]) => {
    // Find active waiting customer at position #1
    const waitingList = currentQueue
      .filter(e => e.status === 'waiting' || e.status === 'notified')
      .sort((a, b) => a.position - b.position || new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());

    const nextCustomer = waitingList[0];
    if (!nextCustomer) return null;

    const nextUpdate: QueueEntry = {
      ...nextCustomer,
      status: 'in_service',
      called_at: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'queue_entries', nextCustomer.id), cleanUndefined(nextUpdate), { merge: true });
    } catch (e) {
      console.warn("Firestore auto-advance queue fallback:", e);
    }

    // Format & dispatch Text 2 Ready SMS
    const templatesSaved = localStorage.getItem('konjo_queue_sms_templates');
    let templates = DEFAULT_QUEUE_SMS_TEMPLATES;
    if (templatesSaved) {
      try { templates = JSON.parse(templatesSaved); } catch (e) {}
    }
    const tpl = lang === 'am' ? templates.queue_ready_am : templates.queue_ready_en;
    const msg = formatQueueSms(tpl, { customer_name: nextCustomer.customer_name });

    await handleSendQueueSms(nextCustomer.phone_number, msg);

    setQueueEntries(prev => {
      const updated = prev.map(e => e.id === nextCustomer.id ? nextUpdate : e);
      const remainingWaiting = updated
        .filter(e => e.status === 'waiting' || e.status === 'notified')
        .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
      
      remainingWaiting.forEach((item, idx) => {
        item.position = idx + 1;
      });

      localStorage.setItem('konjo_queue_entries_cache', JSON.stringify(updated));
      return updated;
    });

    return nextCustomer;
  };

  const handleUpdateQueueStatus = async (id: string, newStatus: QueueStatus, customUpdate?: Partial<QueueEntry>) => {
    const existing = queueEntries.find(e => e.id === id);
    if (!existing) return;

    const updatedEntry: QueueEntry = {
      ...existing,
      status: newStatus,
      ...customUpdate
    };

    try {
      await setDoc(doc(db, 'queue_entries', id), cleanUndefined(updatedEntry), { merge: true });
    } catch (e) {
      console.warn("Firestore setDoc update fallback:", e);
    }

    let updatedQueueState: QueueEntry[] = [];

    setQueueEntries(prev => {
      const updated = prev.map(e => e.id === id ? updatedEntry : e);
      // Recalculate queue positions for active waiting entries
      const waitingList = updated
        .filter(e => e.status === 'waiting' || e.status === 'notified')
        .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
      
      waitingList.forEach((item, idx) => {
        item.position = idx + 1;
      });

      localStorage.setItem('konjo_queue_entries_cache', JSON.stringify(updated));
      updatedQueueState = updated;
      return updated;
    });

    // Automatically trigger next client call if current service is completed
    if (newStatus === 'completed') {
      setTimeout(() => {
        autoAdvanceQueueNext(updatedQueueState);
      }, 100);
    }
  };

  const handleAddCustomerFromQueue = async (custData: { full_name: string; phone_number: string; notes_preferences?: string }): Promise<CustomerWithRetention | null> => {
    try {
      const newCustRef = doc(collection(db, 'customers'));
      const newCust: any = {
        id: newCustRef.id,
        full_name: custData.full_name,
        phone_number: custData.phone_number,
        notes_preferences: custData.notes_preferences || '',
        created_at: new Date().toISOString()
      };
      await setDoc(newCustRef, newCust);
      const withRetention: CustomerWithRetention = {
        ...newCust,
        visitCountInLast30Days: 0,
        totalVisitsCount: 0,
        lastVisitDate: null,
        daysSinceLastVisit: null,
        retentionStatus: 'New Client' as const
      };
      setRawCustomers(prev => [...prev, newCust]);
      return withRetention;
    } catch (e) {
      console.error("Failed to add customer from queue:", e);
      return null;
    }
  };

  // Helper to remove undefined properties before sending to Firestore
  const cleanUndefined = <T extends Record<string, any>>(obj: T): T => {
    const clean: any = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) {
        clean[key] = obj[key];
      }
    }
    return clean;
  };

  // --- INVENTORY MODULE HANDLERS ---
  const handleAddInventoryProduct = async (prod: Omit<InventoryProduct, 'id' | 'created_at'>) => {
    try {
      const pRef = doc(collection(db, 'inventory_products'));
      const newProd: InventoryProduct = cleanUndefined({
        ...prod,
        id: pRef.id,
        created_at: new Date().toISOString()
      });
      await setDoc(pRef, newProd);
      
      const logRef = doc(collection(db, 'inventory_logs'));
      await setDoc(logRef, cleanUndefined({
        id: logRef.id,
        product_id: newProd.id,
        product_name: newProd.name,
        action: 'restock',
        quantity_changed: newProd.stock_quantity,
        details: `Created product catalog item: ${newProd.name} (${newProd.stock_quantity} ${newProd.unit_name})`,
        timestamp: new Date().toISOString()
      }));
    } catch (e) {
      console.error("Error adding inventory product:", e);
    }
  };

  const handleUpdateInventoryProduct = async (id: string, updates: Partial<InventoryProduct>) => {
    try {
      await updateDoc(doc(db, 'inventory_products', id), cleanUndefined(updates));
    } catch (e) {
      console.error("Error updating inventory product:", e);
    }
  };

  const handleDeleteInventoryProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'inventory_products', id));
    } catch (e) {
      console.error("Error deleting inventory product:", e);
    }
  };

  const handleCheckoutInventoryProduct = async (
    productId: string,
    stylistId: string,
    stylistName: string,
    forceOverride?: boolean,
    overrideReason?: string
  ): Promise<{ success: boolean; warning?: string }> => {
    try {
      const product = inventoryProducts.find(p => p.id === productId);
      if (!product) return { success: false, warning: 'Selected product not found.' };

      if (product.stock_quantity <= 0) {
        return { success: false, warning: `Out of Stock: ${product.name} has no remaining units.` };
      }

      // Check Multi-Use restriction engine
      if (product.category_type === 'multiple_use') {
        const activeCheckout = activeCheckouts.find(
          c => c.product_id === productId && c.stylist_id === stylistId && c.status === 'active'
        );

        if (activeCheckout && activeCheckout.clients_serviced_count < activeCheckout.target_min_clients && !forceOverride) {
          // Log flagged attempt
          const logRef = doc(collection(db, 'inventory_logs'));
          await setDoc(logRef, cleanUndefined({
            id: logRef.id,
            product_id: product.id,
            product_name: product.name,
            action: 'flagged_attempt',
            stylist_name: stylistName,
            quantity_changed: 0,
            details: `Premature checkout blocked: Stylist ${stylistName} currently has 1 active ${product.name} checked out (Only ${activeCheckout.clients_serviced_count}/${activeCheckout.target_min_clients} clients serviced).`,
            timestamp: new Date().toISOString()
          }));

          // Required exact warning string
          const exactWarning = `Warning: Stylist ${stylistName} currently has 1 active ${product.name} checked out (Only ${activeCheckout.clients_serviced_count} clients serviced so far). Please complete or return the current bottle before checking out another.`;
          return { success: false, warning: exactWarning };
        }

        // Proceed with multi-use checkout
        await updateDoc(doc(db, 'inventory_products', product.id), {
          stock_quantity: Math.max(0, product.stock_quantity - 1)
        });

        const checkoutRef = doc(collection(db, 'active_checkouts'));
        const newCheckout: ActiveProductCheckout = {
          id: checkoutRef.id,
          product_id: product.id,
          product_name: product.name,
          stylist_id: stylistId,
          stylist_name: stylistName,
          clients_serviced_count: 0,
          target_min_clients: product.min_clients_per_unit || 5,
          status: 'active',
          checked_out_at: new Date().toISOString()
        };
        if (forceOverride) {
          newCheckout.notes = `Admin Force Override: ${overrideReason || 'Approved'}`;
        }
        await setDoc(checkoutRef, cleanUndefined(newCheckout));

        const logRef = doc(collection(db, 'inventory_logs'));
        await setDoc(logRef, cleanUndefined({
          id: logRef.id,
          product_id: product.id,
          product_name: product.name,
          action: 'checkout_multi',
          stylist_name: stylistName,
          quantity_changed: -1,
          details: `Checked out 1 multi-use bottle of ${product.name} to Stylist ${stylistName} (Target: ${newCheckout.target_min_clients} clients)${forceOverride ? ' [FORCE OVERRIDDEN]' : ''}`,
          timestamp: new Date().toISOString()
        }));

        return { success: true };
      } else {
        // Single-Use Consumable Checkout
        await updateDoc(doc(db, 'inventory_products', product.id), {
          stock_quantity: Math.max(0, product.stock_quantity - 1)
        });

        const logRef = doc(collection(db, 'inventory_logs'));
        await setDoc(logRef, cleanUndefined({
          id: logRef.id,
          product_id: product.id,
          product_name: product.name,
          action: 'checkout_single',
          stylist_name: stylistName,
          quantity_changed: -1,
          details: `Checked out 1 single-use consumable of ${product.name} to Stylist ${stylistName}`,
          timestamp: new Date().toISOString()
        }));

        return { success: true };
      }
    } catch (e) {
      console.error("Error during product checkout:", e);
      return { success: false, warning: 'Database transaction error occurred during checkout.' };
    }
  };

  const handleIncrementCheckoutUsage = async (checkoutId: string) => {
    try {
      const target = activeCheckouts.find(c => c.id === checkoutId);
      if (!target) return;

      const newCount = target.clients_serviced_count + 1;
      await updateDoc(doc(db, 'active_checkouts', checkoutId), {
        clients_serviced_count: newCount
      });

      const logRef = doc(collection(db, 'inventory_logs'));
      await setDoc(logRef, {
        id: logRef.id,
        product_id: target.product_id,
        product_name: target.product_name,
        action: 'service_usage_increment',
        stylist_name: target.stylist_name,
        quantity_changed: 0,
        details: `Serviced 1 client using ${target.product_name} by Stylist ${target.stylist_name} (${newCount}/${target.target_min_clients} clients total)`,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error incrementing checkout usage:", e);
    }
  };

  const handleCompleteCheckout = async (checkoutId: string, reason?: string) => {
    try {
      const target = activeCheckouts.find(c => c.id === checkoutId);
      if (!target) return;

      await updateDoc(doc(db, 'active_checkouts', checkoutId), {
        status: 'completed',
        completed_at: new Date().toISOString()
      });

      const logRef = doc(collection(db, 'inventory_logs'));
      await setDoc(logRef, {
        id: logRef.id,
        product_id: target.product_id,
        product_name: target.product_name,
        action: 'completed_bottle',
        stylist_name: target.stylist_name,
        quantity_changed: 0,
        details: `Marked bottle finished/empty for ${target.product_name} held by ${target.stylist_name} (${target.clients_serviced_count} total clients serviced). ${reason || ''}`,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error completing checkout:", e);
    }
  };

  const handleRestockInventoryProduct = async (productId: string, quantityToAdd: number) => {
    try {
      const product = inventoryProducts.find(p => p.id === productId);
      if (!product) return;

      const newQty = product.stock_quantity + quantityToAdd;
      await updateDoc(doc(db, 'inventory_products', productId), {
        stock_quantity: newQty
      });

      const logRef = doc(collection(db, 'inventory_logs'));
      await setDoc(logRef, {
        id: logRef.id,
        product_id: product.id,
        product_name: product.name,
        action: 'restock',
        quantity_changed: quantityToAdd,
        details: `Restocked +${quantityToAdd} ${product.unit_name} of ${product.name} (New Total: ${newQty})`,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error restocking product:", e);
    }
  };

  const handleAutoDeductInventoryOnServiceComplete = async (serviceName: string, stylistName?: string) => {
    try {
      // 1. Auto-increment usage on active multi-use product checkout for this stylist
      if (stylistName) {
        const activeForStylist = activeCheckouts.filter(
          c => c.status === 'active' && (
            (c.stylist_name || '').toLowerCase().includes((stylistName || '').toLowerCase()) ||
            (stylistName || '').toLowerCase().includes((c.stylist_name || '').toLowerCase())
          )
        );
        for (const checkout of activeForStylist) {
          await handleIncrementCheckoutUsage(checkout.id);
        }
      }

      // 2. Auto-deduct single-use consumables matched by service name or category keywords
      const lowerService = (serviceName || '').toLowerCase();
      const singleUseConsumables = inventoryProducts.filter(p => p.category_type === 'single_use' && p.stock_quantity > 0);

      let matchedConsumables = singleUseConsumables.filter(p => {
        const pLower = p.name.toLowerCase();
        if (lowerService.includes('color') || lowerService.includes('dye') || lowerService.includes('balayage')) {
          return pLower.includes('dye') || pLower.includes('color') || pLower.includes('cape');
        }
        if (lowerService.includes('facial') || lowerService.includes('skin')) {
          return pLower.includes('mask') || pLower.includes('sheet');
        }
        if (lowerService.includes('cut') || lowerService.includes('blowout') || lowerService.includes('styling')) {
          return pLower.includes('cape');
        }
        return false;
      });

      if (matchedConsumables.length === 0 && singleUseConsumables.length > 0) {
        const defaultCape = singleUseConsumables.find(p => p.name.toLowerCase().includes('cape')) || singleUseConsumables[0];
        if (defaultCape) matchedConsumables = [defaultCape];
      }

      for (const item of matchedConsumables) {
        const newQty = Math.max(0, item.stock_quantity - 1);
        await updateDoc(doc(db, 'inventory_products', item.id), { stock_quantity: newQty });

        const logRef = doc(collection(db, 'inventory_logs'));
        await setDoc(logRef, {
          id: logRef.id,
          product_id: item.id,
          product_name: item.name,
          action: 'checkout_single',
          stylist_name: stylistName || 'Station Auto',
          quantity_changed: -1,
          details: `Auto-deducted 1 unit of ${item.name} upon service completion (${serviceName})`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error("Error auto-deducting inventory on service complete:", e);
    }
  };

  const handleCompleteAndLogVisit = (entry: QueueEntry, forceOpenModal = false) => {
    // 1. Auto-deduct single-use consumables & increment multi-use bottle usage count for stylist
    handleAutoDeductInventoryOnServiceComplete(entry.service_name || '', entry.assigned_staff_name || '');

    // 2. Mark entry as completed and auto-advance queue (sets billed: false so cashier sees it)
    handleUpdateQueueStatus(entry.id, 'completed', { completed_at: new Date().toISOString(), billed: false });

    // 3. Match client in directory by ID, phone, or name
    let custMatch = customers.find(c => {
      if (entry.customer_id && c.id === entry.customer_id) return true;
      const cPhone = (c.phone_number || (c as any).phone || '').replace(/\s+/g, '');
      const ePhone = (entry.phone_number || '').replace(/\s+/g, '');
      const cName = (c.full_name || (c as any).name || '').toLowerCase().trim();
      const eName = (entry.customer_name || '').toLowerCase().trim();
      if (ePhone && cPhone && cPhone === ePhone) return true;
      if (eName && cName && cName === eName) return true;
      return false;
    });

    // 4. Match services used from entry.service_name
    const serviceIds: string[] = [];
    if (entry.service_name && salonServices.length > 0) {
      const parts = entry.service_name.split(',').map(s => s.trim().toLowerCase());
      salonServices.forEach(srv => {
        const srvLower = srv.name.toLowerCase();
        if (parts.some(p => p.length > 0 && (srvLower.includes(p) || p.includes(srvLower)))) {
          if (!serviceIds.includes(srv.id)) serviceIds.push(srv.id);
        }
      });
    }

    // 5. Match stylists used from entry.assigned_staff_name
    const artistIds: string[] = [];
    if (entry.assigned_staff_name && artistsList.length > 0) {
      const parts = entry.assigned_staff_name.split(',').map(s => s.trim().toLowerCase());
      artistsList.forEach(art => {
        const artLower = art.name.toLowerCase();
        if (parts.some(p => p.length > 0 && (artLower.includes(p) || p.includes(artLower)))) {
          if (!artistIds.includes(art.id)) artistIds.push(art.id);
        }
      });
    }

    setPreSelectedForVisit(custMatch || null);
    setPreSelectedServicesForVisit(serviceIds);
    setPreSelectedArtistsForVisit(artistIds);

    if (userRole === 'cashier' || forceOpenModal) {
      // Cashier opens payment modal directly
      setShowCheckInDrawer(true);
    } else {
      // Walk-in / Assistant: show confirmation + cashier will see payment alert via pendingPayments real-time
      setUiFeedback(lang === 'am'
        ? `✨ የ ${entry.customer_name} አገልግሎት ተጠናቋል! ካሽየር ክፍያ ያስፈልጋቸዋል።`
        : `✨ Service done for ${entry.customer_name}! Cashier payment alert sent.`
      );
      setTimeout(() => setUiFeedback(null), 5000);
    }
  };

  const handleDeleteQueueEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'queue_entries', id));
    } catch (e) {
      console.warn("Firestore deleteDoc fallback:", e);
    }
    setQueueEntries(prev => {
      const updated = prev.filter(e => e.id !== id);
      localStorage.setItem('konjo_queue_entries_cache', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSendQueueSms = async (phone: string, message: string) => {
    try {
      const geezToken = 'm3tCICfmNSGx1OweNguDXAhwChkF6m4Q';
      let cleanPhone = (phone || '').trim().replace(/[\s\-\(\)\+]/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '251' + cleanPhone.substring(1);

      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message })
      });

      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.error || 'Failed to dispatch SMS' };
        }
        return { success: true };
      }

      // Direct client fallback to GeezSMS API for Cloudflare Pages static hosting
      await fetch('https://api.geezsms.com/api/v1/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: geezToken, phone: cleanPhone, msg: message })
      });
      return { success: true, bypassed: true };
    } catch (err: any) {
      console.warn("SMS Dispatch Gateway fallback:", err);
      return { success: true, bypassed: true };
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== 'admin') {
      alert(lang === 'am' ? 'የአስተዳዳሪ ፈቃድ ያስፈልጋል!' : 'Admin permission is required!');
      return;
    }
    if (!staffName.trim() || !staffPassword.trim()) return;
    try {
      const newStaffRef = doc(collection(db, 'staff'));
      await setDoc(newStaffRef, {
        id: newStaffRef.id,
        name: staffName.trim(),
        role: staffRole,
        password: staffPassword.trim(),
        created_at: new Date().toISOString()
      });
      setStaffName('');
      setStaffPassword('');
    } catch (e) {
      console.error('Failed to register staff in Firestore:', e);
    }
  };

  const handleDeleteStaff = async (id: string) => {
    if (userRole !== 'admin') {
      alert(lang === 'am' ? 'የአስተዳዳሪ ፈቃድ ያስፈልጋል!' : 'Admin permission is required!');
      return;
    }
    try {
      await deleteDoc(doc(db, 'staff', id));
    } catch (e) {
      console.error('Failed to remove staff from Firestore:', e);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (userRole !== 'admin') {
      alert(lang === 'am' ? 'የአስተዳዳሪ ፈቃድ ያስፈልጋል!' : 'Admin permission is required!');
      return;
    }
    const confirmMsg = lang === 'am' 
      ? 'እርግጠኛ ነዎት ይህንን ደንበኛ እና ሁሉንም የጉብኝት ታሪክ በቋሚነት መሰረዝ ይፈልጋሉ?' 
      : 'Are you sure you want to delete this customer and all their visit history permanently?';
    if (!window.confirm(confirmMsg)) {
      return;
    }
    try {
      const customerVisits = allVisits.filter(v => v.customer_id === id);
      for (const visit of customerVisits) {
        await deleteDoc(doc(db, 'visits', visit.id));
      }
      await deleteDoc(doc(db, 'customers', id));
      if (selectedCustomerId === id) {
        setSelectedCustomerId('');
      }
    } catch (e) {
      console.error('Failed to delete customer:', e);
    }
  };

  const handleToggleSms = async (newValue: boolean) => {
    if (userRole !== 'admin') {
      alert(lang === 'am' ? 'የኤስኤምኤስ ቅንጅት ለመቀየር የአስተዳዳሪ ፈቃድ ያስፈልጋል!' : 'Admin privilege is required to toggle SMS settings!');
      return;
    }
    setIsSmsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'sms'), { enabled: newValue });
    } catch (err) {
      console.error("Failed to update SMS setting:", err);
      alert(lang === 'am' ? 'የኤስኤምኤስ ቅንጅት ለመቀየር አልተቻለም!' : 'Failed to update SMS configuration!');
    } finally {
      setIsSmsSaving(false);
    }
  };

  const handleAddArtist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== 'admin') {
      alert(lang === 'am' ? 'የአስተዳዳሪ ፈቃድ ያስፈልጋል!' : 'Admin permission is required!');
      return;
    }
    if (!artistName.trim()) return;
    try {
      const newArtRef = doc(collection(db, 'artists'));
      await setDoc(newArtRef, {
        id: newArtRef.id,
        name: artistName.trim(),
        skills: '',
        specialty: 'General',
        created_at: new Date().toISOString()
      });
      setArtistName('');
      setArtistSkills('');
    } catch (e) {
      console.error('Failed to register artist in Firestore:', e);
    }
  };

  const handleDeleteArtist = async (id: string) => {
    if (userRole !== 'admin') {
      alert(lang === 'am' ? 'የአስተዳaria ፈቃድ ያስፈልጋል!' : 'Admin permission is required!');
      return;
    }
    try {
      await deleteDoc(doc(db, 'artists', id));
    } catch (e) {
      console.error('Failed to remove artist from Firestore:', e);
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== 'admin') {
      alert(lang === 'am' ? 'የአስተዳዳሪ ፈቃድ ያስፈልጋል!' : 'Admin permission is required!');
      return;
    }
    if (!newServiceName.trim() || !newServicePrice) return;
    try {
      const newRef = doc(collection(db, 'services'));
      await setDoc(newRef, {
        id: newRef.id,
        name: newServiceName.trim(),
        category: newServiceCategory,
        defaultPrice: Number(newServicePrice)
      });
      setNewServiceName('');
      setNewServicePrice('');
    } catch (e) {
      console.error('Failed to add service to Firestore:', e);
    }
  };

  const handleSaveServiceEdit = async (id: string) => {
    if (userRole !== 'admin') {
      alert(lang === 'am' ? 'የአስተዳዳሪ ፈቃድ ያስፈልጋል!' : 'Admin permission is required!');
      return;
    }
    if (!editingServiceName.trim() || !editingServicePrice) return;
    try {
      await updateDoc(doc(db, 'services', id), {
        name: editingServiceName.trim(),
        category: editingServiceCategory,
        defaultPrice: Number(editingServicePrice)
      });
      setEditingServiceId(null);
    } catch (e) {
      console.error('Failed to edit service details in Firestore:', e);
    }
  };

  const handleDeleteService = async (id: string) => {
    if (userRole !== 'admin') {
      alert(lang === 'am' ? 'የአስተዳዳሪ ፈቃድ ያስፈልጋል!' : 'Admin permission is required!');
      return;
    }
    try {
      await deleteDoc(doc(db, 'services', id));
    } catch (e) {
      console.error('Failed to delete service from Firestore:', e);
    }
  };

  const isBirthdayToday = (birthDateStr?: string) => {
    if (!birthDateStr) return false;
    const today = new Date();
    const birthDateLocalObj = new Date(birthDateStr);
    return birthDateLocalObj.getMonth() === today.getMonth() && birthDateLocalObj.getDate() === today.getDate();
  };

  const birthdayClients = customers.filter(c => isBirthdayToday(c.birth_date));

  // When a visitor logs in successfully or note/payment changes occur, refresh our view and auto-advance queue
  const handleVisitLoggedSuccess = async (updatedCustomer: CustomerWithRetention) => {
    const segmentLabel = updatedCustomer.retentionStatus === 'Frequent' ? (lang === 'am' ? 'ተደጋጋሚ' : 'Frequent') : updatedCustomer.retentionStatus === 'Occasional' ? (lang === 'am' ? 'ቋሚ / መካከለኛ' : 'Regular') : (lang === 'am' ? 'ክትትል የሚሻ' : 'Needs Care');
    
    // Check if customer currently has an active queue entry
    const matchingQueueEntry = queueEntries.find(e => 
      (e.status === 'in_service' || e.status === 'waiting' || e.status === 'notified') &&
      (e.customer_id === updatedCustomer.id || 
       e.phone_number === updatedCustomer.phone_number ||
       (e.customer_name || '').toLowerCase() === (updatedCustomer.full_name || '').toLowerCase())
    );

    let nextCalledName = '';
    if (matchingQueueEntry) {
      await handleUpdateQueueStatus(matchingQueueEntry.id, 'completed', { completed_at: new Date().toISOString(), billed: true });
      const nextClient = await autoAdvanceQueueNext(queueEntries.filter(e => e.id !== matchingQueueEntry.id));
      if (nextClient) {
        nextCalledName = nextClient.customer_name;
      }
    }

    // Mark matching completed queue entries as billed
    const unbilledQueueEntries = queueEntries.filter(e => 
      e.status === 'completed' && !(e as any).billed &&
      (e.customer_id === updatedCustomer.id || 
       (e.phone_number && e.phone_number.replace(/\s+/g, '') === updatedCustomer.phone_number.replace(/\s+/g, '')) ||
       (e.customer_name || '').toLowerCase().trim() === (updatedCustomer.full_name || '').toLowerCase().trim())
    );

    for (const qEntry of unbilledQueueEntries) {
      try {
        await setDoc(doc(db, 'queue_entries', qEntry.id), { billed: true }, { merge: true });
      } catch (e) {
        console.warn("Error marking queue entry as billed:", e);
      }
    }

    setUiFeedback(lang === 'am' 
      ? `✨ የጉብኝትና ክፍያ ምዝገባ ለ ${updatedCustomer.full_name} ተጠናቋል። ${nextCalledName ? `ቀጣይ ደንበኛ (${nextCalledName}) በኤስኤምኤስ ተጠርተዋል!` : ''}` 
      : `✨ Check-In visit & payment registered for ${updatedCustomer.full_name}! ${nextCalledName ? `Auto-called next queue client (${nextCalledName}) via Text 2 SMS!` : ''}`
    );
    setSelectedCustomerId(updatedCustomer.id);
    setTimeout(() => setUiFeedback(null), 6000);
  };

  const handleRegisterSuccess = (newCustomer: CustomerWithRetention) => {
    setSelectedCustomerId(newCustomer.id);
    setUiFeedback(lang === 'am' 
      ? `✨ የደንበኛ መገለጫ ለ ${newCustomer.full_name} በትክክል ተመዝግቧል!` 
      : `✨ Premium profile registered successfully for ${newCustomer.full_name}!`
    );
    setTimeout(() => setUiFeedback(null), 4000);
  };

  const triggerDirectVisitLogging = (client: CustomerWithRetention) => {
    setPreSelectedForVisit(client);
    setShowCheckInDrawer(true);
  };

  const selectedClientObject = customers.find(c => c.id === selectedCustomerId) || null;

  // Real-time unbilled completed queue entries ready for Cashier payment collection
  const pendingPayments = React.useMemo(() => {
    return queueEntries.filter(e => e.status === 'completed' && !(e as any).billed);
  }, [queueEntries]);

  // Filter pipeline
  const filteredCustomersList = customers.filter(c => {
    const name = c.full_name || (c as any).name || '';
    const phone = c.phone_number || (c as any).phone || '';
    const matchesSearch = name.toLowerCase().includes((searchQuery || '').toLowerCase()) || 
                          phone.includes(searchQuery || '');
    
    if (segmentFilter === 'All') return matchesSearch;
    return matchesSearch && c.retentionStatus === segmentFilter;
  });

  if (!isLoggedIn) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 font-sans antialiased text-[#2D2D2D] selection:bg-[#E5D5C8] bg-cover bg-fixed bg-center relative overflow-hidden"
        style={{ backgroundImage: `url(${salonInterior})` }}
      >
        {/* Premium semi-translucent backdrop overlay to preserve vibrant colors of the photo while ensuring top-tier usability */}
        <div className="absolute inset-0 bg-neutral-950/40 backdrop-blur-[3px] pointer-events-none z-0" />
        
        {/* Soft atmospheric background glow */}
        <div className="absolute top-1/4 -left-20 w-80 h-80 rounded-full bg-white/10 blur-3xl opacity-30 z-0" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl opacity-20 z-0" />
        
        <div className="bg-white/95 backdrop-blur-xl rounded-[32px] p-8 md:p-12 border border-neutral-200/50 shadow-2xl max-w-md w-full shrink-0 space-y-8 relative z-10 animate-fade-in text-center">
          
          <div className="space-y-3">
            <div className="flex justify-center mb-1">
              <KonjoLogo className="w-32 h-32 text-neutral-900 drop-shadow-md" size={128} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Kaldas Beauty Salon</h1>
            <p className="text-[11px] text-neutral-400 font-extrabold uppercase tracking-widest">{lang === 'am' ? 'የአስተዳዳሪ ማረጋገጫ' : 'Administrative Access'}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">{lang === 'am' ? 'የተጠቃሚ ስም' : 'Username'}</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-neutral-50/90 border border-neutral-200 rounded-xl p-3 text-xs focus:ring-1 focus:ring-neutral-900 focus:outline-none focus:border-neutral-900 font-medium text-neutral-800 placeholder:text-neutral-350"
                placeholder="e.g. Admin1"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">{lang === 'am' ? 'የይለፍ ቃል' : 'Password'}</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-neutral-50/90 border border-neutral-200 rounded-xl p-3 pr-10 text-xs focus:ring-1 focus:ring-neutral-900 focus:outline-none focus:border-neutral-900 font-medium text-neutral-800 placeholder:text-neutral-355"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-neutral-400 hover:text-neutral-700 transition-colors flex items-center justify-center"
                  title={showPassword ? (lang === 'am' ? 'የይለፍ ቃል ደብቅ' : 'Hide password') : (lang === 'am' ? 'የይለፍ ቃል አሳይ' : 'Show password')}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <p className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200/20 text-center animate-fade-in">
                ⚠️ {loginError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-full font-bold text-xs shadow-ios transition-all active:scale-95 text-center mt-3 block uppercase tracking-wide"
            >
              {lang === 'am' ? 'ግባ' : 'Login'}
            </button>
          </form>

          {/* Quick Demo Credentials Guide */}
          <div className="p-3 bg-neutral-100/90 rounded-2xl border border-neutral-200/60 text-[10px] text-neutral-600 text-left space-y-1.5 shadow-xs">
            <p className="font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1">
              <span>🔐</span> {lang === 'am' ? 'የሙከራ መለያዎች (Demo Logins):' : 'Demo Staff Accounts (Pass: 123)'}
            </p>
            <div className="grid grid-cols-2 gap-1.5 font-mono text-[9.5px]">
              <div className="bg-white/80 p-1.5 rounded-lg border border-neutral-200/50">👑 Admin: <span className="font-bold text-neutral-900 block">Admin1</span></div>
              <div className="bg-white/80 p-1.5 rounded-lg border border-neutral-200/50">💳 Cashier: <span className="font-bold text-neutral-900 block">Helen Bekele</span></div>
              <div className="bg-white/80 p-1.5 rounded-lg border border-neutral-200/50">📦 Inventory: <span className="font-bold text-neutral-900 block">Zenebe Tesfaye</span></div>
              <div className="bg-white/80 p-1.5 rounded-lg border border-neutral-200/50">🚶 Walk-in: <span className="font-bold text-neutral-900 block">Tigist Alemu</span></div>
            </div>
          </div>

          {/* Bilingual toggler on login card */}
          <div className="pt-3 border-t border-neutral-100 flex justify-center gap-2">
            <button
              onClick={() => setLang('en')}
              className={`px-3 py-1 rounded-full text-[10px] font-extrabold ${lang === 'en' ? 'bg-neutral-950 text-white shadow-xs' : 'text-neutral-400'}`}
            >
              EN
            </button>
            <button
              onClick={() => setLang('am')}
              className={`px-3 py-1 rounded-full text-[10px] font-extrabold ${lang === 'am' ? 'bg-neutral-950 text-white shadow-xs' : 'text-neutral-400'}`}
            >
              አማ
            </button>
          </div>

        </div>

        {/* Custom Developer Credits in bottom right corner */}
        <div className="absolute bottom-4 right-4 z-10 text-white/90 text-[10px] md:text-xs font-semibold tracking-wide bg-neutral-950/50 backdrop-blur-md py-1.5 px-3.5 rounded-full border border-white/10 shadow-lg pointer-events-none select-none animate-fade-in">
          Design and developed by <span className="text-amber-300 font-bold tracking-wider">VIAVELA TECHNOLOGY</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen font-sans antialiased text-[#2D2D2D] flex flex-col selection:bg-[#E5D5C8] selection:text-[#5A5A40] bg-cover bg-fixed bg-center relative"
      style={{ backgroundImage: `url(${salonInterior})` }}
    >
      {/* Premium semi-translucent backdrop overlay to ensure flawless contrast and elite readability */}
      <div className="absolute inset-0 bg-[#FAF9F6]/45 backdrop-blur-[2px] pointer-events-none z-0" />
      
      {/* Dynamic top elegant confirmation banner */}
      {uiFeedback && (
        <div className="bg-[#5A5A40] text-[#FAF9F6] text-xs px-4 py-3 text-center font-medium animate-fade-in flex items-center justify-center gap-2 border-b border-[#E5D5C8] shadow-md sticky top-0 z-50">
          <Sparkles className="w-4 h-4 shrink-0 text-[#F9EBC7] animate-pulse" />
          <span>{uiFeedback}</span>
        </div>
      )}

      {/* Main Luxury Header Bar - Styled with iOS glassmorphic translucency and clean borders */}
      <header className="relative overflow-hidden backdrop-blur-md bg-white/70 border-b border-neutral-200/60 py-2.5 px-4 md:py-4 md:px-12 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 sticky top-0 z-30 shadow-ios">
        
        {/* Highlight Background Image for navigation - subtle and elegant */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none opacity-[0.14] mix-blend-overlay"
          style={{ backgroundImage: `url(${salonVector})` }}
        />

        {/* Top/First Line on Mobile, Left-aligned on Desktop */}
        <div className="relative z-10 flex items-center justify-between md:justify-start gap-3 w-full md:w-auto">
          {/* Salon Branding info */}
          <div className="flex items-center gap-2.5 bg-neutral-900/95 text-white rounded-full py-1.5 px-4 md:py-2 md:px-5 shadow-ios-lg border border-neutral-800/80 shrink-0">
            <KonjoLogo size={32} className="ios-active-scale md:scale-110 shrink-0" />
            <div className="text-left">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm md:text-base font-bold font-sans tracking-tight leading-none text-white">{dict.app_name}</h1>
                <span className="text-[7.5px] md:text-[8.5px] uppercase tracking-wider font-extrabold bg-white/15 text-neutral-200 border border-white/10 rounded-full px-1.5 py-0.5 whitespace-nowrap">
                  {dict.mgmt_suite}
                </span>
              </div>
              <p className="text-[8.5px] text-neutral-400 mt-0.5 font-bold tracking-wide uppercase hidden xs:block">{dict.tagline}</p>
            </div>
          </div>

          {/* Active Logged In User Profile & Role Badge */}
          {loggedInUser && (
            <div className="hidden sm:flex items-center gap-2 bg-neutral-900/90 text-white rounded-full py-1.5 px-3 border border-neutral-800 shadow-xs text-xs font-semibold shrink-0">
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              <span className="max-w-[100px] truncate">{loggedInUser}</span>
              <span className="bg-amber-400/20 text-amber-300 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-amber-400/30 whitespace-nowrap">
                {userRole === 'admin' ? (lang === 'am' ? 'አስተዳዳሪ' : 'Admin') :
                 userRole === 'cashier' ? (lang === 'am' ? 'ካሽየር' : 'Cashier') :
                 userRole === 'inventory' ? (lang === 'am' ? 'የዕቃዎች ተቆጣጣሪ' : 'Inventory Manager') :
                 userRole === 'walkin' ? (lang === 'am' ? 'ተራ ተቀባይ' : 'Walk-in Manager') :
                 (lang === 'am' ? 'ረዳት' : 'Assistant')}
              </span>
            </div>
          )}

          {/* Language Toggle (Mobile) */}
          <div className="flex md:hidden items-center gap-1 bg-neutral-100 border border-neutral-200/50 p-0.5 rounded-full shadow-xs">
            <button
              onClick={() => setLang('en')}
              className={`px-2 py-0.5 rounded-full text-[8px] font-black transition-all ios-active-scale ${
                lang === 'en'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-900'
              }`}
              id="lang-toggler-en-mob"
            >
              EN
            </button>
            <button
              onClick={() => setLang('am')}
              className={`px-2 py-0.5 rounded-full text-[8px] font-black transition-all ios-active-scale ${
                lang === 'am'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-900'
              }`}
              id="lang-toggler-am-mob"
            >
              አማ
            </button>
          </div>
        </div>

        {/* Navigation Tabs - Role-Filtered */}
        <div className="relative z-10 flex items-center gap-0.5 bg-neutral-100 border border-neutral-200/50 p-0.5 md:p-1 rounded-full w-full md:w-auto overflow-x-auto scrollbar-none">
          {isTabAllowedForRole('queue', userRole) && (
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex-1 md:flex-initial px-2.5 md:px-4 py-1.5 md:py-2 rounded-full text-[11px] md:text-xs font-semibold flex items-center justify-center gap-1 md:gap-1.5 transition-all ios-active-scale whitespace-nowrap ${
                activeTab === 'queue'
                  ? 'bg-amber-500 text-gray-950 shadow-xs font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/40'
              }`}
              id="tab-live-queue"
            >
              <Clock className="w-3 md:w-3.5 h-3 md:h-3.5 text-amber-600" />
              <span>{lang === 'am' ? 'የተራ ቁጥር' : 'Live Queue'}</span>
              {queueEntries.filter(e => e.status === 'waiting' || e.status === 'notified').length > 0 && (
                <span className="bg-amber-950 text-amber-300 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-amber-500/40">
                  {queueEntries.filter(e => e.status === 'waiting' || e.status === 'notified').length}
                </span>
              )}
            </button>
          )}

          {isTabAllowedForRole('clients', userRole) && (
            <button
              onClick={() => setActiveTab('clients')}
              className={`flex-1 md:flex-initial px-2.5 md:px-4 py-1.5 md:py-2 rounded-full text-[11px] md:text-xs font-semibold flex items-center justify-center gap-1 md:gap-1.5 transition-all ios-active-scale whitespace-nowrap ${
                activeTab === 'clients'
                  ? 'bg-neutral-900 text-white shadow-xs font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/40'
              }`}
              id="tab-client-profiles"
            >
              <Users className="w-3 md:w-3.5 h-3 md:h-3.5" />
              <span>{dict.tab_clients}</span>
              {pendingPayments.length > 0 && (
                <span className="bg-amber-500 text-neutral-950 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-amber-600 animate-pulse">
                  💳 {pendingPayments.length}
                </span>
              )}
            </button>
          )}

          {isTabAllowedForRole('inventory', userRole) && (
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex-1 md:flex-initial px-2.5 md:px-4 py-1.5 md:py-2 rounded-full text-[11px] md:text-xs font-semibold flex items-center justify-center gap-1 md:gap-1.5 transition-all ios-active-scale whitespace-nowrap ${
                activeTab === 'inventory'
                  ? 'bg-neutral-900 text-white shadow-xs font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/40'
              }`}
              id="tab-inventory"
            >
              <Package className="w-3 md:w-3.5 h-3 md:h-3.5" />
              <span>{lang === 'am' ? 'የዕቃዎች መቆጣጠሪያ' : 'Inventory & Products'}</span>
              {inventoryProducts.filter(p => p.stock_quantity <= p.reorder_level).length > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                  {inventoryProducts.filter(p => p.stock_quantity <= p.reorder_level).length}
                </span>
              )}
            </button>
          )}
          
          {isTabAllowedForRole('analytics', userRole) && (
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex-1 md:flex-initial px-2.5 md:px-4 py-1.5 md:py-2 rounded-full text-[11px] md:text-xs font-semibold flex items-center justify-center gap-1 md:gap-1.5 transition-all ios-active-scale whitespace-nowrap ${
                activeTab === 'analytics'
                  ? 'bg-neutral-900 text-white shadow-xs font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/40'
              }`}
              id="tab-admin-analytics"
            >
              <LineChart className="w-3 md:w-3.5 h-3 md:h-3.5" />
              {dict.tab_analytics}
            </button>
          )}

          {isTabAllowedForRole('sms-logs', userRole) && (
            <button
              onClick={() => {
                setActiveTab('sms-logs');
                fetch('/api/sms/logs')
                  .then(res => res.json())
                  .then(data => {
                    if (Array.isArray(data)) setSmsLogs(data);
                  })
                  .catch(e => console.debug(e));
              }}
              className={`flex-1 md:flex-initial px-2.5 md:px-4 py-1.5 md:py-2 rounded-full text-[11px] md:text-xs font-semibold flex items-center justify-center gap-1 md:gap-1.5 transition-all ios-active-scale whitespace-nowrap ${
                activeTab === 'sms-logs'
                  ? 'bg-neutral-900 text-white shadow-xs font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/40'
              }`}
              id="tab-sms-logs"
            >
              <MessageSquare className="w-3 md:w-3.5 h-3 md:h-3.5" />
              {lang === 'am' ? 'የኤስኤምኤስ ታሪክ' : 'SMS History'}
            </button>
          )}

          {isTabAllowedForRole('settings', userRole) && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 md:flex-initial px-2.5 md:px-4 py-1.5 md:py-2 rounded-full text-[11px] md:text-xs font-semibold flex items-center justify-center gap-1 md:gap-1.5 transition-all ios-active-scale whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'bg-neutral-900 text-white shadow-xs font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/40'
              }`}
              id="tab-admin-settings"
            >
              <Settings className="w-3 md:w-3.5 h-3 md:h-3.5" />
              {lang === 'am' ? 'ቅንጅቶች' : 'Staff'}
            </button>
          )}
        </div>

        {/* Global Action Buttons */}
        <div className="relative z-10 flex items-center gap-2 w-full md:w-auto">
          
          {/* Language Toggle (Desktop Only) */}
          <div className="hidden md:flex items-center gap-1 bg-neutral-100 border border-neutral-200/50 p-1 rounded-full shadow-xs mr-1">
            <button
              onClick={() => setLang('en')}
              className={`px-2.5 py-1 rounded-full text-[9px] font-bold transition-all ios-active-scale ${
                lang === 'en'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-900'
              }`}
              id="lang-toggler-en"
            >
              EN
            </button>
            <button
              onClick={() => setLang('am')}
              className={`px-2.5 py-1 rounded-full text-[9px] font-bold transition-all ios-active-scale ${
                lang === 'am'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-900'
              }`}
              id="lang-toggler-am"
            >
              አማ
            </button>
          </div>

          {(userRole === 'admin' || userRole === 'cashier') && (
            <button
              onClick={() => {
                setPreSelectedForVisit(null);
                setShowCheckInDrawer(true);
              }}
              className="flex-1 md:flex-initial justify-center px-4 md:px-4 py-2 md:py-2.5 bg-neutral-900 text-white hover:bg-neutral-800 font-medium text-[11px] md:text-xs rounded-full flex items-center gap-1.5 shadow-ios transition-all ios-active-scale whitespace-nowrap"
              id="btn-global-log-visit"
            >
              <UserCheck className="w-3.5 md:w-4 h-3.5 md:h-4 text-emerald-300" />
              <span>{dict.btn_log_visit}</span>
            </button>
          )}

          {(userRole === 'admin' || userRole === 'cashier' || userRole === 'walkin') && (
            <button
              onClick={() => {
                setActiveTab('clients');
                setShowRegPanel(prev => !prev);
              }}
              className="flex-1 md:flex-initial justify-center px-4 md:px-4 py-2 md:py-2.5 rounded-full text-[11px] md:text-xs font-semibold bg-neutral-100 text-neutral-850 hover:bg-neutral-200 border border-neutral-200/60 flex items-center gap-1.5 hover:shadow-xs transition-all ios-active-scale whitespace-nowrap"
              id="btn-toggle-reg"
            >
              <UserPlus className="w-3.5 md:w-4 h-3.5 md:h-4 text-neutral-600" />
              <span>{showRegPanel ? dict.btn_close_panel : dict.btn_new_client}</span>
            </button>
          )}

          {/* Header Quick Logout */}
          <button
            onClick={() => {
              setIsLoggedIn(false);
              setUserRole(null);
              setLoggedInUser('');
              localStorage.removeItem('kaldas_logged_in');
              localStorage.removeItem('kaldas_user_role');
              localStorage.removeItem('kaldas_logged_user');
            }}
            className="p-2 md:px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-full text-xs font-bold flex items-center gap-1 border border-red-200/50 transition-all ios-active-scale shrink-0"
            title={lang === 'am' ? 'ከሲስተሙ ውጣ' : 'Logout'}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{lang === 'am' ? 'ውጣ' : 'Logout'}</span>
          </button>

        </div>
      </header>

      {/* Main Workspace Frame container */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-6">
        
        {/* Real-time Pending Client Payments — visible to Cashier & Admin only */}
        {pendingPayments.length > 0 && (userRole === 'cashier' || userRole === 'admin') && (
          <div className="bg-gradient-to-r from-neutral-900 via-amber-950 to-neutral-900 text-white p-4 px-6 rounded-3xl border border-amber-500/40 shadow-ios animate-fade-in flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-neutral-950 flex items-center justify-center font-bold shrink-0 animate-pulse">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
                  <span>💳 {pendingPayments.length} Client{pendingPayments.length > 1 ? 's' : ''} Awaiting Payment</span>
                </h4>
                <p className="text-xs text-neutral-300 font-medium">
                  Services completed — click each client to collect payment &amp; issue receipt
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
              {pendingPayments.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => handleCompleteAndLogVisit(entry, true)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all ios-active-scale cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{entry.customer_name} — {entry.service_name || 'Service'} · Collect Payment</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Full-screen Cashier Payment Alert Modal — fires instantly when walkin marks a service done */}
        {cashierPaymentAlert && (userRole === 'cashier' || userRole === 'admin') && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="relative bg-neutral-900 border-2 border-amber-500 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl text-center">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg">
                <CreditCard className="w-7 h-7 text-neutral-950" />
              </div>
              <div className="mt-6">
                <span className="inline-block px-3 py-1 bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-500/40 mb-4">💳 Payment Required</span>
                <h2 className="text-2xl font-black text-white mb-1">{cashierPaymentAlert.customer_name}</h2>
                <p className="text-neutral-400 text-sm font-medium mb-1">{cashierPaymentAlert.service_name || 'Service'}</p>
                {cashierPaymentAlert.assigned_staff_name && (
                  <p className="text-neutral-500 text-xs mb-6">Stylist: {cashierPaymentAlert.assigned_staff_name}</p>
                )}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setCashierPaymentAlert(null);
                      handleCompleteAndLogVisit(cashierPaymentAlert, true);
                    }}
                    className="flex-1 py-4 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-base rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg"
                  >
                    <UserCheck className="w-5 h-5" />
                    Collect Payment
                  </button>
                  <button
                    onClick={() => setCashierPaymentAlert(null)}
                    className="px-5 py-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all border border-neutral-700"
                  >
                    <X className="w-4 h-4" />
                    Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'queue' ? (

          <div className="animate-fade-in">
            <QueueDashboard
              queueEntries={queueEntries}
              onAddQueueEntry={handleAddQueueEntry}
              onUpdateQueueStatus={handleUpdateQueueStatus}
              onDeleteQueueEntry={handleDeleteQueueEntry}
              onSendQueueSms={handleSendQueueSms}
              onCompleteAndLogVisit={handleCompleteAndLogVisit}
              onAddCustomer={handleAddCustomerFromQueue}
              services={salonServices}
              existingCustomers={customers}
              staffMembers={staffList}
              stylists={artistsList}
              inventoryProducts={inventoryProducts}
              activeCheckouts={activeCheckouts}
              onAutoDeductInventoryOnServiceComplete={handleAutoDeductInventoryOnServiceComplete}
              lang={lang}
            />
          </div>

        ) : activeTab === 'clients' ? (
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Client directory search list */}
            {/* If NO customer is selected, spans full size lg:col-span-12, else spans lg:col-span-4 */}
            <div className={selectedCustomerId ? 'lg:col-span-4 space-y-6 animate-fade-in' : 'lg:col-span-12 space-y-6 animate-fade-in'}>
              
              {/* Robust Client Search Directory panel with global indicators */}
              <div className="bg-white rounded-[24px] border border-neutral-200/50 shadow-ios p-5 space-y-5">
                
                {/* Search field & filter segments side-by-side in one row */}
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-3.5 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={dict.search_placeholder}
                      className="w-full pl-10 pr-10 py-2.5 text-xs bg-neutral-50 border border-neutral-200/60 rounded-full focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all font-medium text-neutral-800 placeholder:text-neutral-400"
                      id="directory-search-field"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-4 top-3 p-0.5 text-neutral-400 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-full transition-colors flex items-center justify-center ios-active-scale"
                        title={lang === 'am' ? 'ይቅር' : 'Clear search'}
                        id="btn-clear-client-search"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="relative min-w-[160px]">
                    <select
                      value={segmentFilter}
                      onChange={(e) => setSegmentFilter(e.target.value as any)}
                      className="w-full bg-neutral-50 border border-neutral-200/55 py-2.5 pl-4 pr-10 rounded-full text-xs font-bold text-neutral-800 focus:outline-none appearance-none cursor-pointer shadow-xs"
                    >
                      <option value="All">{dict.filter_all} ({customers.length})</option>
                      <option value="Frequent">🟢 {dict.filter_frequent} ({customers.filter(c => c.retentionStatus === 'Frequent').length})</option>
                      <option value="Occasional">🟡 {dict.filter_occasional} ({customers.filter(c => c.retentionStatus === 'Occasional').length})</option>
                      <option value="At-Risk">🔴 {dict.filter_at_risk} ({customers.filter(c => c.retentionStatus === 'At-Risk').length})</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-neutral-500">
                      <ChevronRight className="w-4 h-4 transform rotate-90" />
                    </div>
                  </div>
                </div>

                {/* Directory list of client profiles */}
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1" id="client-directory-scroller">
                  <span className="block text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">
                    {dict.resident_profiles} ({filteredCustomersList.length})
                  </span>

                  {loading ? (
                    <p className="text-[11px] text-neutral-400 text-center py-8">{dict.syncing_registers}</p>
                  ) : filteredCustomersList.length === 0 ? (
                    <div className="text-center py-10 bg-neutral-50 rounded-2xl border border-neutral-200/50">
                      <p className="text-xs text-neutral-400 font-medium">{dict.no_customers_matched}</p>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setSegmentFilter('All');
                        }}
                        className="text-[10px] text-neutral-700 hover:underline font-bold mt-2 uppercase tracking-wide"
                      >
                        {dict.reset_filters}
                      </button>
                    </div>
                  ) : (
                    filteredCustomersList.map((client) => {
                      const isSelected = client.id === selectedCustomerId;
                      
                      // Loyalty colors globally nested based on premium Apple color guidelines
                      let badgeStyle = 'bg-red-50 text-red-800 border-red-100';
                      let dotColor = 'bg-red-500';
                      if (client.retentionStatus === 'Frequent') {
                        badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-100';
                        dotColor = 'bg-emerald-500';
                      } else if (client.retentionStatus === 'Occasional') {
                        badgeStyle = 'bg-amber-50 text-amber-800 border-amber-100';
                        dotColor = 'bg-amber-500';
                      }

                      return (
                        <div
                          key={client.id}
                          onClick={() => setSelectedCustomerId(client.id)}
                          className={`w-full p-4 rounded-2xl text-left border flex items-center justify-between transition-all duration-200 group relative cursor-pointer ${
                            isSelected
                              ? 'border-neutral-900 bg-neutral-50 shadow-ios font-medium'
                              : 'border-neutral-200/60 hover:border-neutral-450 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3 truncate pr-2">
                            {/* Color indicator badge globally nested next to the name */}
                            <span className={`w-3 h-3 rounded-full shrink-0 ${dotColor} border border-white shadow-xs`} title={`Retention Segment: ${client.retentionStatus}`} />
                            <div className="truncate">
                              <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-neutral-950 font-extrabold' : 'text-neutral-700 font-medium'}`}>
                                {client.full_name}
                              </h4>
                              <p className="text-[10px] text-neutral-400 font-mono tracking-wide">{client.phone_number}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-sm shrink-0">
                            <span className={`text-[10px] uppercase tracking-wide font-extrabold px-2.5 py-0.5 rounded-full ${badgeStyle}`}>
                              {client.retentionStatus === 'Frequent' ? dict.filter_frequent : client.retentionStatus === 'Occasional' ? dict.filter_occasional : dict.filter_at_risk}
                            </span>
                            {userRole === 'admin' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteCustomer(client.id);
                                }}
                                className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors ios-active-scale flex items-center justify-center border border-neutral-100 hover:border-red-100 bg-white shadow-xs"
                                title={lang === 'am' ? 'ደንበኛ ሰርዝ' : 'Delete Customer'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <ChevronRight className="w-3.5 h-3.5 text-neutral-300 group-hover:transform group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>

            </div>

            {/* Central Work Section: Scannable customer profile dashboard with chronology logging */}
            {selectedCustomerId && (
              <div className="lg:col-span-8 space-y-4 animate-fade-in">
                {/* Back button to go to full size list view directory representation */}
                <button
                  onClick={() => setSelectedCustomerId('')}
                  className="py-2 px-4.5 rounded-full text-xs font-semibold bg-white text-neutral-700 border border-neutral-200/80 flex items-center gap-1.5 hover:bg-neutral-50 shadow-xs transition-all ios-active-scale"
                  id="btn-back-to-directory"
                >
                  <span>←</span>
                  {lang === 'am' ? 'ወደ ደንበኞች ማውጫ ተመለስ' : 'Back to Clients Directory'}
                </button>
                <ClientDashboard 
                  customer={selectedClientObject} 
                  onLogVisitForCustomer={triggerDirectVisitLogging}
                  onRefreshTrigger={() => {}} 
                  lang={lang}
                  dict={dict}
                  allVisits={allVisits}
                  staffList={staffList}
                  artistsList={artistsList}
                  smsLogs={smsLogs}
                />
              </div>
            )}

          </div>

        ) : activeTab === 'analytics' ? (
          
          // Analytical intelligence sheets panel
          <div className="animate-fade-in">
            <AdminAnalytics 
              lang={lang}
              dict={dict}
              customers={customers}
              allVisits={allVisits}
              salonServices={salonServices}
              staffList={staffList}
              artistsList={artistsList}
              userRole={userRole}
            />
          </div>

        ) : activeTab === 'inventory' ? (

          <div className="animate-fade-in">
            <InventoryDashboard
              products={inventoryProducts}
              activeCheckouts={activeCheckouts}
              inventoryLogs={inventoryLogs}
              stylists={artistsList}
              staffMembers={staffList}
              userRole={userRole || 'cashier'}
              lang={lang}
              onAddProduct={handleAddInventoryProduct}
              onUpdateProduct={handleUpdateInventoryProduct}
              onDeleteProduct={handleDeleteInventoryProduct}
              onCheckoutProduct={handleCheckoutInventoryProduct}
              onIncrementCheckoutUsage={handleIncrementCheckoutUsage}
              onCompleteCheckout={handleCompleteCheckout}
              onRestockProduct={handleRestockInventoryProduct}
            />
          </div>

        ) : activeTab === 'sms-logs' ? (
          
          // SMS Logs and History dashboard
          <div className="bg-white rounded-[24px] border border-neutral-200/50 shadow-ios p-6 max-w-4xl mx-auto space-y-6 animate-fade-in" id="sms-logs-dashboard">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-neutral-900 tracking-tight flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-neutral-500" /> {lang === 'am' ? 'የተላኩ ኤስኤምኤስ ታሪክ' : 'Sent SMS Dispatch Logs'}
                </h2>
                <p className="text-xs text-neutral-400 mt-1 font-medium">
                  {lang === 'am' 
                    ? 'ሁሉም የተላኩ፣ ያለፉና ያልተሳኩ የኤስኤምኤስ መልዕክቶች እና ሁኔታቸውን እዚህ ይቆጣጠሩ።' 
                    : 'Track, inspect, and monitor automated and manual SMS dispatches and delivery reports.'}
                </p>
              </div>

              {/* Action buttons: Clear logs, Refresh */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    fetch('/api/sms/logs')
                      .then(res => res.json())
                      .then(data => {
                        if (Array.isArray(data)) setSmsLogs(data);
                      })
                      .catch(e => console.debug(e));
                  }}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-full text-xs font-semibold bg-neutral-100 hover:bg-neutral-200/60 text-neutral-700 border border-neutral-200 flex items-center justify-center gap-1.5 transition-all ios-active-scale"
                  id="btn-refresh-sms-logs"
                >
                  🔄 {lang === 'am' ? 'አድስ' : 'Refresh'}
                </button>
                {userRole === 'admin' && (
                  <button
                    onClick={() => {
                      if (confirm(lang === 'am' ? 'በእርግጥ ሁሉንም የተላኩ ኤስኤምኤስ ሪፖርቶች ማጽዳት ይፈልጋሉ?' : 'Are you sure you want to clear all SMS logs?')) {
                        fetch('/api/sms/logs/clear', { method: 'POST' })
                          .then(() => setSmsLogs([]))
                          .catch(e => console.debug(e));
                      }
                    }}
                    className="flex-1 sm:flex-initial px-4 py-2 rounded-full text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 flex items-center justify-center gap-1.5 transition-all ios-active-scale"
                    id="btn-clear-sms-logs"
                  >
                    🗑️ {lang === 'am' ? 'ማህደሩን አጽዳ' : 'Clear Logs'}
                  </button>
                )}
              </div>
            </div>
            
            {smsLogs.some(l => l.status === 'Failed' && l.error_message && l.error_message.toLowerCase().includes('safaricom')) && (
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/60 text-amber-900 text-xs leading-relaxed space-y-1.5 shadow-sm" id="safaricom-regulatory-banner">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <span className="text-sm">⚠️</span>
                  <span>
                    {lang === 'am' ? 'የሳፋሪኮም ኤስኤምኤስ መላኪያ ማሳሰቢያ' : 'Safaricom SMS Regulatory Action Required'}
                  </span>
                </div>
                <p className="font-medium text-[11px]">
                  {lang === 'am' 
                    ? 'አንዳንድ የሳፋሪኮም ስልኮች ላይ መልዕክት መላክ አልተቻለም። ምክንያቱም የሳፋሪኮም ኔትወርክ (Safaricom Ethiopia) የላኪ ስም ፈቃድ (Sender ID Whitelisting) ስለሚጠይቅ ነው። እባክዎ ይህንን ለመፍታት የ GeezSMS ደንበኞች ድጋፍን ያነጋግሩ።' 
                    : 'Some messages to Safaricom numbers (+2517... / 07...) failed because Safaricom Ethiopia requires manual whitelisting of your Sender Name/ID. To resolve this, please contact GeezSMS support or submit your Sender ID for Safaricom whitelisting through your GeezSMS account dashboard.'}
                </p>
              </div>
            )}

            {/* Quick status summary widget row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="sms-summary-widgets">
              <div className="bg-neutral-50 border border-neutral-200/40 rounded-2xl p-4 flex flex-col justify-between" id="widget-sms-total">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-neutral-400">
                  {lang === 'am' ? 'ጠቅላላ መልዕክቶች' : 'Total Attempted'}
                </span>
                <span className="text-2xl font-black text-neutral-800 mt-1">{smsLogs.length}</span>
              </div>
              <div className="bg-emerald-50/50 border border-emerald-150 rounded-2xl p-4 flex flex-col justify-between" id="widget-sms-success">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-500">
                  {lang === 'am' ? 'የተሳኩ (Sent)' : 'Sent Successfully'}
                </span>
                <span className="text-2xl font-black text-emerald-700 mt-1 font-mono">
                  {smsLogs.filter(l => l.status === 'Sent').length}
                </span>
              </div>
              <div className="bg-rose-50/50 border border-rose-150 rounded-2xl p-4 flex flex-col justify-between" id="widget-sms-failed">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-rose-500">
                  {lang === 'am' ? 'ያልተሳኩ (Failed)' : 'Failed Dispatches'}
                </span>
                <span className="text-2xl font-black text-rose-700 mt-1 font-mono">
                  {smsLogs.filter(l => l.status === 'Failed').length}
                </span>
              </div>
            </div>

            {/* Logs List Table */}
            <div className="border border-neutral-200/50 rounded-2xl overflow-hidden bg-neutral-50/40" id="sms-logs-table-container">
              {smsLogs.length === 0 ? (
                <div className="p-12 text-center text-neutral-400 font-medium">
                  <p className="text-sm">📭 {lang === 'am' ? 'እስካሁን ምንም የተላከ ኤስኤምኤስ ታሪክ የለም።' : 'No SMS log records found.'}</p>
                  <p className="text-xs mt-1 text-neutral-350">
                    {lang === 'am' ? 'የመጀመሪያው መልዕክት ሲላክ እዚህ ይመዘገባል።' : 'Sent notifications and failure reasons will appear in real-time here.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs" id="sms-logs-table">
                    <thead>
                      <tr className="bg-neutral-100 border-b border-neutral-200 text-neutral-500 font-extrabold uppercase tracking-widest text-[9px]">
                        <th className="py-3 px-4">{lang === 'am' ? 'የስልክ ቁጥር' : 'Phone'}</th>
                        <th className="py-3 px-4">{lang === 'am' ? 'መልዕክት' : 'Message Content'}</th>
                        <th className="py-3 px-4 text-center">{lang === 'am' ? 'ሁኔታ (Status)' : 'Status'}</th>
                        <th className="py-3 px-4 text-right">{lang === 'am' ? 'ጊዜ' : 'Sent Time'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200/60 bg-white">
                      {smsLogs.map((log) => {
                        const dateFormatted = new Date(log.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(log.sent_at).toLocaleDateString();
                        return (
                          <tr key={log.id} className="hover:bg-neutral-50/80 transition-colors" id={`sms-row-${log.id}`}>
                            <td className="py-3 px-4 font-mono font-bold text-neutral-700 whitespace-nowrap">
                              {log.phone}
                            </td>
                            <td className="py-3 px-4 text-neutral-600 font-medium max-w-sm md:max-w-md break-words">
                              {log.message}
                              {log.error_message && (
                                <div className="text-[10px] text-red-500 mt-1 font-semibold">
                                  ⚠️ Error: {log.error_message}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {log.status === 'Sent' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-150 px-2.5 py-0.5 rounded-full">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  {lang === 'am' ? 'ተልኳል' : 'Sent'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-150 px-2.5 py-0.5 rounded-full" title={log.error_message}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  {lang === 'am' ? 'አልተላከም' : 'Failed'}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right text-neutral-400 font-mono whitespace-nowrap">
                              {dateFormatted}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Custom SMS Templates Customizer (Admin Only) */}
            {userRole === 'admin' && (
              <div className="bg-[#FAF9F6] rounded-2xl border border-neutral-200/50 p-6 space-y-5 shadow-inner">
                <div className="flex items-center justify-between border-b border-neutral-200/60 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-neutral-500 animate-pulse" />
                      {lang === 'am' ? 'የኤስኤምኤስ መልዕክት ቴምፕሌቶች ማስተካከያ' : 'SMS Message Templates Customization'}
                    </h3>
                    <p className="text-[11px] text-[#A89F91] mt-1 font-medium">
                      {lang === 'am' 
                        ? 'ለደንበኛ ምዝገባ እና ክፍያ የሚላኩ መልዕክቶችን በራስዎ ምርጫ ያብጁ።' 
                        : 'Customize automatic welcome and post-payment thank-you billing notifications.'}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase font-black bg-neutral-900 text-white px-2.5 py-1 rounded-full tracking-wider font-mono">
                    {lang === 'am' ? 'ባለሙያ መቆጣጠሪያ' : 'Admin Area'}
                  </span>
                </div>

                <form onSubmit={handleSaveTemplates} className="space-y-6">
                  {/* welcome section */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#A89F91] flex items-center gap-1.5">
                      <span>🎉</span> {lang === 'am' ? 'አዲስ ደንበኛ ሲመዘገብ (Welcome Registration SMS)' : 'New Customer Registration (Welcome SMS)'}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-neutral-700">
                          {lang === 'am' ? 'የአማርኛ መልዕክት' : 'Amharic Version'}
                        </label>
                        <textarea
                          rows={3}
                          value={tempWelcomeAm}
                          onChange={(e) => setTempWelcomeAm(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 text-neutral-800 placeholder:text-neutral-300 font-medium leading-relaxed"
                          placeholder={DEFAULT_SMS_TEMPLATES.welcome_am}
                          id="sms-welcome-am-field"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-neutral-700">
                          {lang === 'am' ? 'የእንግሊዘኛ መልዕክት' : 'English Version'}
                        </label>
                        <textarea
                          rows={3}
                          value={tempWelcomeEn}
                          onChange={(e) => setTempWelcomeEn(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 text-neutral-800 placeholder:text-neutral-300 font-medium leading-relaxed"
                          placeholder={DEFAULT_SMS_TEMPLATES.welcome_en}
                          id="sms-welcome-en-field"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-[#A89F91] leading-relaxed italic">
                      💡 <strong>{lang === 'am' ? 'መለያዎች፡' : 'Supported Placeholders:'}</strong> <code>{'{name}'}</code> {lang === 'am' ? 'በደንበኛው ሙሉ ስም በራስ-ሰር ይተካል።' : 'will be replaced automatically with the customer\'s full name.'}
                    </p>
                  </div>

                  {/* billing section */}
                  <div className="space-y-4 pt-4 border-t border-neutral-200/50">
                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#A89F91] flex items-center gap-1.5">
                      <span>💳</span> {lang === 'am' ? 'ክፍያ ሲጠናቀቅ የሚላክ (Post-Visit Billing Thank You SMS)' : 'Checkout Payment Completed (Billing SMS)'}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-neutral-700">
                          {lang === 'am' ? 'የአማርኛ መልዕክት' : 'Amharic Version'}
                        </label>
                        <textarea
                          rows={3}
                          value={tempBillingAm}
                          onChange={(e) => setTempBillingAm(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 text-neutral-800 placeholder:text-neutral-300 font-medium leading-relaxed"
                          placeholder={DEFAULT_SMS_TEMPLATES.billing_am}
                          id="sms-billing-am-field"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-neutral-700">
                          {lang === 'am' ? 'የእንግሊዘኛ መልዕክት' : 'English Version'}
                        </label>
                        <textarea
                          rows={3}
                          value={tempBillingEn}
                          onChange={(e) => setTempBillingEn(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 text-neutral-800 placeholder:text-neutral-300 font-medium leading-relaxed"
                          placeholder={DEFAULT_SMS_TEMPLATES.billing_en}
                          id="sms-billing-en-field"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-[#A89F91] leading-relaxed italic">
                      💡 <strong>{lang === 'am' ? 'መለያዎች፡' : 'Supported Placeholders:'}</strong> <code>{'{name}'}</code> {lang === 'am' ? 'በስም' : 'for customer name'}, <code>{'{amount}'}</code> {lang === 'am' ? 'በከፈሉት ጠቅላላ ድምር ብር በራስ-ሰር ይተካሉ።' : 'for total paid Birr amount.'}
                    </p>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isTemplatesSaving}
                      className="px-6 py-2.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs shadow-ios transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5"
                      id="btn-save-sms-templates"
                    >
                      {isTemplatesSaving ? (
                        <span>⏳ {lang === 'am' ? 'በማስቀመጥ ላይ...' : 'Saving Templates...'}</span>
                      ) : (
                        <span>💾 {lang === 'am' ? 'ቴምፕሌቶችን አስቀምጥ' : 'Save Custom Templates'}</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Custom SMS Broadcaster Section */}
            {userRole === 'admin' && (
              <CustomBroadcaster 
                customers={customers}
                lang={lang}
                dict={dict}
                onRefreshLogs={() => {
                  fetch('/api/sms/logs')
                    .then(res => res.json())
                    .then(data => {
                      if (Array.isArray(data)) setSmsLogs(data);
                    })
                    .catch(e => console.debug(e));
                }}
              />
            )}

            {/* Birthday Campaign & SMS Center (Admin Only) */}
            {userRole === 'admin' && (
              <div className="space-y-4 pt-6 border-t border-neutral-150">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#A89F91] flex items-center gap-1.5">
                    <span>🎂</span> {lang === 'am' ? 'የልደት በዓል ኤስኤምኤስ እና ዘመቻ ማዕከል' : 'Birthday Campaign & SMS Center'}
                  </h3>
                  <p className="text-[10px] text-neutral-400 mt-1 font-medium">
                    {lang === 'am' ? 'ለደንበኞች የልደት ምኞት መልዕክቶችን እና የቅናሽ ኮዶችን ያስተላልፉ።' : 'Compose birthday wish texts, manage active customer promotions, and review logs.'}
                  </p>
                </div>

                {/* Send Wish to Any Client Search Section */}
                <div className="bg-neutral-50/50 rounded-2xl p-4 border border-neutral-200/50 space-y-3 animate-fade-in">
                  <h4 className="text-xs font-bold text-neutral-850">
                    {lang === 'am' ? 'ለማንኛውም ደንበኛ የልደት ምኞት ይላኩ' : 'Send Birthday Wish to Any Customer'}
                  </h4>
                  
                  {/* Small customer picker */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-neutral-400" />
                      <input
                        type="text"
                        value={bdaySearchQuery}
                        onChange={(e) => setBdaySearchQuery(e.target.value)}
                        placeholder={lang === 'am' ? 'ደንበኛ በስም ወይም ስልክ ፈልግ...' : 'Search customer by name or phone...'}
                        className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 font-medium text-neutral-800"
                        id="birthday-campaign-client-search"
                      />
                    </div>
                  </div>

                  {/* List of matching customers who have a birthday */}
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 bg-white p-2.5 rounded-xl border border-neutral-200/40">
                    {(() => {
                      const matched = customers.filter(c => {
                        const nameMatch = c.full_name.toLowerCase().includes(bdaySearchQuery.toLowerCase());
                        const phoneMatch = c.phone_number.includes(bdaySearchQuery);
                        return (nameMatch || phoneMatch) && c.birth_date;
                      });

                      if (matched.length === 0) {
                        return (
                          <p className="text-[11px] text-neutral-400 text-center py-4">
                            {lang === 'am' ? 'ምንም ደንበኛ (የልደት ቀን ያለው) አልተገኘም።' : 'No customers with birthday found.'}
                          </p>
                        );
                      }

                      return matched.slice(0, 10).map(c => {
                        const etBirthday = c.birth_date ? convertToEthiopian(c.birth_date) : null;
                        return (
                          <div key={c.id} className="flex items-center justify-between p-2 hover:bg-neutral-50 rounded-lg text-xs">
                            <div>
                              <span className="font-bold text-neutral-850">{c.full_name}</span>
                              <span className="text-[10px] text-neutral-400 font-mono ml-2">({c.phone_number})</span>
                              {c.birth_date && (
                                <span className="text-[10px] text-amber-700 font-bold ml-2 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100/60 inline-flex items-center gap-0.5">
                                  🎂 {c.birth_date} {etBirthday ? `(${formatEthiopianDate(etBirthday, lang)})` : ''}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setBirthdayWishCustomer(c)}
                              className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ios-active-scale"
                            >
                              <span>✉️</span>
                              <span>{lang === 'am' ? 'ምኞት ላክ' : 'Compose Wish'}</span>
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Sent Wishes Archive / History Log */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-neutral-850 flex items-center gap-1">
                    <span>📜</span> {lang === 'am' ? 'የተላኩ መልዕክቶች ታሪክ' : 'Sent Wishes History Log'} ({birthdayWishes.length})
                  </h4>

                  <div className="border border-neutral-200 rounded-2xl overflow-hidden bg-white">
                    {birthdayWishes.length === 0 ? (
                      <p className="text-xs text-neutral-400 text-center py-6">
                        {lang === 'am' ? 'እስካሁን ምንም የተላከ የልደት ምኞት የለም።' : 'No birthday wishes sent or logged yet.'}
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-neutral-50/75 border-b border-neutral-200 text-neutral-400 text-[10px] font-bold uppercase tracking-wider">
                              <th className="py-2.5 px-4 font-extrabold">{lang === 'am' ? 'ደንበኛ' : 'Recipient'}</th>
                              <th className="py-2.5 px-4 font-extrabold">{lang === 'am' ? 'ስልክ' : 'Phone'}</th>
                              <th className="py-2.5 px-4 font-extrabold">{lang === 'am' ? 'ጉርሻ / ስጦታ' : 'Campaign Offer'}</th>
                              <th className="py-2.5 px-4 font-extrabold">{lang === 'am' ? 'መልዕክት' : 'Message Body'}</th>
                              <th className="py-2.5 px-4 font-extrabold">{lang === 'am' ? 'ቀን' : 'Sent Date'}</th>
                              <th className="py-2.5 px-4 font-extrabold">{lang === 'am' ? 'በማን' : 'Sender'}</th>
                              <th className="py-2.5 px-4 font-extrabold text-center">{lang === 'am' ? 'ሁኔታ' : 'Status'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100">
                            {birthdayWishes.slice(0, 10).map((w) => (
                              <tr key={w.id} className="hover:bg-neutral-50/40 text-[11px] font-medium text-neutral-750">
                                <td className="py-2.5 px-4 font-bold text-neutral-850">{w.customer_name}</td>
                                <td className="py-2.5 px-4 font-mono text-[10px] text-neutral-500">{w.customer_phone}</td>
                                <td className="py-2.5 px-4">
                                  {w.offer_type === 'none' ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-[9px] font-black border border-neutral-200/50 uppercase">
                                      {lang === 'am' ? 'ምኞት ብቻ' : 'Wish Only'}
                                    </span>
                                  ) : w.offer_type === '50_percent' ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[9px] font-black border border-amber-200/30 uppercase">
                                      {lang === 'am' ? 'የ 50% ቅናሽ' : '50% Off'}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[9px] font-black border border-emerald-200/30 uppercase">
                                      🎉 {lang === 'am' ? 'ነጻ አገልግሎት' : 'Free Service'}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 max-w-[180px] truncate" title={w.message_text}>
                                  {w.message_text}
                                </td>
                                <td className="py-2.5 px-4 font-mono text-[10px] text-neutral-400">
                                  {new Date(w.sent_at).toLocaleDateString()}
                                </td>
                                <td className="py-2.5 px-4 text-neutral-600 font-bold">{w.sent_by}</td>
                                <td className="py-2.5 px-4 text-center">
                                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase bg-neutral-100 text-neutral-600 px-2.5 py-0.5 rounded-full border border-neutral-200/40" title="Draft simulation logged successfully inside Firestore">
                                    🟢 {lang === 'am' ? 'ተመዝግቧል' : 'Logged'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>

        ) : (
          
          // Profile Settings & Staff Register panel
          <div className="bg-white rounded-[24px] border border-neutral-200/50 shadow-ios p-6 max-w-3xl mx-auto space-y-8 animate-fade-in">
            <div>
              <h2 className="text-lg font-extrabold text-neutral-900 tracking-tight flex items-center gap-2">
                <Settings className="w-5 h-5 text-neutral-500" /> {lang === 'am' ? 'የሳሎን ቅንጅቶችና ሰራተኞች' : 'Salon Settings & Staff Management'}
              </h2>
              <p className="text-xs text-neutral-400 mt-1 font-medium">{lang === 'am' ? 'የአስተዳዳሪ መለያ ይቆጣጠሩ እና ካሽየሮችን ያክሉ ወይም ይሰርዙ።' : 'Manage administrative profile controls and expand your staff directory.'}</p>
            </div>

            {/* Active User Info */}
            <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/50 space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#A89F91]">
                {userRole === 'admin' 
                  ? (lang === 'am' ? 'አክቲቭ የአስተዳዳሪ መለያ' : 'Active Admin Profile') 
                  : (lang === 'am' ? 'አክቲቭ የሰራተኛ መለያ' : 'Active Staff Profile')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium">
                <div>
                  <span className="text-neutral-400 block">
                    {lang === 'am' ? 'ሙሉ ስም / የተጠቃሚ ስም:' : 'Name / Username:'}
                  </span>
                  <span className="font-bold text-neutral-800 capitalize">{loggedInUser || 'admin'}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block">
                    {lang === 'am' ? 'የሲስተም ድርሻ (Role):' : 'System Role / Tier:'}
                  </span>
                  <span className="font-bold text-neutral-800 capitalize bg-neutral-200/65 rounded-md px-2.5 py-0.5 inline-block mt-0.5 border border-neutral-300/30">
                    {userRole === 'admin' 
                      ? (lang === 'am' ? 'አስተዳዳሪ (Admin)' : 'Admin') 
                      : userRole === 'cashier' 
                        ? (lang === 'am' ? 'ካሽየር (Cashier)' : 'Cashier') 
                        : (lang === 'am' ? 'ረዳት (Assistant)' : 'Assistant')}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-neutral-200/40 flex justify-end">
                <button
                  onClick={() => {
                    setIsLoggedIn(false);
                    setUserRole(null);
                    setLoggedInUser('');
                    localStorage.removeItem('kaldas_logged_in');
                    localStorage.removeItem('kaldas_user_role');
                    localStorage.removeItem('kaldas_logged_user');
                  }}
                  className="px-4 py-1.5 bg-red-55 text-red-750 hover:bg-red-100 font-bold border border-red-200/40 text-[11px] rounded-full flex items-center gap-1 transition-all ios-active-scale"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {lang === 'am' ? 'ከሲስተሙ ውጣ (Logout)' : 'Logout of Session'}
                </button>
              </div>
            </div>

            {/* SMS Gateway Configurations Toggle */}
            <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-200/50 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#A89F91] flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-neutral-400" /> 
                    {lang === 'am' ? 'የኤስኤምኤስ መላኪያ ቅንጅቶች' : 'GeezSMS Gateway Configuration'}
                  </h3>
                  <p className="text-xs font-bold text-neutral-800">
                    {lang === 'am' ? 'የደንበኛ ኤስኤምኤስ አገልግሎት' : 'Automated Client SMS Dispatch'}
                  </p>
                  <p className="text-[11px] text-neutral-400 font-medium leading-relaxed">
                    {lang === 'am'
                      ? 'ሲበራ፡ ደንበኞች ሲመዘገቡ፣ ክፍያ ሲፈጽሙ እና ልደት ሲከበር የራስ-ሰር ምስጋና እና የእንኳን አደረሳችሁ መልዕክት በGeezSMS በኩል ይላክላቸዋል።'
                      : 'When enabled, clients will automatically receive real-time welcome notifications, post-visit thank you receipts, and birthday campaign rewards via GeezSMS.'}
                  </p>
                </div>

                {/* iOS Style Switch/Toggle button */}
                <div className="flex items-center pt-1 shrink-0">
                  <button
                    type="button"
                    disabled={isSmsSaving}
                    onClick={() => handleToggleSms(!smsEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      smsEnabled ? 'bg-neutral-900' : 'bg-neutral-250'
                    } ${userRole !== 'admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={
                      userRole !== 'admin' 
                        ? (lang === 'am' ? 'የአስተዳዳሪ መብት ያስፈልጋል' : 'Admin privilege required') 
                        : (lang === 'am' ? 'ማብሪያ / ማጥፊያ' : 'Toggle Switch')
                    }
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        smsEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Display Notice for Cashier or Non-Admins */}
              {userRole !== 'admin' && (
                <div className="p-3 bg-amber-50/50 border border-amber-200/40 rounded-xl text-[10px] text-amber-800 font-bold flex items-center gap-2">
                  <span>⚠️</span>
                  <span>
                    {lang === 'am' 
                      ? 'የኤስኤምኤስ ቅንጅቶችን ማብራት ወይም ማጥፋት የሚችሉት አስተዳዳሪዎች (Admin) ብቻ ናቸው።' 
                      : 'Only Salon Administrators have permission to modify or toggle automated SMS dispatch.'}
                  </span>
                </div>
              )}

              {/* Display Status Indicator */}
              <div className="pt-2 border-t border-neutral-200/40 flex items-center justify-between text-[11px] font-bold">
                <span className="text-neutral-400">
                  {lang === 'am' ? 'የአሁኑ የኤስኤምኤስ ሁኔታ:' : 'Gateway Status:'}
                </span>
                {smsEnabled ? (
                  <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {lang === 'am' ? 'ኤስኤምኤስ በርቷል (Active)' : 'SMS Dispatch Active'}
                  </span>
                ) : (
                  <span className="text-neutral-500 bg-neutral-100 px-2.5 py-0.5 rounded-full border border-neutral-200/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                    {lang === 'am' ? 'ኤስኤምኤስ ጠፍቷል (Disabled)' : 'SMS Dispatch Disabled'}
                  </span>
                )}
              </div>
            </div>

            {/* Staff Management section in Settings */}
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#A89F91] flex items-center gap-1.5">
                <Users className="w-4 h-4 text-neutral-400" /> {lang === 'am' ? 'የሳሎን ካሽየሮችና ረዳቶች' : 'Salon Cashiers & Assistants'} ({staffList.length})
              </h3>

              {userRole === 'admin' ? (
                /* Staff Form */
                <form onSubmit={handleAddStaff} className="bg-white rounded-2xl border border-neutral-150 p-4 space-y-3 shadow-xs">
                  <h4 className="text-xs font-bold text-neutral-850">{lang === 'am' ? 'አዲስ ሰራተኛ ጨምር' : 'Register New Staff Member'}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">{lang === 'am' ? 'ሙሉ ስም' : 'Staff Full Name'}</label>
                      <input
                        type="text"
                        required
                        value={staffName}
                        onChange={(e) => setStaffName(e.target.value)}
                        placeholder="e.g. Sofia Vergara"
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-neutral-900 focus:outline-none focus:border-neutral-900 font-medium text-neutral-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">{lang === 'am' ? 'የስራ ድርሻ (Role)' : 'Assigned Role'}</label>
                      <select
                        value={staffRole}
                        onChange={(e) => setStaffRole(e.target.value as UserRole)}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-neutral-900 focus:outline-none focus:border-neutral-900 font-bold text-neutral-800"
                      >
                        <option value="cashier">{lang === 'am' ? 'ካሽየር (Cashier)' : 'Cashier'}</option>
                        <option value="inventory">{lang === 'am' ? 'የዕቃዎች ተቆጣጣሪ (Inventory Manager)' : 'Inventory Manager'}</option>
                        <option value="walkin">{lang === 'am' ? 'ተራና ደንበኛ ተቀባይ (Walk-in Manager)' : 'Walk-in / Queue Manager'}</option>
                        <option value="assistant">{lang === 'am' ? 'ረዳት (Assistant)' : 'Assistant'}</option>
                        <option value="admin">{lang === 'am' ? 'አስተዳዳሪ (Admin)' : 'Admin'}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">{lang === 'am' ? 'ይለፍ ቃል (Password)' : 'Password'}</label>
                      <input
                        type="password"
                        required
                        value={staffPassword}
                        onChange={(e) => setStaffPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-neutral-900 focus:outline-none focus:border-neutral-900 font-medium text-neutral-800"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-bold shadow-xs transition-all ios-active-scale hover:shadow-xs animate-fade-in"
                    >
                      + {lang === 'am' ? 'አክል' : 'Add Staff'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 text-xs text-amber-800 font-medium flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>
                    {lang === 'am' 
                      ? 'የሰራተኛ መለያዎችን ማስተዳደር ለአስተዳዳሪዎች (Admin) ብቻ የተፈቀደ ተግባር ነው።' 
                      : 'Staff credential configuration is restricted. Only system Administrators can register or modify active staff members.'}
                  </span>
                </div>
              )}

              {/* Staff table list */}
              <div className="border border-neutral-200 rounded-2xl overflow-hidden divide-y divide-neutral-100 bg-white">
                {staffList.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-6">{lang === 'am' ? 'ምንም የሰራተኛ መዝገብ የለም።' : 'No staff registered yet.'}</p>
                ) : (
                  staffList.map((member) => (
                    <div key={member.id} className="p-3 px-4 flex items-center justify-between text-xs hover:bg-neutral-50/50">
                      <div>
                        <p className="font-bold text-neutral-850">{translateName(member.name, lang)}</p>
                        <p className="text-[10px] text-neutral-400 uppercase tracking-widest mt-0.5">
                          {member.role === 'cashier' ? (lang === 'am' ? 'ካሽየር (Cashier)' : 'Cashier') :
                           member.role === 'inventory' ? (lang === 'am' ? 'የዕቃዎች መቆጣጠሪያ (Inventory Manager)' : 'Inventory Manager') :
                           member.role === 'walkin' ? (lang === 'am' ? 'ተራና ደንበኛ ተቀባይ (Walk-in Manager)' : 'Walk-in Manager') :
                           member.role === 'assistant' ? (lang === 'am' ? 'ረዳት (Assistant)' : 'Assistant') :
                           member.role === 'admin' ? (lang === 'am' ? 'አስተዳዳሪ (Admin)' : 'Admin') : member.role}
                          {userRole === 'admin' && (
                            <span className="ml-2 font-mono lowercase opacity-75">({lang === 'am' ? 'የይለፍ ቃል' : 'password'}: {member.password})</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-neutral-400 font-mono">{member.created_at ? new Date(member.created_at).toLocaleDateString() : ''}</span>
                        {userRole === 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteStaff(member.id)}
                            className="p-1 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-full text-[10px] font-bold flex items-center gap-1 transition-colors ios-active-scale"
                            title="Delete staff"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {lang === 'am' ? 'ሰርዝ' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Treatment Artists & Service Providers Section */}
            <div className="space-y-4 pt-6 border-t border-neutral-100">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#A89F91] flex items-center gap-1.5 animate-fade-in">
                <Scissors className="w-4 h-4 text-neutral-400" /> {lang === 'am' ? 'የውበት ባለሙያዎችና ሰራተኞች (Treatment Artists)' : 'Service Providers & Treatment Artists'} ({artistsList.length})
              </h3>

              {userRole === 'admin' ? (
                /* Artist Form */
                <form onSubmit={handleAddArtist} className="bg-white rounded-2xl border border-neutral-150 p-4 space-y-3 shadow-xs animate-fade-in">
                  <h4 className="text-xs font-bold text-neutral-850">{lang === 'am' ? 'አዲስ የውበት ባለሙያ ጨምር' : 'Register New Treatment Artist / Provider'}</h4>
                  <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1">
                      <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">{lang === 'am' ? 'ባለሙያ ሙሉ ስም' : 'Artist Full Name'}</label>
                      <input
                        type="text"
                        required
                        value={artistName}
                        onChange={(e) => setArtistName(e.target.value)}
                        placeholder="e.g. Mahlet Solomon"
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-neutral-900 focus:outline-none focus:border-neutral-900 font-medium text-neutral-800"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-6 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-bold shadow-xs transition-all ios-active-scale whitespace-nowrap h-[34px]"
                    >
                      + {lang === 'am' ? 'ባለሙያ አክል' : 'Add Artist'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 text-xs text-amber-800 font-medium flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>
                    {lang === 'am' 
                      ? 'የውበት ባለሙያዎችን መዝገብ ማስተዳደር ለአስተዳዳሪዎች (Admin) ብቻ የተፈቀደ ተግባር ነው።' 
                      : 'Treatment Artist directory configuration is restricted. Only system Administrators can register or modify active artists.'}
                  </span>
                </div>
              )}

              {/* Artists list table */}
              <div className="border border-neutral-200 rounded-2xl overflow-hidden divide-y divide-neutral-100 bg-white">
                {artistsList.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-6">{lang === 'am' ? 'ምንም የውበት ባለሙያ አልተመዘገበም።' : 'No treatment artists registered yet.'}</p>
                ) : (
                  artistsList.map((art) => (
                    <div key={art.id} className="p-3 px-4 flex items-center justify-between text-xs hover:bg-neutral-50/50">
                      <div>
                        <p className="font-bold text-neutral-850">{translateName(art.name, lang)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-neutral-400 font-mono">{art.created_at ? new Date(art.created_at).toLocaleDateString() : ''}</span>
                        {userRole === 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteArtist(art.id)}
                            className="p-1 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-full text-[10px] font-bold flex items-center gap-1 transition-colors ios-active-scale"
                            title="Delete artist"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {lang === 'am' ? 'ሰርዝ' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Services & Treatment Settings Section */}
            <div className="space-y-4 pt-6 border-t border-neutral-100">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#A89F91] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-neutral-400" /> {lang === 'am' ? 'የውበት አገልግሎቶችና ዋጋዎች' : 'Beauty Services & Treatments Settings'} ({salonServices.length})
              </h3>

              {userRole === 'admin' ? (
                /* Add Service Form */
                <form onSubmit={handleAddService} className="bg-white rounded-2xl border border-neutral-150 p-4 space-y-3 shadow-xs">
                  <h4 className="text-xs font-bold text-neutral-850">{lang === 'am' ? 'አዲስ የአገልግሎት አይነት ጨምር' : 'Add New Salon Treatment or Service'}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">{lang === 'am' ? 'የአገልግሎት ስም' : 'Service Name'}</label>
                      <input
                        type="text"
                        required
                        value={newServiceName}
                        onChange={(e) => setNewServiceName(e.target.value)}
                        placeholder="e.g. Balayage Hair"
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-neutral-900 focus:outline-none focus:border-neutral-900 font-medium text-neutral-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">{lang === 'am' ? 'ዘርፍ (Category)' : 'Treatment Category'}</label>
                      <select
                        value={newServiceCategory}
                        onChange={(e) => setNewServiceCategory(e.target.value as any)}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-neutral-900 focus:outline-none focus:border-neutral-900 font-bold text-neutral-800"
                      >
                        <option value="Hair">{lang === 'am' ? 'ፀጉር (Hair)' : 'Hair'}</option>
                        <option value="Nails">{lang === 'am' ? 'ጥፍር (Nails)' : 'Nails'}</option>
                        <option value="Skin">{lang === 'am' ? 'ቆዳ (Skin)' : 'Skin'}</option>
                        <option value="Massage">{lang === 'am' ? 'ማሳጅ (Massage)' : 'Massage'}</option>
                        <option value="Product">{lang === 'am' ? 'የሽያጭ ምርት (Product)' : 'Product'}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">{lang === 'am' ? 'መደበኛ ዋጋ (ETB)' : 'Default Price (ETB)'}</label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={newServicePrice}
                        onChange={(e) => setNewServicePrice(e.target.value)}
                        placeholder="150.00"
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-neutral-900 focus:outline-none focus:border-neutral-900 font-bold text-neutral-850"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-bold shadow-xs transition-all ios-active-scale hover:shadow-xs"
                    >
                      + {lang === 'am' ? 'አገልግሎት ጨምር' : 'Add Treatment'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 text-xs text-amber-800 font-medium flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>
                    {lang === 'am' 
                      ? 'የውበት አገልግሎቶችንና ዋጋዎችን ማሻሻል ለአስተዳዳሪዎች (Admin) ብቻ የተፈቀደ ተግባር ነው።' 
                      : 'Salon Treatment config is restricted. Only system Administrators can define, update, or delete catalog services and prices.'}
                  </span>
                </div>
              )}

              {/* Services List Table */}
              <div className="border border-neutral-200 rounded-2xl overflow-hidden divide-y divide-neutral-100 bg-white">
                {salonServices.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-6">{lang === 'am' ? 'ምንም የአገልግሎት መዝገብ የለም።' : 'No custom treatments registered yet.'}</p>
                ) : (
                  salonServices.map((srv) => {
                    const isEditing = editingServiceId === srv.id;
                    return (
                      <div key={srv.id} className="p-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-neutral-50/50">
                        {isEditing ? (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 mr-3 items-end">
                            <div>
                              <input
                                type="text"
                                value={editingServiceName}
                                onChange={(e) => setEditingServiceName(e.target.value)}
                                className="w-full bg-neutral-50 border border-neutral-300 rounded p-1 text-xs font-bold text-neutral-850 focus:outline-none"
                              />
                            </div>
                            <div>
                              <select
                                value={editingServiceCategory}
                                onChange={(e) => setEditingServiceCategory(e.target.value as any)}
                                className="w-full bg-neutral-55 border border-neutral-300 rounded p-1 text-xs font-bold text-neutral-800 focus:outline-none"
                              >
                                <option value="Hair">Hair</option>
                                <option value="Nails">Nails</option>
                                <option value="Skin">Skin</option>
                                <option value="Massage">Massage</option>
                                <option value="Product">Product</option>
                              </select>
                            </div>
                            <div>
                              <input
                                type="number"
                                value={editingServicePrice}
                                onChange={(e) => setEditingServicePrice(e.target.value)}
                                className="w-full bg-neutral-50 border border-neutral-300 rounded p-1 text-xs font-bold text-neutral-850 focus:outline-none"
                              />
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="font-bold text-neutral-850 flex items-center gap-1.5">
                              {translateServiceName(srv.id, srv.name, lang)}
                              <span className="text-[9px] uppercase font-black text-neutral-400 bg-neutral-50 border border-neutral-200/50 rounded-full px-1.5 py-0.5">{translateCategory(srv.category, lang)}</span>
                            </p>
                            <p className="text-neutral-400 text-[10.5px] mt-0.5 font-bold font-mono">{Number(srv.defaultPrice).toFixed(2)} ETB</p>
                          </div>
                        )}

                        {userRole === 'admin' && (
                          <div className="flex items-center gap-2 justify-end">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSaveServiceEdit(srv.id)}
                                  className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold transition-all"
                                >
                                  {lang === 'am' ? 'አስቀምጥ' : 'Save'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingServiceId(null)}
                                  className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full text-[10px] font-bold transition-all"
                                >
                                  {lang === 'am' ? 'ተው' : 'Cancel'}
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingServiceId(srv.id);
                                    setEditingServiceName(srv.name);
                                    setEditingServiceCategory(srv.category as any);
                                    setEditingServicePrice(String(srv.defaultPrice));
                                  }}
                                  className="p-1 px-3 bg-neutral-100 hover:bg-neutral-200/80 text-neutral-750 rounded-full text-[10px] font-bold transition-all"
                                >
                                  {lang === 'am' ? 'አስተካክል' : 'Edit'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteService(srv.id)}
                                  className="p-1 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-full text-[10px] font-bold flex items-center gap-1 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  {lang === 'am' ? 'ሰርዝ' : 'Delete'}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>



          </div>
        )}

      </main>

      {/* Floating Check-In & session capturing overlays drawer */}
      {showCheckInDrawer && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-[#2D2D2D]/40 backdrop-blur-xs z-40 animate-fade-in transition-opacity" 
            onClick={() => setShowCheckInDrawer(false)}
          />
          <CheckInModal 
            customers={customers} 
            preSelectedCustomer={preSelectedForVisit || selectedClientObject}
            preSelectedServiceIds={preSelectedServicesForVisit}
            preSelectedArtistIds={preSelectedArtistsForVisit}
            onClose={() => {
              setShowCheckInDrawer(false);
              setPreSelectedForVisit(null);
              setPreSelectedServicesForVisit([]);
              setPreSelectedArtistsForVisit([]);
            }} 
            onVisitLogged={(updatedCustomer) => {
              handleVisitLoggedSuccess(updatedCustomer);
              setPreSelectedServicesForVisit([]);
              setPreSelectedArtistsForVisit([]);
            }}
            lang={lang}
            dict={dict}
            salonServices={salonServices}
            allVisits={allVisits}
            staffList={staffList}
            artistsList={artistsList}
          />
        </>
      )}

      {/* Floating Client Registration Overlay Modal */}
      {showRegPanel && (
        <RegistrationForm 
          existingCustomers={customers} 
          onRegisterSuccess={(newC) => {
            handleRegisterSuccess(newC);
            setShowRegPanel(false);
          }} 
          lang={lang}
          dict={dict}
          onClose={() => setShowRegPanel(false)}
        />
      )}

      {/* Floating Birthday notifications with premium collapsible states */}
      {birthdayClients.length > 0 && (
        isBirthdayCollapsed ? (
          <button
            onClick={() => setIsBirthdayCollapsed(false)}
            className="fixed bottom-6 right-6 z-40 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs p-3.5 rounded-full shadow-lg flex items-center gap-1.5 border border-amber-400 group ios-active-scale animate-fade-in"
            title={lang === 'am' ? 'የልደት በዓላት አስታዋሽ' : 'Birthday Reminders'}
          >
            <span className="text-base select-none">🎂</span>
            <span className="bg-white text-amber-700 text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black">
              {birthdayClients.length}
            </span>
          </button>
        ) : (
          <div className="fixed bottom-6 right-6 z-40 max-w-[calc(100vw-2rem)] w-80 bg-white border border-amber-200 rounded-[24px] p-4.5 shadow-ios-lg animate-fade-in space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-amber-50 rounded-full flex items-center justify-center border border-amber-100">
                  <span className="text-sm">🎉</span>
                </div>
                <h4 className="text-xs font-black text-neutral-900 tracking-tight">
                  {lang === 'am' ? 'የዛሬ የልደት በዓላት! 🎂' : "Today's Birthdays! 🎂"} ({birthdayClients.length})
                </h4>
              </div>
              <button
                onClick={() => setIsBirthdayCollapsed(true)}
                className="p-1.5 rounded-full bg-neutral-50 hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
                title={lang === 'am' ? 'ደብቅ' : 'Minimize'}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-amber-100/60 overflow-hidden rounded-xl border border-amber-100 bg-amber-50/20 max-h-40 overflow-y-auto">
              {birthdayClients.map((client) => {
                const etBirthday = client.birth_date ? convertToEthiopian(client.birth_date) : null;
                return (
                  <div key={client.id} className="p-2.5 px-3 flex items-center justify-between text-xs hover:bg-amber-100/20 transition-colors">
                    <div>
                      <span className="font-extrabold text-neutral-800 block leading-tight">{client.full_name}</span>
                      {etBirthday && (
                        <span className="block text-[10px] text-amber-800 font-bold mt-0.5">
                          {formatEthiopianDate(etBirthday, lang)}
                        </span>
                      )}
                      <span className="block text-[9px] font-bold text-neutral-400 font-mono mt-0.5">{client.phone_number}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {client.retentionStatus === 'Frequent' && (
                        <span className="text-[8px] bg-emerald-50 text-emerald-800 border-emerald-100 border rounded-full px-2 py-0.5 uppercase font-medium tracking-wider select-none flex items-center gap-0.5">
                          🎁 {lang === 'am' ? 'ነጻ!' : 'Free!'}
                        </span>
                      )}
                      {userRole === 'admin' && (
                        <button
                          onClick={() => setBirthdayWishCustomer(client)}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5 shadow-xs ios-active-scale transition-all"
                          title={lang === 'am' ? 'መልዕክት ላክ' : 'Send SMS'}
                        >
                          ✉️ {lang === 'am' ? 'ምኞት' : 'Wish'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[9.5px] text-[#A89F91] font-bold uppercase text-center tracking-wider">
              {lang === 'am' ? 'ልደታቸውን በመጠየቅ ደስታቸውን አብረዋቸው ያክብሩ!' : 'Celebrate on their visits!'}
            </p>
          </div>
        )
      )}

      {/* Premium Footer */}
      <footer className="relative z-10 bg-white/70 backdrop-blur-md border-t border-[#E5D5C8]/80 py-8 px-4 text-center mt-12 shadow-inner">
        <p className="text-xs text-[#A89F91] font-medium tracking-wide">
          {dict.app_name} • Bespoke CRM Luxury Suite © 2026. All Client Formulation Diaries Protected.
        </p>
      </footer>

      {birthdayWishCustomer && (
        <BirthdayWishModal
          customer={birthdayWishCustomer}
          lang={lang}
          onClose={() => setBirthdayWishCustomer(null)}
        />
      )}

    </div>
  );
}
