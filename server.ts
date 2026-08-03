/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.ts';
import { customers, visits, staff, services } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';
import { Customer, Visit, CustomerWithRetention, RetentionStatus } from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json());

// --- IN-MEMORY FALLBACK CLASSIFIER LOGIC FOR RETENTION ---
function classifyCustomer(customer: any, usrVisits: any[], curTime = new Date()): CustomerWithRetention {
  const customerVisits = usrVisits
    .filter(v => v.customer_id === customer.id)
    .sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());

  const lastVisit = customerVisits[0];
  const lastVisitDate = lastVisit ? lastVisit.visit_date : undefined;

  let visitCountInLast30Days = 0;
  let visitCountIn30To60Days = 0;

  customerVisits.forEach(v => {
    const vDate = new Date(v.visit_date);
    const diffMs = curTime.getTime() - vDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays >= 0 && diffDays <= 30) {
      visitCountInLast30Days++;
    } else if (diffDays > 30 && diffDays <= 60) {
      visitCountIn30To60Days++;
    }
  });

  let retentionStatus: RetentionStatus = 'At-Risk'; // default

  if (visitCountInLast30Days >= 2) {
    retentionStatus = 'Frequent';
  } else if (visitCountInLast30Days === 1 || visitCountIn30To60Days === 1) {
    retentionStatus = 'Occasional';
  } else {
    retentionStatus = 'At-Risk';
  }

  return {
    id: customer.id,
    full_name: customer.full_name,
    phone_number: customer.phone_number,
    birth_date: customer.birth_date || undefined,
    created_at: customer.created_at,
    notes_preferences: customer.notes_preferences || undefined,
    retentionStatus,
    lastVisitDate,
    visitCountInLast30Days
  };
}

// --- SMS LOGS AND CACHE ---
let smsLogs: any[] = [];
const LOG_FILE = path.join(process.cwd(), 'sms_logs_cache.json');

function initSmsLogsCache() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const fileContent = fs.readFileSync(LOG_FILE, 'utf8').trim();
      if (fileContent) {
        const parsed = JSON.parse(fileContent);
        smsLogs = Array.isArray(parsed) ? parsed : [];
      } else {
        smsLogs = [];
        fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2));
      }
    } else {
      smsLogs = [];
      fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2));
    }
  } catch (e) {
    console.error('[SMS Logs] Failed to load SMS logs from cache file, initializing clean array:', e);
    smsLogs = [];
    try {
      fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2));
    } catch (writeErr) {
      console.error('[SMS Logs] Failed to create empty SMS logs cache file:', writeErr);
    }
  }
}
initSmsLogsCache();

function saveSmsLog(phone: string, message: string, status: 'Sent' | 'Failed', errorMessage?: string) {
  const logEntry = {
    id: `log_${crypto.randomUUID()}`,
    phone,
    message,
    status,
    error_message: errorMessage || null,
    sent_at: new Date().toISOString()
  };
  smsLogs.unshift(logEntry);
  if (smsLogs.length > 300) {
    smsLogs = smsLogs.slice(0, 300);
  }
  try {
    fs.writeFileSync(LOG_FILE, JSON.stringify(smsLogs, null, 2));
  } catch (e) {
    console.error('[SMS Logs] Failed to write SMS logs cache file:', e);
  }
  return logEntry;
}

// --- GEEZ SMS INTEGRATION ---
async function sendGeezSMS(phoneNumber: string, messageText: string) {
  // Clean token of potential quotes or whitespace
  const rawToken = process.env.GEEZ_SMS_TOKEN || 'm3tCICfmNSGx1OweNguDXAhwChkF6m4Q';
  const token = rawToken.trim().replace(/^["']|["']$/g, '').trim();
  
  // Normalize Ethiopian phone number format to standard 12-digit international format (starting with 251)
  let cleaned = phoneNumber.trim().replace(/[\s\-\(\)\+]/g, '');
  let formattedPhone = '';
  if (cleaned.startsWith('2510')) {
    formattedPhone = '251' + cleaned.substring(4);
  } else if (cleaned.startsWith('251')) {
    formattedPhone = cleaned;
  } else if (cleaned.startsWith('0')) {
    formattedPhone = '251' + cleaned.substring(1);
  } else if ((cleaned.startsWith('9') || cleaned.startsWith('7')) && cleaned.length === 9) {
    formattedPhone = '251' + cleaned;
  } else {
    formattedPhone = cleaned;
  }
  
  console.log(`[GeezSMS] Preparing SMS. Original: ${phoneNumber}, Normalized International: ${formattedPhone}`);
  try {
    const url = 'https://api.geezsms.com/api/v1/sms/send';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: token,
        phone: formattedPhone,
        msg: messageText
      })
    });
    
    let data: any = {};
    const text = (await response.text()).trim();
    if (text.includes('"error":true') || text.includes('"error": true') || text.includes('error:true')) {
      console.warn(`[GeezSMS] API returned failure response for ${formattedPhone}:`, text);
    } else {
      console.log(`[GeezSMS] API response indicates dispatch success for ${formattedPhone}`);
    }
    
    try {
      const parsed = JSON.parse(text);
      if (parsed.error === true || parsed.error === 'true') {
        data = { error: true, msg: parsed.msg || parsed.message || 'GeezSMS API error' };
      } else if (parsed.error === false || parsed.error === 'false') {
        data = { error: false, msg: parsed.msg || parsed.message || 'Success' };
      } else {
        data = { error: !response.ok, ...parsed };
      }
    } catch (jsonErr) {
      const normalizedText = text.toLowerCase();
      if (normalizedText.includes('"error":false') || normalizedText.includes('"error": false') || normalizedText.includes('error:false')) {
        data = { error: false, msg: text };
      } else {
        data = { error: !response.ok, msg: text || `HTTP Error ${response.status}` };
      }
    }
    
    if (data.error) {
      if (data.msg && typeof data.msg === 'string' && data.msg.toLowerCase().includes('safaricom') && data.msg.toLowerCase().includes('sender')) {
        data.msg = `${data.msg} (Action Required: Safaricom Ethiopia requires manual Sender Name approval. Please contact GeezSMS Support to whitelist your brand name/Sender ID on Safaricom.)`;
      }
      console.error(`[GeezSMS] Failed response for ${formattedPhone}:`, data.msg);
    } else {
      console.log(`[GeezSMS] Success response for ${formattedPhone}:`, data.msg);
    }
    
    // Log the message status in local cache
    if (data.error) {
      saveSmsLog(formattedPhone, messageText, 'Failed', data.msg);
    } else {
      saveSmsLog(formattedPhone, messageText, 'Sent');
    }
    
    return data;
  } catch (error) {
    console.error(`[GeezSMS] API Network Error sending to ${formattedPhone}:`, error);
    saveSmsLog(formattedPhone, messageText, 'Failed', String(error));
    return { error: true, msg: String(error) };
  }
}

// --- DATABASE AUTO-SEEDER ---
async function ensureSeeded() {
  try {
    // 1. Seed Services / Treatments
    const existingServices = await db.select().from(services);
    if (existingServices.length === 0) {
      console.log('No services found in Cloud SQL. Seeding default salon treatments catalog...');
      const seedServicesList = [
        { id: 'srv_1', name: 'Balayage Premium Hair Coloring', category: 'Hair', defaultPrice: 120.00 },
        { id: 'srv_2', name: 'Signature Hydrafacial Treatment', category: 'Skin', defaultPrice: 85.00 },
        { id: 'srv_3', name: 'Luxury Gel Manicure & Hand Massage', category: 'Nails', defaultPrice: 45.00 },
        { id: 'srv_4', name: 'Reluxe Pedicare & Paraffin Therapy', category: 'Nails', defaultPrice: 55.00 },
        { id: 'srv_5', name: 'Deep Tissue Silk Massage (60 Min)', category: 'Massage', defaultPrice: 95.00 },
        { id: 'srv_6', name: 'Keratin Nourishing Therapy', category: 'Hair', defaultPrice: 150.00 },
        { id: 'srv_7', name: 'Chic Style Blowout & Styling', category: 'Hair', defaultPrice: 40.00 },
        { id: 'srv_8', name: 'Collagen Face Mask Refresh', category: 'Skin', defaultPrice: 30.00 },
        { id: 'prod_9', name: 'Argan Recovery Styling Oil (Retail)', category: 'Product', defaultPrice: 35.00 },
        { id: 'prod_10', name: 'Organic Herbal Cleansing Gel (Retail)', category: 'Product', defaultPrice: 28.00 }
      ];
      for (const s of seedServicesList) {
        await db.insert(services).values(s);
      }
      console.log('Seeded', seedServicesList.length, 'salon treatments.');
    }

    // 2. Seed Staff members
    const existingStaff = await db.select().from(staff);
    if (existingStaff.length === 0) {
      console.log('No staff members found in Cloud SQL. Seeding defaults with standard passwords...');
      const defaultStaff = [
        { id: 's_1', name: 'Helen Bekele', role: 'cashier', password: 'helen', created_at: new Date().toISOString() },
        { id: 's_2', name: 'Michael Tesfaye', role: 'assistant', password: 'michael', created_at: new Date().toISOString() }
      ];
      for (const st of defaultStaff) {
        await db.insert(staff).values(st);
      }
      console.log('Seeded default Cashier and Assistant team members.');
    }

    // 3. Seed Customers
    const existingCustomers = await db.select().from(customers);
    if (existingCustomers.length === 0) {
      console.log('No customers found in Cloud SQL. Seeding premium CRM logs...');
      const now = new Date('2026-06-17T12:00:00Z');
      const dX = (daysAgo: number) => {
        const d = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        return d.toISOString();
      };

      const seedCustomersList = [
        {
          id: 'c1_sofia',
          full_name: 'Sofia Vergara',
          phone_number: '+1 310-555-0192',
          birth_date: '1972-07-10',
          created_at: dX(120),
          notes_preferences: 'Prefers mild lavender hair organic shampoo. Sensitive to chemical hair bleach, use herbal alternatives only.'
        },
        {
          id: 'c2_naomi',
          full_name: 'Naomi Campbell',
          phone_number: '+44 20-7946-0958',
          birth_date: '1970-05-22',
          created_at: dX(90),
          notes_preferences: 'Signature blowout client. Prefers warm styling irons and extra hydration treatment.'
        },
        {
          id: 'c3_zendaya',
          full_name: 'Zendaya Coleman',
          phone_number: '+1 510-555-4321',
          birth_date: '1996-09-01',
          created_at: dX(45),
          notes_preferences: 'Enjoys deep tissue massage and gel manicures. Always schedules with warm rose-gold nail polish.'
        },
        {
          id: 'c4_scarlett',
          full_name: 'Scarlett Johansson',
          phone_number: '+1 212-555-8888',
          birth_date: '1984-11-22',
          created_at: dX(75),
          notes_preferences: 'Prefers collagen facials and mild skin masks. Allergenic history with citrus oils.'
        },
        {
          id: 'c5_bella',
          full_name: 'Bella Hadid',
          phone_number: '+1 310-555-0010',
          birth_date: '1996-10-09',
          created_at: dX(35),
          notes_preferences: 'Balayage hair coloring regularly. Prefers deep condition styling. Always provides high tips.'
        },
        {
          id: 'c6_rihanna',
          full_name: 'Rihanna Fenty',
          phone_number: '+1 246-555-1988',
          birth_date: '1988-02-20',
          created_at: dX(150),
          notes_preferences: 'Owner of custom cosmetics line. Strictly organic oils for hand massage.'
        }
      ];

      for (const c of seedCustomersList) {
        await db.insert(customers).values(c);
      }

      // Seed Visits
      const seedVisitsList = [
        {
          id: 'v_z1',
          customer_id: 'c3_zendaya',
          items_used: ['srv_3', 'srv_5'],
          price_charged: 140.00,
          payment_method: 'Telebirr',
          visit_date: dX(5)
        },
        {
          id: 'v_z2',
          customer_id: 'c3_zendaya',
          items_used: ['srv_7'],
          price_charged: 40.00,
          payment_method: 'CBE Birr',
          visit_date: dX(18)
        },
        {
          id: 'v_b1',
          customer_id: 'c5_bella',
          items_used: ['srv_1', 'srv_6'],
          price_charged: 270.00,
          payment_method: 'Card',
          visit_date: dX(8)
        },
        {
          id: 'v_b2',
          customer_id: 'c5_bella',
          items_used: ['srv_3', 'prod_9'],
          price_charged: 80.00,
          payment_method: 'Cash',
          visit_date: dX(22)
        },
        {
          id: 'v_s1',
          customer_id: 'c4_scarlett',
          items_used: ['srv_2', 'srv_8'],
          price_charged: 115.00,
          payment_method: 'Bank Transfer',
          visit_date: dX(10)
        },
        {
          id: 'v_n1',
          customer_id: 'c2_naomi',
          items_used: ['srv_6', 'srv_7'],
          price_charged: 190.00,
          payment_method: 'Telebirr',
          visit_date: dX(45)
        },
        {
          id: 'v_sf1',
          customer_id: 'c1_sofia',
          items_used: ['srv_1'],
          price_charged: 120.00,
          payment_method: 'Card',
          visit_date: dX(80)
        }
      ];

      for (const v of seedVisitsList) {
        await db.insert(visits).values(v);
      }
      console.log('Seeded default customer database and timeline visit logs.');
    }
  } catch (err) {
    console.error('Failed to seed Cloud SQL database:', err);
  }
}

// Ensure database is bootstrapped right away
ensureSeeded();

// --- API ROUTES WITH SECURITY & ERROR HANDLING ---

// Login API supporting Admin and Staff logins (Name and Password)
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    // Check system admin
    if (username.trim() === 'admin' && password.trim() === 'admin') {
      res.json({ success: true, role: 'admin', name: 'Administrator' });
      return;
    }

    // Query staff from database
    const staffList = await db.select().from(staff);
    const matched = staffList.find(s => s.name.toLowerCase() === username.trim().toLowerCase() && s.password === password);
    if (matched) {
      res.json({ success: true, role: matched.role, name: matched.name });
    } else {
      res.status(401).json({ error: 'Incorrect username or password' });
    }
  } catch (err) {
    console.error('Error during Login handler:', err);
    res.status(500).json({ error: 'Database query failed. Please try again later.' });
  }
});

// List Customers with computed Retention levels
app.get('/api/customers', async (req, res) => {
  try {
    const clients = await db.select().from(customers);
    const allVisits = await db.select().from(visits);
    const curTime = new Date();
    const finalCustomers = clients.map(c => classifyCustomer(c, allVisits, curTime));
    res.json(finalCustomers);
  } catch (err) {
    console.error('Error in GET /api/customers:', err);
    res.status(500).json({ error: 'Database query failed. Please try again later.' });
  }
});

// Fetch Single Customer and their entire chronological visit log
app.get('/api/customers/:id', async (req, res) => {
  try {
    const clients = await db.select().from(customers).where(eq(customers.id, req.params.id));
    if (clients.length === 0) {
      res.status(404).json({ error: 'Customer profile not found' });
      return;
    }
    const client = clients[0];
    const allVisits = await db.select().from(visits);
    const customerVisits = allVisits
      .filter(v => v.customer_id === client.id)
      .sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());

    const curTime = new Date();
    const classified = classifyCustomer(client, allVisits, curTime);

    res.json({
      customer: classified,
      visits: customerVisits
    });
  } catch (err) {
    console.error('Error in GET /api/customers/:id:', err);
    res.status(500).json({ error: 'Database query failed. Please try again later.' });
  }
});

// Update Notes & preferences for customer
app.put('/api/customers/:id/notes', async (req, res) => {
  try {
    const { notes } = req.body;
    await db.update(customers)
      .set({ notes_preferences: notes })
      .where(eq(customers.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error('Error in PUT /api/customers/:id/notes:', err);
    res.status(500).json({ error: 'Database query failed. Please try again later.' });
  }
});

// Update Customer Name, Phone, Birth date
app.put('/api/customers/:id', async (req, res) => {
  try {
    const { full_name, phone_number, birth_date } = req.body;
    if (!full_name || !phone_number) {
      res.status(400).json({ error: 'Full Name and Phone Number are required' });
      return;
    }

    const trimmedPhone = phone_number.trim();
    // Check duplicates
    const allClients = await db.select().from(customers);
    const duplicate = allClients.find(
      c => c.id !== req.params.id && c.phone_number.replace(/[\s\-\(\)]/g, '') === trimmedPhone.replace(/[\s\-\(\)]/g, '')
    );

    if (duplicate) {
      res.status(409).json({ error: `A profile already exists with phone: ${trimmedPhone}` });
      return;
    }

    await db.update(customers)
      .set({
        full_name: full_name.trim(),
        phone_number: trimmedPhone,
        birth_date: birth_date || null
      })
      .where(eq(customers.id, req.params.id));

    res.json({ success: true });
  } catch (err) {
    console.error('Error in PUT /api/customers/:id:', err);
    res.status(500).json({ error: 'Database query failed. Please try again later.' });
  }
});

// Register New Customer Profile
app.post('/api/customers', async (req, res) => {
  try {
    const { full_name, phone_number, birth_date, notes_preferences } = req.body;
    if (!full_name || !phone_number) {
      res.status(400).json({ error: 'Full Name and Phone Number are required' });
      return;
    }

    const trimmedPhone = phone_number.trim();
    const allClients = await db.select().from(customers);
    const duplicate = allClients.find(
      c => c.phone_number.replace(/[\s\-\(\)]/g, '') === trimmedPhone.replace(/[\s\-\(\)]/g, '')
    );

    if (duplicate) {
      res.status(409).json({ error: `A profile already exists with phone: ${trimmedPhone}` });
      return;
    }

    const newId = `c_${crypto.randomUUID()}`;
    const newCustomer = {
      id: newId,
      full_name: full_name.trim(),
      phone_number: trimmedPhone,
      birth_date: birth_date || null,
      created_at: new Date().toISOString(),
      notes_preferences: notes_preferences || null
    };

    await db.insert(customers).values(newCustomer);

    // Send Welcoming SMS using GeezSMS
    const welcomeMsg = `ውድ ${full_name.trim()}፣ ካልዳስ ውበት ሳሎን (Kaldas Beauty Salon) ስለተመዘገቡ እናመሰግናለን! Welcome to Kaldas Beauty Salon. We are thrilled to have you!`;
    sendGeezSMS(trimmedPhone, welcomeMsg).catch(err => {
      console.error('[GeezSMS] Welcome message sending failed:', err);
    });

    const allVisits = await db.select().from(visits);
    const withStatus = classifyCustomer(newCustomer, allVisits, new Date());
    res.status(201).json(withStatus);
  } catch (err) {
    console.error('Error in POST /api/customers:', err);
    res.status(500).json({ error: 'Database query failed. Please try again later.' });
  }
});

// Register New Visit Log / Check-In
app.post('/api/visits', async (req, res) => {
  try {
    const { customer_id, items_used, price_charged, payment_method, visit_date } = req.body;
    if (!customer_id || !items_used || !Array.isArray(items_used) || items_used.length === 0 || price_charged === undefined || !payment_method) {
      res.status(400).json({ error: 'Incomplete parameters mapped for check-in visit' });
      return;
    }

    const clients = await db.select().from(customers).where(eq(customers.id, customer_id));
    if (clients.length === 0) {
      res.status(404).json({ error: 'Associated customer profile not found' });
      return;
    }

    const newVisitId = `v_${crypto.randomUUID()}`;
    const newVisit = {
      id: newVisitId,
      customer_id,
      items_used,
      price_charged: Number(price_charged),
      payment_method,
      visit_date: visit_date || new Date().toISOString()
    };

    await db.insert(visits).values(newVisit);

    // Build list of service names for thank you SMS
    let serviceNamesText = '';
    try {
      const availableServices = await db.select().from(services);
      const matchedNames = items_used.map(itemId => {
        const found = availableServices.find(s => s.id === itemId);
        return found ? found.name : itemId;
      });
      serviceNamesText = matchedNames.join(', ');
    } catch (e) {
      console.error('[GeezSMS] Service names lookup failed:', e);
      serviceNamesText = items_used.join(', ');
    }

    // Send Thank You SMS with amount
    const thanksMsg = `ውድ ${clients[0].full_name}፣ ስለመጡልን እናመሰግናለን! Thank you for visiting Kaldas Beauty Salon. You paid a total of ${Number(price_charged)} Birr.`;
    sendGeezSMS(clients[0].phone_number, thanksMsg).catch(err => {
      console.error('[GeezSMS] Visit payment thank you message sending failed:', err);
    });

    // Fetch updated customer and classify
    const allVisits = await db.select().from(visits);
    const updatedCustomer = classifyCustomer(clients[0], allVisits, new Date());

    res.status(201).json({
      visit: newVisit,
      customer: updatedCustomer
    });
  } catch (err) {
    console.error('Error in POST /api/visits:', err);
    res.status(500).json({ error: 'Database query failed. Please try again later.' });
  }
});

// Analytics Dashboard calculation
app.get('/api/analytics', async (req, res) => {
  try {
    const allVisits = await db.select().from(visits);
    const clients = await db.select().from(customers);
    const availableServices = await db.select().from(services);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday.getTime() - startOfToday.getDay() * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let dailyIncome = 0;
    const dailyPaymentBreakdown: Record<string, number> = {};
    let weeklyIncome = 0;
    let monthlyIncome = 0;

    // Leaderboard tracking dynamically using databases
    const serviceLeaderboard: Record<string, { count: number; name: string; revenue: number }> = {};
    availableServices.forEach(s => {
      serviceLeaderboard[s.id] = { count: 0, name: s.name, revenue: 0 };
    });

    allVisits.forEach(v => {
      const vDate = new Date(v.visit_date);
      const price = Number(v.price_charged || 0);
      const items = (Array.isArray(v.items_used) ? v.items_used : []) as string[];

      items.forEach(itemId => {
        const def = availableServices.find(s => s.id === itemId);
        const name = def ? def.name : itemId;
        if (!serviceLeaderboard[itemId]) {
          serviceLeaderboard[itemId] = { count: 0, name, revenue: 0 };
        }
        serviceLeaderboard[itemId].count++;
        serviceLeaderboard[itemId].revenue += (def ? def.defaultPrice : price / (items.length || 1));
      });

      if (vDate >= startOfToday) {
        dailyIncome += price;
        dailyPaymentBreakdown[v.payment_method] = (dailyPaymentBreakdown[v.payment_method] || 0) + price;
      }
      if (vDate >= startOfWeek) {
        weeklyIncome += price;
      }
      if (vDate >= startOfMonth) {
        monthlyIncome += price;
      }
    });

    // Segment ratios
    const curTime = new Date();
    const classifieds = clients.map(c => classifyCustomer(c, allVisits, curTime));
    const distribution = {
      Frequent: 0,
      Occasional: 0,
      'At-Risk': 0
    };

    classifieds.forEach(c => {
      distribution[c.retentionStatus]++;
    });

    const sortedServices = Object.values(serviceLeaderboard)
      .sort((a, b) => b.count - a.count)
      .filter(s => s.count > 0);

    const fullLeaderboardList = sortedServices.length > 0
      ? sortedServices
      : availableServices.map(s => ({ count: 0, name: s.name, revenue: 0 }));

    res.json({
      revenue: {
        daily: dailyIncome,
        dailyBreakdown: dailyPaymentBreakdown,
        weekly: weeklyIncome,
        monthly: monthlyIncome
      },
      distribution,
      leaderboard: fullLeaderboardList.slice(0, 5)
    });
  } catch (err) {
    console.error('Error in GET /api/analytics:', err);
    res.status(500).json({ error: 'Database query failed. Please try again later.' });
  }
});

// Custom Range Analytics Endpoint
app.get('/api/analytics/custom-range', async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      res.status(400).json({ error: 'Parameters start and end specify custom range required' });
      return;
    }

    const allVisits = await db.select().from(visits);
    const startDate = new Date(start as string);
    const endDate = new Date(end as string);
    endDate.setHours(23, 59, 59, 999);

    let totalRevenue = 0;
    const breakDown: Record<string, number> = {};
    let transactionCount = 0;

    allVisits.forEach(v => {
      const vDate = new Date(v.visit_date);
      if (vDate >= startDate && vDate <= endDate) {
        totalRevenue += Number(v.price_charged);
        breakDown[v.payment_method] = (breakDown[v.payment_method] || 0) + Number(v.price_charged);
        transactionCount++;
      }
    });

    res.json({
      start,
      end,
      totalRevenue,
      transactionCount,
      breakDown
    });
  } catch (err) {
    console.error('Error in GET /api/analytics/custom-range:', err);
    res.status(500).json({ error: 'Database query failed. Please try again later.' });
  }
});

// Advanced telemetry profiles export in CSV/JSON
app.get('/api/export', async (req, res) => {
  try {
    const { status, format } = req.query;
    if (!status) {
      res.status(400).send('Status parameter is required (status=Frequent|Occasional|At-Risk)');
      return;
    }

    const clients = await db.select().from(customers);
    const allVisits = await db.select().from(visits);
    const curTime = new Date();

    let targetStatus: RetentionStatus = 'At-Risk';
    if (status === 'Green' || status === 'Frequent') targetStatus = 'Frequent';
    else if (status === 'Yellow' || status === 'Occasional') targetStatus = 'Occasional';
    else if (status === 'Red' || status === 'At-Risk') targetStatus = 'At-Risk';

    const classifieds = clients.map(c => classifyCustomer(c, allVisits, curTime));
    const filtered = classifieds.filter(c => c.retentionStatus === targetStatus);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=salon_export_${targetStatus.toLowerCase()}.json`);
      res.send(JSON.stringify(filtered, null, 2));
      return;
    }

    let csv = 'ID,Full Name,Phone Number,Birth Date,Created At,Last Visit,Visits Last 30 Days,Status,Notes\n';
    filtered.forEach(c => {
      const row = [
        c.id,
        `"${c.full_name.replace(/"/g, '""')}"`,
        `"${c.phone_number}"`,
        c.birth_date || 'N/A',
        c.created_at,
        c.lastVisitDate || 'Never',
        c.visitCountInLast30Days,
        c.retentionStatus,
        `"${(c.notes_preferences || '').replace(/"/g, '""')}"`
      ];
      csv += row.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=salon_clients_${targetStatus.toLowerCase()}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Error in GET /api/export:', err);
    res.status(500).send('Database query failed. Please try again later.');
  }
});

// --- SMS DISPATCH GATEWAY ---
let isSmsGloballyEnabled = true;

app.get('/api/settings/sms-status', (req, res) => {
  res.json({ enabled: isSmsGloballyEnabled });
});

app.post('/api/settings/sms-status', (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled === 'boolean') {
    isSmsGloballyEnabled = enabled;
    res.json({ success: true, enabled: isSmsGloballyEnabled });
  } else {
    res.status(400).json({ error: 'Invalid status parameter' });
  }
});

app.post('/api/sms/send', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      res.status(400).json({ error: 'Phone and message are required' });
      return;
    }
    
    if (!isSmsGloballyEnabled) {
      console.log(`[GeezSMS] SMS dispatch bypassed for ${phone} because SMS sending is disabled in settings.`);
      res.json({ success: true, bypassed: true, message: 'SMS sending is globally disabled' });
      return;
    }

    const result = await sendGeezSMS(phone, message);
    if (result && (result.error === true || result.error === 'true')) {
      res.status(400).json({ error: result.msg || 'GeezSMS API rejected the request' });
      return;
    }
    res.json({ success: true, result });
  } catch (err) {
    console.error('Error in POST /api/sms/send:', err);
    res.status(500).json({ error: 'Failed to dispatch SMS' });
  }
});

// --- AUTOMATED QUEUE SMS TRIGGER ENDPOINT ---
app.post('/api/queue/notify', async (req, res) => {
  try {
    const { phone, customer_name, event_type, position, ahead, wait_time, custom_message, lang } = req.body;
    if (!phone) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    let finalMessage = custom_message || '';
    const name = customer_name || 'Valued Customer';
    const isAmharic = lang === 'am';

    if (!finalMessage) {
      if (event_type === 'welcome') {
        finalMessage = isAmharic
          ? `ውድ ${name}፣ እንኳን ወደ Konjo Salon በደህና መጡ! መስመር ላይ #${position || 1} ላይ ሲሆኑ ${ahead || 0} ሰዎች ከእርስዎ ፊት አሉ። የተገመተው ጊዜ: ~${wait_time || 15} ደቂቃ። ተራዎት ሲደርስ በSMS እናሳውቅዎታለን!`
          : `Hi ${name}, welcome to Konjo Salon! You are currently #${position || 1} in line with ${ahead || 0} customer(s) ahead of you. Estimated wait: ~${wait_time || 15} mins. We will text you when your turn is near!`;
      } else if (event_type === 'progress') {
        finalMessage = isAmharic
          ? `ውድ ${name}፣ ከKonjo Salon ማሳወቂያ፡ ከእርስዎ ፊት የቀሩት ደንበኞች ብዛት ${ahead || 0} ብቻ ነው!`
          : `Hi ${name}, update from Konjo Salon: There are now ${ahead || 0} customer(s) left ahead of you!`;
      } else if (event_type === 'ready') {
        finalMessage = isAmharic
          ? `ውድ ${name}! በKonjo Salon ተራዎት ስለደረሰ እባክዎን ወደ አገልግሎት ቦታው ይምጡ። አሁኑኑ እንቀበልዎታለን!`
          : `Hi ${name}! We are ready for you at Konjo Salon. Please proceed to the station. See you in a moment!`;
      } else {
        finalMessage = `Hi ${name}, update from Konjo Salon regarding your queue position.`;
      }
    }

    if (!isSmsGloballyEnabled) {
      console.log(`[GeezSMS Queue] SMS dispatch bypassed for ${phone} because SMS sending is disabled in settings.`);
      res.json({ success: true, bypassed: true, message: 'SMS sending is globally disabled', formattedMessage: finalMessage });
      return;
    }

    const result = await sendGeezSMS(phone, finalMessage);
    if (result && (result.error === true || result.error === 'true')) {
      res.status(400).json({ error: result.msg || 'GeezSMS API rejected queue alert' });
      return;
    }
    res.json({ success: true, result, formattedMessage: finalMessage });
  } catch (err) {
    console.error('Error in POST /api/queue/notify:', err);
    res.status(500).json({ error: 'Failed to dispatch queue notification SMS' });
  }
});

app.get('/api/sms/logs', (req, res) => {
  res.json(smsLogs);
});

app.post('/api/sms/logs/clear', (req, res) => {
  smsLogs = [];
  try {
    fs.writeFileSync(LOG_FILE, JSON.stringify(smsLogs, null, 2));
  } catch (e) {
    console.error('[SMS Logs] Failed to clear SMS logs cache file:', e);
  }
  res.json({ success: true });
});

// --- SERVICES & TREATMENTS CRUD API ENDPOINTS ---
app.get('/api/services', async (req, res) => {
  try {
    const availableServices = await db.select().from(services);
    res.json(availableServices);
  } catch (err) {
    console.error('Error in GET /api/services:', err);
    res.status(500).json({ error: 'Database query failed. Please try again later.' });
  }
});

app.post('/api/services', async (req, res) => {
  try {
    const { name, category, defaultPrice } = req.body;
    if (!name || !category || defaultPrice === undefined) {
      res.status(400).json({ error: 'Name, Category, and Default Price are required' });
      return;
    }

    const newId = `srv_${crypto.randomUUID().substring(0, 8)}`;
    const newService = {
      id: newId,
      name: name.trim(),
      category: category,
      defaultPrice: Number(defaultPrice)
    };

    await db.insert(services).values(newService);
    res.status(201).json(newService);
  } catch (err) {
    console.error('Error in POST /api/services:', err);
    res.status(500).json({ error: 'Database command failed. Please try again later.' });
  }
});

app.put('/api/services/:id', async (req, res) => {
  try {
    const { name, category, defaultPrice } = req.body;
    if (!name || !category || defaultPrice === undefined) {
      res.status(400).json({ error: 'Name, Category, and Default Price are required' });
      return;
    }

    await db.update(services)
      .set({
        name: name.trim(),
        category,
        defaultPrice: Number(defaultPrice)
      })
      .where(eq(services.id, req.params.id));

    res.json({ success: true });
  } catch (err) {
    console.error('Error in PUT /api/services/:id:', err);
    res.status(500).json({ error: 'Database command failed. Please try again later.' });
  }
});

app.delete('/api/services/:id', async (req, res) => {
  try {
    await db.delete(services).where(eq(services.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error('Error in DELETE /api/services/:id:', err);
    res.status(500).json({ error: 'Database command failed. Please try again later.' });
  }
});

// --- STAFF CRUD ENDPOINTS ---
app.get('/api/staff', async (req, res) => {
  try {
    const staffList = await db.select().from(staff);
    // map password clean for lists
    res.json(staffList);
  } catch (err) {
    console.error('Error in GET /api/staff:', err);
    res.status(500).json({ error: 'Database query failed. Please try again later.' });
  }
});

app.post('/api/staff', async (req, res) => {
  try {
    const { name, role, password } = req.body;
    if (!name || (role !== 'cashier' && role !== 'assistant') || !password) {
      res.status(400).json({ error: 'Name, role (cashier/assistant), and password are required' });
      return;
    }

    const newStaffId = `s_${crypto.randomUUID()}`;
    const newStaff = {
      id: newStaffId,
      name: name.trim(),
      role,
      password: password,
      created_at: new Date().toISOString()
    };

    await db.insert(staff).values(newStaff);
    res.status(201).json(newStaff);
  } catch (err) {
    console.error('Error in POST /api/staff:', err);
    res.status(500).json({ error: 'Database command failed. Please try again later.' });
  }
});

app.delete('/api/staff/:id', async (req, res) => {
  try {
    await db.delete(staff).where(eq(staff.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error('Error in DELETE /api/staff/:id:', err);
    res.status(500).json({ error: 'Database command failed. Please try again later.' });
  }
});

// --- COMBINED VITE DEV & PROD LAYERS ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Beauty Salon CRM Server] Running robustly on http://0.0.0.0:${PORT}`);
  });
}

startServer();
