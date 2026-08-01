import { pgTable, text, doublePrecision, timestamp, jsonb } from 'drizzle-orm/pg-core';

// 1. Services / Treatments
export const services = pgTable('services', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(), // 'Hair' | 'Nails' | 'Skin' | 'Massage' | 'Product'
  defaultPrice: doublePrecision('default_price').notNull(),
});

// 2. Customers
export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  full_name: text('full_name').notNull(),
  phone_number: text('phone_number').notNull().unique(),
  birth_date: text('birth_date'), // Format: YYYY-MM-DD
  created_at: text('created_at').notNull(), // ISO string format matching original
  notes_preferences: text('notes_preferences'),
});

// 3. Visits
export const visits = pgTable('visits', {
  id: text('id').primaryKey(),
  customer_id: text('customer_id')
    .references(() => customers.id, { onDelete: 'cascade' })
    .notNull(),
  items_used: jsonb('items_used').notNull(), // Array of service IDs used
  price_charged: doublePrecision('price_charged').notNull(),
  payment_method: text('payment_method').notNull(),
  visit_date: text('visit_date').notNull(), // ISO string format matching original
});

// 4. Staff members
export const staff = pgTable('staff', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(), // 'cashier' | 'assistant'
  password: text('password').notNull(), // To satisfy requirements for staff login
  created_at: text('created_at').notNull(),
});
