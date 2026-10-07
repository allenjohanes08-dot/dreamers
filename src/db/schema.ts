import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, decimal, boolean, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  role: text('role').notNull().default('CUSTOMER'), // CUSTOMER, SELLER, ADMIN, LOGISTICS (Verified Active Role)
  requestedRole: text('requested_role').default('CUSTOMER'), // CUSTOMER, SELLER, LOGISTICS
  language: text('language').notNull().default('en'), // en, sw
  verificationStatus: text('verification_status').notNull().default('PENDING'), // PENDING, VERIFIED, REJECTED, SUSPENDED
  welcomeBonusUsed: boolean('welcome_bonus_used').notNull().default(false),
  welcomeBonusAmount: integer('welcome_bonus_amount').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const customerProfiles = pgTable('customer_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull().unique(),
  deliveryAddress: text('delivery_address'),
  deliveryLatitude: decimal('delivery_latitude', { precision: 10, scale: 8 }),
  deliveryLongitude: decimal('delivery_longitude', { precision: 11, scale: 8 }),
  paymentMethod: text('payment_method'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const sellerProfiles = pgTable('seller_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull().unique(),
  businessName: text('business_name').notNull(),
  businessDescription: text('business_description'),
  verificationReason: text('verification_reason'),
  verificationFeePaid: boolean('verification_fee_paid').default(false),
  verificationFeePaymentId: text('verification_fee_payment_id'),
  lipaNumber: text('lipa_number'),
  lipaAccountName: text('lipa_account_name'),
  lipaVerificationStatus: text('lipa_verification_status').default('UNVERIFIED'), // UNVERIFIED, PENDING, VERIFIED, REJECTED
  subscriptionStatus: text('subscription_status').default('PENDING'), // ACTIVE, PAST_DUE, EXPIRED, PENDING
  subscriptionExpiresAt: timestamp('subscription_expires_at'),
});

export const logisticsProfiles = pgTable('logistics_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull().unique(),
  vehicleType: text('vehicle_type'), // BICYCLE, MOTORCYCLE, VAN, TRUCK
  licensePlate: text('license_plate'),
  currentLatitude: decimal('current_latitude', { precision: 10, scale: 8 }),
  currentLongitude: decimal('current_longitude', { precision: 11, scale: 8 }),
  isOnline: boolean('is_active').notNull().default(false),
});

export const shops = pgTable('shops', {
  id: serial('id').primaryKey(),
  sellerId: integer('seller_id').references(() => sellerProfiles.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  latitude: decimal('latitude', { precision: 10, scale: 8 }).notNull(),
  longitude: decimal('longitude', { precision: 11, scale: 8 }).notNull(),
  address: text('address').notNull(),
  logoUrl: text('logo_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  sellerIdIdx: index('shops_seller_id_idx').on(table.sellerId),
}));

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  icon: text('icon'),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  shopId: integer('shop_id').references(() => shops.id).notNull(),
  categoryId: integer('category_id').references(() => categories.id).notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(), // TZS
  stock: integer('stock').notNull().default(0),
  images: text('images').array().notNull(),
  specifications: text('specifications'),
  material: text('material'),
  size: text('size'),
  color: text('color'),
  weight: text('weight'),
  tags: text('tags').array(),
  status: text('status').notNull().default('PENDING_REVIEW'), // PENDING_REVIEW, APPROVED, REJECTED, SUSPENDED, ARCHIVED
  rejectionReason: text('rejection_reason'),
  videoUrl: text('video_url'),
  videoStoragePath: text('video_storage_path'),
  videoFileName: text('video_file_name'),
  videoFileType: text('video_file_type'),
  videoFileSize: integer('video_file_size'),
  videoUploadStatus: text('video_upload_status').default('COMPLETED'), // PREPARING, UPLOADING, PROCESSING, COMPLETED, FAILED, CANCELLED
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  shopIdIdx: index('products_shop_id_idx').on(table.shopId),
  categoryIdIdx: index('products_category_id_idx').on(table.categoryId),
  statusIdx: index('products_status_idx').on(table.status),
}));

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderCode: text('order_code'), // DRM-ORD-YYYYMMDD-XXXX
  customerId: integer('customer_id').references(() => users.id).notNull(),
  status: text('status').notNull().default('PENDING'), // PENDING, PAID, READY_FOR_DELIVERY, OUT_FOR_DELIVERY, DELIVERED, CANCELLED
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  productAmount: integer('product_amount').default(0), // TZS integer
  logisticsAmount: integer('logistics_amount').default(0), // TZS integer
  paidAmount: integer('paid_amount').default(0), // TZS integer
  remainingAmount: integer('remaining_amount').default(0), // TZS integer
  paymentType: text('payment_type').default('FULL'), // FULL, PARTIAL_50
  financialStatus: text('financial_status').default('UNPAID'), // UNPAID, PARTIALLY_PAID, FULLY_PAID, REFUNDED
  welcomeBonusApplied: boolean('welcome_bonus_applied').default(false),
  deliveryAddress: text('delivery_address').notNull(),
  deliveryLatitude: decimal('delivery_latitude', { precision: 10, scale: 8 }),
  deliveryLongitude: decimal('delivery_longitude', { precision: 11, scale: 8 }),
  logisticsFeeConfirmed: boolean('logistics_fee_confirmed').default(false),
  logisticsDistanceKm: decimal('logistics_distance_km', { precision: 8, scale: 2 }),
  logisticsBaseFee: integer('logistics_base_fee').default(3000),
  logisticsDistanceFee: integer('logistics_distance_fee').default(0),
  logisticsServiceFee: integer('logistics_service_fee').default(0),
  paymentMethod: text('payment_method'),
  paymentId: text('payment_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  customerIdIdx: index('orders_customer_id_idx').on(table.customerId),
  statusIdx: index('orders_status_idx').on(table.status),
}));

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
});

export const deliveryAssignments = pgTable('delivery_assignments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id).notNull().unique(),
  logisticsId: integer('logistics_id').references(() => logisticsProfiles.id).notNull(),
  status: text('status').notNull().default('ASSIGNED'), // ASSIGNED, PICKED_UP, DELIVERED, RETURNED
  recipientName: text('recipient_name'),
  notes: text('notes'),
  assignedAt: timestamp('assigned_at').defaultNow(),
  pickedUpAt: timestamp('picked_up_at'),
  deliveredAt: timestamp('delivered_at'),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const roleRequests = pgTable('role_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  requestedRole: text('requested_role').notNull(), // SELLER or LOGISTICS
  reason: text('reason'),
  status: text('status').notNull().default('PENDING'), // PENDING, APPROVED, REJECTED
  adminResponse: text('admin_response'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('role_requests_user_id_idx').on(table.userId),
}));

export const giftCardRequests = pgTable('gift_card_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  userEmail: text('user_email').notNull(),
  userName: text('user_name').notNull(),
  code: text('code').notNull().unique(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  recipientEmail: text('recipient_email'),
  recipientName: text('recipient_name'),
  personalMessage: text('personal_message'),
  status: text('status').notNull().default('PENDING'), // PENDING, APPROVED, REJECTED, COMPLETED
  adminNote: text('admin_note'),
  adminId: integer('admin_id').references(() => users.id),
  actionTimestamp: timestamp('action_timestamp'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('gift_card_requests_user_id_idx').on(table.userId),
  statusIdx: index('gift_card_requests_status_idx').on(table.status),
}));

export const registryRequests = pgTable('registry_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  userEmail: text('user_email').notNull(),
  userName: text('user_name').notNull(),
  title: text('title').notNull(),
  category: text('category').default('WEDDING'),
  eventDate: text('event_date'),
  deliveryAddress: text('delivery_address'),
  deliveryLatitude: decimal('delivery_latitude', { precision: 10, scale: 8 }),
  deliveryLongitude: decimal('delivery_longitude', { precision: 11, scale: 8 }),
  description: text('description'),
  targetAmount: decimal('target_amount', { precision: 12, scale: 2 }).default('0'),
  status: text('status').notNull().default('PENDING'), // PENDING, APPROVED, REJECTED, COMPLETED
  adminNote: text('admin_note'),
  adminId: integer('admin_id').references(() => users.id),
  actionTimestamp: timestamp('action_timestamp'),
  startTime: text('start_time'),
  endTime: text('end_time'),
  eventInstructions: text('event_instructions'),
  venueName: text('venue_name'),
  isFinished: boolean('is_finished').default(false),
  finishedAt: timestamp('finished_at'),
  expectedGuests: integer('expected_guests').default(0),
  guestQuotaPurchased: integer('guest_quota_purchased').default(0),
  guestQuotaUsed: integer('guest_quota_used').default(0),
  guestQuotaRemaining: integer('guest_quota_remaining').default(0),
  invitationFeePerGuest: integer('invitation_fee_per_guest').default(500),
  totalPaidInvitationAmount: integer('total_paid_invitation_amount').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('registry_requests_user_id_idx').on(table.userId),
  statusIdx: index('registry_requests_status_idx').on(table.status),
}));

export const eventInvitations = pgTable('event_invitations', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').references(() => registryRequests.id).notNull(),
  inviterId: integer('inviter_id').references(() => users.id).notNull(),
  invitedUserId: integer('invited_user_id').references(() => users.id),
  invitedUserName: text('invited_user_name'),
  invitedUserEmail: text('invited_user_email'),
  invitationCode: text('invitation_code').notNull().unique(),
  verificationToken: text('verification_token').notNull().unique(),
  status: text('status').notNull().default('PENDING'), // PENDING, ACCEPTED, DECLINED, REVOKED
  arrivalStatus: text('arrival_status').notNull().default('PENDING'), // PENDING, ARRIVED
  arrivedAt: timestamp('arrived_at'),
  verifiedBy: integer('verified_by').references(() => users.id),
  verificationMethod: text('verification_method'), // QR, MANUAL
  customNote: text('custom_note'),
  isWhatsAppGuest: boolean('is_whatsapp_guest').default(false),
  guestPhone: text('guest_phone'),
  claimStatus: text('claim_status').default('UNCLAIMED'), // UNCLAIMED, CLAIMED
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  eventIdIdx: index('event_invitations_event_id_idx').on(table.eventId),
  invitedUserIdIdx: index('event_invitations_invited_user_id_idx').on(table.invitedUserId),
  inviterIdIdx: index('event_invitations_inviter_id_idx').on(table.inviterId),
  codeIdx: index('event_invitations_code_idx').on(table.invitationCode),
}));

export const eventVerificationLogs = pgTable('event_verification_logs', {
  id: serial('id').primaryKey(),
  invitationId: integer('invitation_id').references(() => eventInvitations.id).notNull(),
  eventId: integer('event_id').references(() => registryRequests.id).notNull(),
  invitedUserId: integer('invited_user_id').references(() => users.id),
  verifierId: integer('verifier_id').references(() => users.id).notNull(),
  verificationMethod: text('verification_method').notNull(), // QR, MANUAL
  previousArrivalStatus: text('previous_arrival_status'),
  newArrivalStatus: text('new_arrival_status').notNull(),
  verificationResult: text('verification_result').notNull(), // SUCCESS, FAILED
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  eventIdIdx: index('event_verification_logs_event_id_idx').on(table.eventId),
  invitationIdIdx: index('event_verification_logs_invitation_id_idx').on(table.invitationId),
}));

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  customerProfile: one(customerProfiles),
  sellerProfile: one(sellerProfiles),
  logisticsProfile: one(logisticsProfiles),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(users, { fields: [orders.customerId], references: [users.id] }),
  items: many(orderItems),
  deliveryAssignment: one(deliveryAssignments),
}));

export const deliveryAssignmentsRelations = relations(deliveryAssignments, ({ one }) => ({
  order: one(orders, { fields: [deliveryAssignments.orderId], references: [orders.id] }),
  logistics: one(logisticsProfiles, { fields: [deliveryAssignments.logisticsId], references: [logisticsProfiles.id] }),
}));

// Payment Methods Configuration (Tanzania Channels)
export const paymentMethodsConfig = pgTable('payment_methods_config', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // NMB, MPESA, AIRTEL, TIGO, HALOPESA
  name: text('name').notNull(),
  type: text('type').notNull(), // BANK, MOBILE_MONEY
  accountNumber: text('account_number').notNull(),
  accountName: text('account_name').notNull(),
  ussdCode: text('ussd_code'), // e.g. *150*00#
  instructionsEn: text('instructions_en').notNull(),
  instructionsSw: text('instructions_sw').notNull(),
  isEnabled: boolean('is_enabled').default(true).notNull(),
  sortOrder: integer('sort_order').default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Centralized Payments Engine Table
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  transactionId: text('transaction_id').notNull().unique(), // DRM-PAY-YYYYMMDD-XXXX
  userId: integer('user_id').references(() => users.id).notNull(),
  purpose: text('purpose').notNull(), // EVENT_INVITATION, SELLER_VERIFICATION, SELLER_SUBSCRIPTION, ORDER_INITIAL, ORDER_BALANCE, ORDER_FULL, OTHER
  relatedEntityType: text('related_entity_type'), // EVENT, ORDER, SELLER_PROFILE, SELLER_SUBSCRIPTION
  relatedEntityId: text('related_entity_id'),
  amountExpected: integer('amount_expected').notNull(), // Integer TZS
  amountSubmitted: integer('amount_submitted').default(0), // Integer TZS
  amountVerified: integer('amount_verified').default(0), // Integer TZS
  balanceDue: integer('balance_due').default(0), // Integer TZS
  currency: text('currency').notNull().default('TZS'),
  paymentMethod: text('payment_method').notNull(), // NMB, M-PESA, AIRTEL_MONEY, TIGO_PESA, HALOPESA
  senderName: text('sender_name'),
  senderPhone: text('sender_phone'),
  referenceNumber: text('reference_number'), // e.g. bank slip or M-Pesa ref
  paymentDate: timestamp('payment_date'),
  evidenceUrl: text('evidence_url'),
  notes: text('notes'),
  status: text('status').notNull().default('PENDING'), // PENDING, SUBMITTED, UNDER_REVIEW, VERIFIED, REJECTED, EXPIRED, CANCELLED, REFUNDED
  isUnderpayment: boolean('is_underpayment').default(false),
  isOverpayment: boolean('is_overpayment').default(false),
  underpaymentAmount: integer('underpayment_amount').default(0),
  overpaymentAmount: integer('overpayment_amount').default(0),
  isDuplicate: boolean('is_duplicate').default(false),
  verifiedBy: integer('verified_by').references(() => users.id),
  verifiedAt: timestamp('verified_at'),
  rejectionReason: text('rejection_reason'),
  adminNotes: text('admin_notes'),
  idempotencyKey: text('idempotency_key'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('payments_user_id_idx').on(table.userId),
  transactionIdIdx: index('payments_transaction_id_idx').on(table.transactionId),
  referenceNumberIdx: index('payments_reference_number_idx').on(table.referenceNumber),
  statusIdx: index('payments_status_idx').on(table.status),
  purposeIdx: index('payments_purpose_idx').on(table.purpose),
}));

// Immutable Money Ledger Table
export const moneyLedger = pgTable('money_ledger', {
  id: serial('id').primaryKey(),
  ledgerCode: text('ledger_code').notNull().unique(), // DRM-LED-YYYYMMDD-XXXX
  paymentId: integer('payment_id').references(() => payments.id),
  transactionId: text('transaction_id').notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(), // EVENT_INVITATION_FEE, SELLER_VERIFICATION, SELLER_SUBSCRIPTION, PRODUCT_PAYMENT, LOGISTICS_FEE, WELCOME_BONUS, REFUND, ADJUSTMENT, OTHER
  amount: integer('amount').notNull(), // Integer TZS
  currency: text('currency').notNull().default('TZS'),
  direction: text('direction').notNull(), // CREDIT, DEBIT
  source: text('source').notNull(), // CUSTOMER, SELLER, PLATFORM, SYSTEM
  destination: text('destination').notNull(), // PLATFORM_NMB, SELLER_LIPA, CUSTOMER_WALLET, LOGISTICS_AGENT
  status: text('status').notNull().default('COMPLETED'), // COMPLETED, PENDING, REVERSED
  relatedEntityType: text('related_entity_type'),
  relatedEntityId: text('related_entity_id'),
  createdBy: integer('created_by').references(() => users.id),
  verifiedBy: integer('verified_by').references(() => users.id),
  metadata: text('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('money_ledger_user_id_idx').on(table.userId),
  transactionIdIdx: index('money_ledger_transaction_id_idx').on(table.transactionId),
  typeIdx: index('money_ledger_type_idx').on(table.type),
}));

// Seller Monthly Subscriptions
export const sellerSubscriptions = pgTable('seller_subscriptions', {
  id: serial('id').primaryKey(),
  sellerId: integer('seller_id').references(() => sellerProfiles.id).notNull(),
  subscriptionCode: text('subscription_code').notNull().unique(), // DRM-SUB-YYYYMMDD-XXXX
  amount: integer('amount').notNull().default(15000), // TZS 15,000/month
  periodMonth: text('period_month').notNull(), // e.g. '2026-10'
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  status: text('status').notNull().default('PENDING'), // PENDING, PAID, EXPIRED, CANCELLED
  paymentId: integer('payment_id').references(() => payments.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  sellerIdIdx: index('seller_subscriptions_seller_id_idx').on(table.sellerId),
  statusIdx: index('seller_subscriptions_status_idx').on(table.status),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, { fields: [payments.userId], references: [users.id] }),
  verifier: one(users, { fields: [payments.verifiedBy], references: [users.id] }),
}));

export const moneyLedgerRelations = relations(moneyLedger, ({ one }) => ({
  user: one(users, { fields: [moneyLedger.userId], references: [users.id] }),
  payment: one(payments, { fields: [moneyLedger.paymentId], references: [payments.id] }),
}));

export const sellerSubscriptionsRelations = relations(sellerSubscriptions, ({ one }) => ({
  seller: one(sellerProfiles, { fields: [sellerSubscriptions.sellerId], references: [sellerProfiles.id] }),
  payment: one(payments, { fields: [sellerSubscriptions.paymentId], references: [payments.id] }),
}));
