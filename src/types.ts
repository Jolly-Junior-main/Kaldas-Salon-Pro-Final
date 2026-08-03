/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Language = 'en' | 'am';

// Payment Method enum as specified strictly in instructions
export type PaymentMethod = 'Telebirr' | 'CBE Birr' | 'M-Pesa' | 'Bank Transfer' | 'Cash' | 'Card';

// Predefined list of typical premium salon services & products
export interface SalonService {
  id: string;
  name: string;
  category: 'Hair' | 'Nails' | 'Skin' | 'Massage' | 'Product';
  defaultPrice: number;
}

export interface Customer {
  id: string;
  full_name: string;
  phone_number: string;
  birth_date?: string; // Format: YYYY-MM-DD
  created_at: string; // ISO string
  notes_preferences?: string; // Hair/skin type, allergies, styling notes
}

export interface Visit {
  id: string;
  customer_id: string;
  items_used: string[]; // List of SalonService IDs
  price_charged: number;
  payment_method: PaymentMethod;
  visit_date: string; // ISO string
  assigned_staff_id?: string; // ID of the staff who performed the service
  equipment_used?: string; // What equipment was used for the customer
}

// Retention statuses for client segment telemetry
export type RetentionStatus = 'Frequent' | 'Occasional' | 'At-Risk';

export interface CustomerWithRetention extends Customer {
  retentionStatus: RetentionStatus;
  lastVisitDate?: string;
  visitCountInLast30Days: number;
}

export type UserRole = 'admin' | 'cashier' | 'inventory' | 'walkin' | 'assistant';

export interface StaffMember {
  id: string;
  name: string;
  role: UserRole;
  created_at: string;
  password?: string;
}

export interface TreatmentArtist {
  id: string;
  name: string;
  skills: string; // e.g., "Hair Coloring, Balayage, Cuts"
  specialty: 'Hair' | 'Nails' | 'Skin' | 'Massage' | 'General';
  created_at: string;
}

export interface CRMData {
  customers: Customer[];
  visits: Visit[];
  staff?: StaffMember[];
}

export interface SmsTemplates {
  welcome_am: string;
  welcome_en: string;
  billing_am: string;
  billing_en: string;
}

export const DEFAULT_SMS_TEMPLATES: SmsTemplates = {
  welcome_am: "ውድ {name}፣ ካልዳስ ውበት ሳሎን (Kaldas Beauty Salon) ስለተመዘገቡ እናመሰግናለን! ቴክኖሎጂውን በመጠቀም የተሻለ አገልግሎት ለማቅረብ እንተጋለን።",
  welcome_en: "Dear {name}, thank you for registering with Kaldas Beauty Salon! We are thrilled to have you as our valued client.",
  billing_am: "ውድ {name}፣ ስለመጡልን እናመሰግናለን! የከፈሉት ጠቅላላ ድምር {amount} ብር ነው። ካልዳስ ውበት ሳሎን!",
  billing_en: "Dear {name}, thank you for visiting Kaldas Beauty Salon! You have successfully paid a total of {amount} Birr. We hope to see you again soon!"
};

export function formatSmsTemplate(template: string, placeholders: { name?: string; amount?: string | number }) {
  let text = template || '';
  if (placeholders.name !== undefined) {
    text = text.replace(/{name}/g, placeholders.name);
  }
  if (placeholders.amount !== undefined) {
    text = text.replace(/{amount}/g, String(placeholders.amount));
  }
  return text;
}

export interface BirthdayWish {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  message_text: string;
  offer_type: 'none' | '50_percent' | 'free';
  sent_at: string;
  sent_by: string;
  status: 'pending_api' | 'sent_mock';
}

// --- QUEUE MANAGEMENT MODULE TYPES & SMS TEMPLATES ---
export type QueueStatus = 'waiting' | 'in_service' | 'notified' | 'completed' | 'cancelled';

export interface QueueEntry {
  id: string;
  customer_id?: string;
  customer_name: string;
  phone_number: string;
  position: number;
  service_name?: string;
  est_wait_minutes: number;
  status: QueueStatus;
  joined_at: string; // ISO String
  notified_at?: string;
  called_at?: string;
  completed_at?: string;
  assigned_staff_name?: string;
  notes?: string;
}

export interface QueueSmsTemplates {
  queue_entry_am: string;
  queue_entry_en: string;
  queue_progress_am: string;
  queue_progress_en: string;
  queue_ready_am: string;
  queue_ready_en: string;
}

export const DEFAULT_QUEUE_SMS_TEMPLATES: QueueSmsTemplates = {
  queue_entry_am: "ውድ {Customer_Name}፣ እንኳን ወደ Konjo Salon በደህና መጡ! መስመር ላይ #{Position_Number} ላይ ሲሆኑ {Customers_Ahead} ሰዎች ከእርስዎ ፊት አሉ። የተገመተው ጊዜ: ~{Wait_Time} ደቂቃ። ተራዎት ሲደርስ በSMS እናሳውቅዎታለን!",
  queue_entry_en: "Hi {Customer_Name}, welcome to Konjo Salon! You are currently #{Position_Number} in line with {Customers_Ahead} customer(s) ahead of you. Estimated wait: ~{Wait_Time} mins. We will text you when your turn is near!",
  queue_progress_am: "ውድ {Customer_Name}፣ ከKonjo Salon ማሳወቂያ፡ ከእርስዎ ፊት የቀሩት ደንበኞች ብዛት {Customers_Ahead} ብቻ ነው!",
  queue_progress_en: "Hi {Customer_Name}, update from Konjo Salon: There are now {Customers_Ahead} customer(s) left ahead of you!",
  queue_ready_am: "ውድ {Customer_Name}! በKonjo Salon ተራዎት ስለደረሰ እባክዎን ወደ አገልግሎት ቦታው ይምጡ። አሁኑኑ እንቀበልዎታለን!",
  queue_ready_en: "Hi {Customer_Name}! We are ready for you at Konjo Salon. Please proceed to the station. See you in a moment!"
};

export function formatQueueSms(
  template: string, 
  data: { customer_name: string; position_number?: number; customers_ahead?: number; wait_time?: number }
) {
  let msg = template || '';
  const name = data.customer_name || 'Valued Customer';
  msg = msg.replace(/{Customer_Name}/g, name).replace(/{name}/g, name);
  
  if (data.position_number !== undefined) {
    msg = msg.replace(/{Position_Number}/g, String(data.position_number)).replace(/{position}/g, String(data.position_number));
  }
  if (data.customers_ahead !== undefined) {
    msg = msg.replace(/{Customers_Ahead}/g, String(data.customers_ahead)).replace(/{ahead}/g, String(data.customers_ahead));
  }
  if (data.wait_time !== undefined) {
    msg = msg.replace(/{Wait_Time}/g, String(data.wait_time)).replace(/{wait_time}/g, String(data.wait_time));
  }
  return msg;
}

export const PREDEFINED_SERVICES: SalonService[] = [
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

// --- SMART PRODUCT INVENTORY MODULE TYPES ---
export type ProductCategoryType = 'single_use' | 'multiple_use';

export interface InventoryProduct {
  id: string;
  name: string;
  category_type: ProductCategoryType; // 'single_use' (Consumables) | 'multiple_use' (Bottles/Tubes/Jars)
  category_label?: 'Hair' | 'Nails' | 'Skin' | 'Massage' | 'General';
  stock_quantity: number;
  unit_name: string; // e.g., "bottles", "packets", "tubes", "capes"
  low_stock_threshold: number; // e.g. 5
  min_clients_per_unit: number; // For multi-use: e.g. 5 clients per bottle. Defaults to 1 for single-use
  price_per_unit?: number;
  created_at: string;
}

export type CheckoutStatus = 'active' | 'completed' | 'returned' | 'flagged';

export interface ActiveProductCheckout {
  id: string;
  product_id: string;
  product_name: string;
  stylist_id: string;
  stylist_name: string;
  clients_serviced_count: number;
  target_min_clients: number;
  status: CheckoutStatus;
  checked_out_at: string; // ISO date
  completed_at?: string;
  notes?: string;
}

export interface InventoryLog {
  id: string;
  product_id: string;
  product_name: string;
  action: 'checkout_single' | 'checkout_multi' | 'service_usage_increment' | 'completed_bottle' | 'restock' | 'flagged_attempt';
  stylist_name?: string;
  quantity_changed: number;
  details: string;
  timestamp: string;
}

export const PREDEFINED_INVENTORY_PRODUCTS: InventoryProduct[] = [
  {
    id: 'inv_1',
    name: '1L Professional Moisture Shampoo',
    category_type: 'multiple_use',
    category_label: 'Hair',
    stock_quantity: 8,
    unit_name: 'bottles',
    low_stock_threshold: 3,
    min_clients_per_unit: 5,
    price_per_unit: 45.00,
    created_at: new Date().toISOString()
  },
  {
    id: 'inv_2',
    name: 'Keratin Deep Treatment Cream (500g Jar)',
    category_type: 'multiple_use',
    category_label: 'Hair',
    stock_quantity: 6,
    unit_name: 'tubs',
    low_stock_threshold: 2,
    min_clients_per_unit: 6,
    price_per_unit: 60.00,
    created_at: new Date().toISOString()
  },
  {
    id: 'inv_3',
    name: 'Premium Blonde Hair Dye Packets',
    category_type: 'single_use',
    category_label: 'Hair',
    stock_quantity: 4,
    unit_name: 'packets',
    low_stock_threshold: 10,
    min_clients_per_unit: 1,
    price_per_unit: 12.50,
    created_at: new Date().toISOString()
  },
  {
    id: 'inv_4',
    name: 'Hydrafacial Collagen Sheet Masks',
    category_type: 'single_use',
    category_label: 'Skin',
    stock_quantity: 18,
    unit_name: 'sheets',
    low_stock_threshold: 5,
    min_clients_per_unit: 1,
    price_per_unit: 8.00,
    created_at: new Date().toISOString()
  },
  {
    id: 'inv_5',
    name: 'Disposable Salon Styling Capes',
    category_type: 'single_use',
    category_label: 'General',
    stock_quantity: 50,
    unit_name: 'capes',
    low_stock_threshold: 15,
    min_clients_per_unit: 1,
    price_per_unit: 1.50,
    created_at: new Date().toISOString()
  },
  {
    id: 'inv_6',
    name: 'Developer Lotion 20 Vol (1L Bottle)',
    category_type: 'multiple_use',
    category_label: 'Hair',
    stock_quantity: 2,
    unit_name: 'bottles',
    low_stock_threshold: 3,
    min_clients_per_unit: 8,
    price_per_unit: 25.00,
    created_at: new Date().toISOString()
  }
];

