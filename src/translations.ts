export type Language = 'en' | 'am';

export interface Dict {
  app_name: string;
  mgmt_suite: string;
  tagline: string;
  tab_clients: string;
  tab_analytics: string;
  btn_log_visit: string;
  btn_new_client: string;
  btn_close_panel: string;

  search_placeholder: string;
  filter_segments: string;
  filter_all: string;
  filter_frequent: string;
  filter_occasional: string;
  filter_at_risk: string;
  resident_profiles: string;
  no_customers_matched: string;
  reset_filters: string;
  syncing_registers: string;

  reg_title: string;
  reg_desc: string;
  label_fullname: string;
  label_phone: string;
  label_birthday: string;
  label_sensitivities: string;
  btn_register: string;
  btn_registering: string;
  dup_warning: string;
  dup_desc: string;
  req_warning: string;
  invalid_dup_phone: string;
  reg_success_feedback: string;

  drawer_title: string;
  drawer_desc: string;
  step1_label: string;
  step1_placeholder: string;
  active_client: string;
  selected_label: string;
  change_client: string;
  no_profiles_match: string;
  step2_label: string;
  step2_desc: string;
  step3_label: string;
  step3_desc: string;
  step4_label: string;
  btn_complete_visit: string;
  btn_completing: string;
  visit_success_banner: string;

  no_client_title: string;
  no_client_desc: string;
  btn_log_visit_direct: string;
  label_contact: string;
  label_birthday_title: string;
  label_registered_title: string;
  telemetry_title: string;
  notes_title: string;
  btn_edit_note: string;
  btn_save_note: string;
  btn_cancel_note: string;
  placeholder_note_edit: string;
  no_formulations_recorded: string;
  note_saved_success: string;
  chrono_title: string;
  loading_loyalty: string;
  no_history_captured: string;
  log_first_visit: string;
  table_date: string;
  table_treatments: string;
  table_price: string;
  table_channel: string;

  loading_analytics: string;
  analytics_title: string;
  analytics_subtitle: string;
  btn_sync: string;
  card_daily: string;
  card_weekly: string;
  card_monthly: string;
  no_transactions_today: string;
  rolling_7_days: string;
  calendar_month: string;
  calc_title: string;
  label_start_date: string;
  label_end_date: string;
  btn_calc_range: string;
  computing_db: string;
  gross_range_revenue: string;
  logged_trans: string;
  rev_channels_breakout: string;
  retention_dist_title: string;
  profiles_loaded_label: string;
  frequent_segment_lbl: string;
  stable_segment_lbl: string;
  atrisk_segment_lbl: string;
  performance_title: string;
  leaderboard_desc: string;
  no_metrics: string;
  export_center_title: string;
  export_center_desc: string;
  export_segment_label: string;
  export_format_label: string;
  download_btn: string;
  preview_title: string;
  preview_active_badge: string;
  no_customers_in_segment: string;
  last_seen_prefix: string;
  visit_or_treatment: string;
}

export const TRANSLATIONS: Record<Language, Dict> = {
  en: {
    app_name: 'Kaldas Beauty Salon',
    mgmt_suite: 'Admin Suite',
    tagline: 'Premium Hair, Skin & Nail Care Suite',
    tab_clients: 'Clients Directory',
    tab_analytics: 'Earnings & Metrics',
    btn_log_visit: 'Log Visit',
    btn_new_client: 'New Client',
    btn_close_panel: 'Close Panel',

    search_placeholder: 'Search clients by name or phone...',
    filter_segments: 'Search Filter Segments',
    filter_all: 'All',
    filter_frequent: 'Frequent',
    filter_occasional: 'Regular',
    filter_at_risk: 'Needs Care',
    resident_profiles: 'RESIDENT PROFILES',
    no_customers_matched: 'No customers match selection',
    reset_filters: 'Reset filters',
    syncing_registers: 'Syncing salon registers...',

    reg_title: 'Register Resident Client',
    reg_desc: 'Capture profile formulation journals & sensitivities',
    label_fullname: 'Full Name',
    label_phone: 'Phone Number',
    label_birthday: 'Birthday (Optional)',
    label_sensitivities: 'Sensitivities & Notes',
    btn_register: 'Register Profile',
    btn_registering: 'Registering...',
    dup_warning: 'Duplicate Identified:',
    dup_desc: 'matches. Clear or modify phone to enable registration.',
    req_warning: 'Full Name and Phone Number are required fields.',
    invalid_dup_phone: 'Cannot register. This phone number matches an existing client.',
    reg_success_feedback: 'Client registered successfully! Segments updated.',

    drawer_title: 'Log Salon Visit',
    drawer_desc: 'Capture product consumption & formulation details',
    step1_label: '1. Resident Client Selection',
    step1_placeholder: 'Search resident client by name or phone...',
    active_client: 'Active Client',
    selected_label: 'Selected:',
    change_client: 'Change Client',
    no_profiles_match: 'No profiles matched your search',
    step2_label: '2. Provided Treatments & Formulations',
    step2_desc: 'Select customer services to aggregate total invoice',
    step3_label: '3. Final Invoice Price (ETB)',
    step3_desc: 'Fully customisable invoice rate',
    step4_label: '4. Payment channel',
    btn_complete_visit: 'Complete Visit & Log Price',
    btn_completing: 'Registering visit record...',
    visit_success_banner: 'Visit logged successfully! Updating customer status...',

    no_client_title: 'No Client Profile Selected',
    no_client_desc: 'Select a resident customer from the directory search list to monitor retention history and formulation diaries.',
    btn_log_visit_direct: 'Log Visit',
    label_contact: 'Contact',
    label_birthday_title: 'Birthday',
    label_registered_title: 'Registered',
    telemetry_title: 'Segment Telemetry',
    notes_title: 'formulation & sensitivities',
    btn_edit_note: 'Edit Note',
    btn_save_note: 'Save',
    btn_cancel_note: 'Cancel',
    placeholder_note_edit: 'Include beauty mixtures, allergy alerts, skin formulations...',
    no_formulations_recorded: 'No custom formulations allergy codes recorded. Tap "Edit Note" above.',
    note_saved_success: '✓ Diary journal saved!',
    chrono_title: 'CHRONOLOGICAL FORMULATION DIARY',
    loading_loyalty: 'Loading loyalty chronology...',
    no_history_captured: 'No formulation history captured for this customer.',
    log_first_visit: 'Log first visit session',
    table_date: 'Visit Date',
    table_treatments: 'Treatments & Formulations',
    table_price: 'Invoice Rate',
    table_channel: 'Payment Channel',

    loading_analytics: 'Loading operational analytics...',
    analytics_title: 'Earning Metriqe & Client Retention Auditing',
    analytics_subtitle: 'Real-time operational summaries and customer loyalty segments.',
    btn_sync: 'Synchronize Registry',
    card_daily: 'Daily Income',
    card_weekly: 'Weekly Income',
    card_monthly: 'Monthly Income',
    no_transactions_today: 'No transactions logged today',
    rolling_7_days: 'Rolling 7-day accounting cycle',
    calendar_month: 'Calendar month projection',
    calc_title: 'Custom Earning Range Calculator',
    label_start_date: 'Start Date',
    label_end_date: 'End Date',
    btn_calc_range: 'Calculate Range Incomes',
    computing_db: 'Computing database log...',
    gross_range_revenue: 'Gross Range Revenue:',
    logged_trans: 'Logged Transactions:',
    rev_channels_breakout: 'Revenue channels breakout:',
    retention_dist_title: 'Resident Retention Segment distribution',
    profiles_loaded_label: 'Profiles Loaded',
    frequent_segment_lbl: 'Frequent',
    stable_segment_lbl: 'Regular (Occasional)',
    atrisk_segment_lbl: 'Needs Care (Inactive Warning)',
    performance_title: 'Treatment Performance Metriqes',
    leaderboard_desc: 'Frequency counts aggregated from guest checkout receipts.',
    no_metrics: 'No service metrics accumulated yet.',
    export_center_title: 'Targeted Loyalty Data Export',
    export_center_desc: 'Export specific guest segments to launch promotional campaigns or sensitivity followups.',
    export_segment_label: 'Loyalty Segment',
    export_format_label: 'Export Format',
    download_btn: 'Download Segment',
    preview_title: 'Registry Preview',
    preview_active_badge: 'ACTIVE',
    no_customers_in_segment: 'No customers in this tier.',
    last_seen_prefix: 'Last seen:',
    visit_or_treatment: 'Complete Visit & Log Price'
  },
  am: {
    app_name: 'ካልዳስ ውበት ሳሎን',
    mgmt_suite: 'አስተዳደር ማዕከል',
    tagline: 'ልዩ የፀጉር፣ የቆዳ እና የጥፍር እንክብካቤ',
    tab_clients: 'የደንበኞች ማውጫ',
    tab_analytics: 'ገቢ እና መለኪያዎች',
    btn_log_visit: 'ጉብኝት መዝግብ',
    btn_new_client: 'አዲስ ደንበኛ',
    btn_close_panel: 'ፓነል ዝጋ',

    search_placeholder: 'ደንበኞችን በስም ወይም በስልክ ፈልግ...',
    filter_segments: 'የፍለጋ ማጣሪያዎች',
    filter_all: 'ሁሉም',
    filter_frequent: 'ተደጋጋሚ',
    filter_occasional: 'ቋሚ / መካከለኛ',
    filter_at_risk: 'ክትትል የሚሻ',
    resident_profiles: 'የደንበኞች መገለጫዎች',
    no_customers_matched: 'ምንም የሚዛመድ ደንበኛ አልተገኘም',
    reset_filters: 'ማጣሪያዎችን አጽዳ',
    syncing_registers: 'መዝገቡ እየተጫነ ነው...',

    reg_title: 'አዲስ ደንበኛ ይመዝግቡ',
    reg_desc: 'የደንበኛውን ታሪክ፣ ቀመሮች እና አለርጂዎች ያስመዝግቡ',
    label_fullname: 'ሙሉ ስም',
    label_phone: 'ስልክ ቁጥር',
    label_birthday: 'የልደት ቀን (አማራጭ)',
    label_sensitivities: 'ስሜታዊነቶች እና ማስታወሻዎች',
    btn_register: 'መገለጫውን ይመዝግቡ',
    btn_registering: 'እየተመዘገበ ነው...',
    dup_warning: 'ይህ ደንበኛ አስቀድሞ ተመዝግቧል፦',
    dup_desc: 'ይዛመዳል። ለመመዝገብ እባክዎ ስልኩን ይቀይሩ።',
    req_warning: 'ሙሉ ስም እና ስልክ ቁጥር የግዴታ መስኮች ናቸው።',
    invalid_dup_phone: 'መመዝገብ አይቻልም። ይህ ስልክ ቁጥር ካለ ደንበኛ ጋር ይዛመዳል።',
    reg_success_feedback: 'ደንበኛው በተሳካ ሁኔታ ተመዝግቧል! ክፍሎች ተዘምነዋል።',

    drawer_title: 'የሳሎን ጉብኝት ይመዝግቡ',
    drawer_desc: 'የምርት አጠቃቀም እና የቀመር ዝርዝሮችን ይያዙ',
    step1_label: '1. የነዋሪ ደንበኛ ምርጫ',
    step1_placeholder: 'ነዋሪ ደንበኛን በስም ወይም በስልክ ፈልግ...',
    active_client: 'ንቁ ደንበኛ',
    selected_label: 'የተመረጠው፦',
    change_client: 'ደንበኛ ቀይር',
    no_profiles_match: 'የፍለጋ ውጤት አልተገኘም',
    step2_label: '2. የቀረቡ ህክምናዎች እና ቀመሮች',
    step2_desc: 'ጠቅላላ የክፍያ መጠየቂያውን ለማስላት የደንበኛ አገልግሎቶችን ይምረጡ',
    step3_label: '3. የመጨረሻ የክፍያ ዋጋ (ETB)',
    step3_desc: 'ሙሉ በሙሉ ሊሻሻል የሚችል ዋጋ',
    step4_label: '4. የክፍያ አማራጭ',
    btn_complete_visit: 'ጉብኝቱን ጨርስ እና ዋጋ መዝግብ',
    btn_completing: 'የጉብኝት መዝገብ እየተመዘገበ ነው...',
    visit_success_banner: 'ጉብኝቱ በተሳካ ሁኔታ ተመዝግቧል! የደንበኛው ደረጃ እየተዘመነ ነው...',

    no_client_title: 'ምንም የደንበኛ መገለጫ አልተመረጠም',
    no_client_desc: 'የታማኝነት ታሪክን እና የቀመር ማስታወሻዎችን ለመከታተል ከደንበኞች ዝርዝር ውስጥ ደንበኛ ይምረጡ።',
    btn_log_visit_direct: 'ጉብኝት መዝግብ',
    label_contact: 'እውቂያ',
    label_birthday_title: 'የልደት ቀን',
    label_registered_title: 'የተመዘገበበት',
    telemetry_title: 'የታማኝነት ክፍል መረጃ',
    notes_title: 'የቀመሮች እና ስሜታዊነቶች ማስታወሻ',
    btn_edit_note: 'ማስታወሻ አርትዕ',
    btn_save_note: 'አስቀምጥ',
    btn_cancel_note: 'ሰርዝ',
    placeholder_note_edit: 'የውበት ድብልቆችን፣ አለርጂዎችን፣ የቆዳ ቀመሮችን እዚህ ይጻፉ...',
    no_formulations_recorded: 'ምንም የቀመር ማስታወሻ አልተመዘገበም። ማስታወሻ ለማከል "ማስታወሻ አርትዕ" የሚለውን ይጫኑ።',
    note_saved_success: '✓ የቀመር ማስታወሻው በትክክል ተቀምጧል!',
    chrono_title: 'የጉብኝቶች እና ቀመሮች የጊዜ ቅደም ተከተል',
    loading_loyalty: 'የደንበኛው ታሪክ እየተጫነ ነው...',
    no_history_captured: 'ለዚህ ደንበኛ ምንም የታሪክ መዝገብ አልተገኘም።',
    log_first_visit: 'የመጀመሪያውን ጉብኝት መዝግብ',
    table_date: 'የጉብኝት ቀን',
    table_treatments: 'ህክምናዎች እና ቀመሮች',
    table_price: 'የክፍያ ዋጋ',
    table_channel: 'የክፍያ አማራጭ',

    loading_analytics: 'የገቢ ማጠቃለያዎች እየተጫኑ ነው...',
    analytics_title: 'የገቢ ገበታ እና የደንበኞች ታማኝነት ኦዲት',
    analytics_subtitle: 'የእውነተኛ ጊዜ የአሠራር ማጠቃለያዎች እና የደንበኞች ታማኝነት ክፍሎች።',
    btn_sync: 'መዝገቡን አመሳስል',
    card_daily: 'ዕለታዊ ገቢ',
    card_weekly: 'ሳምንታዊ ገቢ',
    card_monthly: 'ወርሃዊ ገቢ',
    no_transactions_today: 'ዛሬ የተመዘገበ ግብይት የለም',
    rolling_7_days: 'የ7 ቀናት አጠቃላይ የሂሳብ ዑደት',
    calendar_month: 'የወር ወርሃዊ ትንበያ',
    calc_title: 'ብጁ የገቢ ጊዜ ማስሊያ',
    label_start_date: 'ጀምር ቀን',
    label_end_date: 'ጨርስ ቀን',
    btn_calc_range: 'የተመረጠውን ጊዜ ገቢ አስላ',
    computing_db: 'መረጃው እየተሰላ ነው...',
    gross_range_revenue: 'የተመረጠው ጊዜ ጠቅላላ ገቢ፦',
    logged_trans: 'የተመዘገቡ ግብይቶች፦',
    rev_channels_breakout: 'የክፍያ አማራጮች ዝርዝር፦',
    retention_dist_title: 'የደንበኞች ታማኝነት ደረጃ ስርጭት',
    profiles_loaded_label: 'የተጫኑ መገለጫዎች',
    frequent_segment_lbl: 'ተደጋጋሚ',
    stable_segment_lbl: 'ቋሚ (መካከለኛ)',
    atrisk_segment_lbl: 'ክትትል የሚሻ (ተዘናጊ)',
    performance_title: 'የአአገልግሎቶች አፈጸጸም መለኪያዎች',
    leaderboard_desc: 'ከደንበኞች ክፍያ ደረሰኞች የተሰበሰበ ድግግሞሽ።',
    no_metrics: 'ምንም የአገልግሎት መረጃ እስካሁን አልተሰበሰበም።',
    export_center_title: 'የታማኝነት መረጃ ኤክስፖርት',
    export_center_desc: 'የማስተዋወቂያ ዘመቻዎችን ወይም የክትትል ስራዎችን ለመጀመር የተወሰኑ የደንበኛ ክፍሎችን ኤክስፖርት ያድርጉ።',
    export_segment_label: 'የታማኝነት ክፍል',
    export_format_label: 'የኤክስፖርት ፎርማት',
    download_btn: 'ክፍሉን አውርድ',
    preview_title: 'የመዝገብ ቅድመ-ዕይታ',
    preview_active_badge: 'ንቁ',
    no_customers_in_segment: 'በዚህ ደረጃ ምንም ደንበኛ የለም።',
    last_seen_prefix: 'ለመጨረሻ ጊዜ የታየው፦',
    visit_or_treatment: 'ጉብኝቱን ጨርስ እና ዋጋ መዝግብ'
  }
};

export const AMHARIC_SERVICE_NAMES: Record<string, string> = {
  'srv_1': 'ልዩ የፀጉር ቀለም መቀየር (Balayage)',
  'srv_2': 'ፊት ማጽዳትና ማደስ (Hydrafacial)',
  'srv_3': 'የቅንጦት ጥፍር ውበትና እጅ ማሳጅ (Manicure)',
  'srv_4': 'የእግር ማጽዳትና ህክምና (Pedicare)',
  'srv_5': 'ደንበኛን ዘና የሚያደርግ የሰውነት ማሳጅ (Deep Tissue)',
  'srv_6': 'የፀጉር ምግብና የእንክብካቤ ህክምና (Keratin)',
  'srv_7': 'ቅንጦት ፀጉር ማድረቅና ስታይል (Blowout)',
  'srv_8': 'የኮላጅን ፊት ማስክ ህክምና',
  'prod_9': 'ለፀጉር ማሳመሪያ የሚሆን የአርጋን ዘይት (ሽያጭ)',
  'prod_10': 'ኦርጋኒክ የእፅዋት የፊት ማጽጃ ጄል (ሽያጭ)'
};

export const AMHARIC_NAMES: Record<string, string> = {
  // Staff
  'Helen Bekele': 'ሄለን በቀለ',
  'Zenebe Tesfaye': 'ዘነበ ተስፋዬ',
  // Artists
  'Sara Daniel': 'ሳራ ዳንኤል',
  'Kidus Yohannes': 'ኪዱስ ዮሐንስ',
  'Martha Girma': 'ማርታ ግርማ'
};

export function translateName(name: string, lang: Language): string {
  if (lang === 'am') {
    return AMHARIC_NAMES[name] || name;
  }
  return name;
}

export function translateServiceName(id: string, fallbackName: string, lang: Language): string {
  if (lang === 'am') {
    return AMHARIC_SERVICE_NAMES[id] || fallbackName;
  }
  return fallbackName;
}

export function translateCategory(category: string, lang: Language): string {
  if (lang === 'am') {
    const cats: Record<string, string> = {
      'Hair': 'ፀጉር',
      'Nails': 'ጥፍር',
      'Skin': 'ቆዳ',
      'Massage': 'ማሳጅ',
      'Product': 'የሽያጭ ምርት'
    };
    return cats[category] || category;
  }
  return category;
}

export function translateSpecialty(specialty: string, lang: Language): string {
  if (lang === 'am') {
    const specs: Record<string, string> = {
      'Hair': 'የፀጉር ባለሙያ',
      'Nails': 'የጥፍር ባለሙያ',
      'Skin': 'የፊት/ቆዳ ባለሙያ',
      'Massage': 'የማሳጅ ባለሙያ',
      'General': 'አጠቃላይ ባለሙያ'
    };
    return specs[specialty] || specialty;
  }
  return specialty;
}

export function translateRole(role: string, lang: Language): string {
  if (lang === 'am') {
    const roles: Record<string, string> = {
      'cashier': 'ካሽየር',
      'assistant': 'ረዳት'
    };
    return roles[role] || role;
  }
  return role;
}

export const AMHARIC_SKILLS: Record<string, string> = {
  'Balayage, Keratin, Chic Blowout': 'ባላያጅ፣ ኬራቲን፣ ቺክ ብሎውአውት (Balayage, Keratin, Chic Blowout)',
  'Gel Manicure, Acrylic extensions, Pedicare': 'ጄል ማኒኪዩር፣ አክሬሊክስ ኤክስቴንሽን፣ ፔዲኬር (Gel Manicure, Acrylic extensions)',
  'Swedish Silk Massage, Hydrafacial, Collagen Mask': 'ስዊዲሽ ማሳጅ፣ ሃይድራፌሻል፣ ኮላጅን ማስክ (Swedish Massage, Hydrafacial)'
};

export function translateSkills(skills: string, lang: Language): string {
  if (lang === 'am') {
    return AMHARIC_SKILLS[skills] || skills;
  }
  return skills;
}


