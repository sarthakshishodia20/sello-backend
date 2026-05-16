import { Injectable, signal, computed } from '@angular/core';

export type Language = 'en' | 'hi' | 'pa';

const DICTIONARY = {
  en: {
    // Navigation
    'nav.overview': 'Overview',
    'nav.analytics': 'Analytics',
    'nav.customers': 'Customers',
    'nav.products': 'Products',
    'nav.merchants': 'Merchants',
    'nav.orders': 'Orders',
    'nav.profile': 'Profile',
    'nav.settings': 'Settings',
    'nav.logout': 'Logout',
    'nav.main_menu': 'MAIN MENU',
    
    // Top Bar
    'topbar.master_title': 'Master Brand Dashboard',
    'topbar.merchant_title': 'Merchant Console',
    'topbar.storefront': 'CUSTOMER STOREFRONT',
    'topbar.view_live': 'View Live Site',
    'topbar.search_placeholder': 'Search...',
    
    // Dashboard Home
    'dashboard.title': 'Dashboard',
    'dashboard.active_merchants': 'Active Merchants',
    'dashboard.master_categories': 'Master Categories',
    'dashboard.master_products': 'Master Products',
    'dashboard.delivered_revenue': 'Delivered Revenue',
    'dashboard.live_catalogue': 'Live Catalogue',
    'dashboard.delinked_products': 'Delinked Products',
    'dashboard.pending_orders': 'Pending Orders',
    'dashboard.welcome': 'Welcome to Sello Dashboard',
    'dashboard.overview_subtitle': 'Here\'s what\'s happening with your business today',
    'dashboard.good_morning': 'Good Morning',
    'dashboard.good_afternoon': 'Good Afternoon',
    'dashboard.good_evening': 'Good Evening',
    
    // Orders
    'orders.title': 'Orders',
    'orders.id': 'Order ID',
    'orders.status': 'Status',
    'orders.merchant': 'Merchant',
    'orders.time': 'Order Time',
    'orders.customer': 'Customer',
    'orders.amount': 'Amount',
    'orders.address': 'Address',
    'orders.payment': 'Payment',
    'orders.actions': 'Actions',
    'orders.pending': 'Pending',
    'orders.delivered': 'Delivered',
    'orders.cancelled': 'Cancelled',
    
    // Products
    'products.title': 'Products',
    'products.name': 'Product Name',
    'products.price': 'Price',
    'products.sku': 'SKU / Code',
    'products.category': 'Category',
    'products.description': 'Description',
    'products.inventory': 'Inventory',
    'products.save': 'Save',
    'products.cancel': 'Cancel',
    'products.add': 'Add Product',
    'products.edit': 'Edit Product',
    'products.delete': 'Delete',
    'products.view': 'View',
    
    // Customers
    'customers.title': 'Customers',
    'customers.id': 'ID',
    'customers.name': 'Name',
    'customers.email': 'Email',
    'customers.phone': 'Phone',
    'customers.platform': 'Platform',
    'customers.registration_date': 'Registration Date',
    'customers.signup_platform': 'Signup Platform',
    'customers.actions': 'Actions',
    'customers.search': 'Search customers...',
    'customers.no_customers': 'No customers found',
    'customers.add_money': 'Add Money to Wallet',
    'customers.deduct_money': 'Deduct Money from Wallet',
    'customers.wallet': 'Wallet',
    
    // Merchants
    'merchants.title': 'Merchants',
    'merchants.id': 'ID',
    'merchants.name': 'Merchant Name',
    'merchants.email': 'Email',
    'merchants.city': 'City',
    'merchants.status': 'Status',
    'merchants.active': 'Active',
    'merchants.inactive': 'Inactive',
    'merchants.view_details': 'View Details',
    
    // Categories
    'categories.title': 'Categories',
    'categories.name': 'Category Name',
    'categories.description': 'Description',
    'categories.add': 'Add Category',
    'categories.edit': 'Edit Category',
    
    // Analytics
    'analytics.title': 'Analytics',
    'analytics.revenue': 'Revenue',
    'analytics.orders': 'Orders',
    'analytics.customers': 'Customers',
    'analytics.merchants': 'Merchants',
    
    // Settings
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.account': 'Account Settings',
    'settings.profile': 'Profile',
    
    // Common Actions
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.export': 'Export',
    'common.import': 'Import',
    'common.add': 'Add',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.view': 'View',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.actions': 'Actions',
    'common.more': 'More',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.warning': 'Warning',
    'common.info': 'Info',
    'common.confirmation': 'Confirmation',
    'common.no_data': 'No data available',
    'common.this': 'This',
    'common.total': 'Total',
    'common.trend': 'Trend',
    'common.weekly': 'Weekly',
    'common.monthly': 'Monthly',
    'common.yearly': 'Yearly',
    'common.trend_label': 'Trend',
    
    // Profile
    'profile.title': 'Profile',
    'profile.edit': 'Edit Profile',
    'profile.name': 'Name',
    'profile.email': 'Email',
    'profile.phone': 'Phone',
    'profile.address': 'Address',
    'profile.city': 'City',
    'profile.state': 'State',
    
    // Login
    'login.title': 'Login',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.submit': 'Login',
    'login.forgot_password': 'Forgot Password?',
  },
  hi: {
    // Navigation
    'nav.overview': 'मुख्य पृष्ठ',
    'nav.analytics': 'एनालिटिक्स',
    'nav.customers': 'ग्राहक',
    'nav.products': 'उत्पाद',
    'nav.merchants': 'विक्रेता',
    'nav.orders': 'ऑर्डर',
    'nav.profile': 'प्रोफ़ाइल',
    'nav.settings': 'सेटिंग्स',
    'nav.logout': 'लॉग आउट',
    'nav.main_menu': 'मुख्य मेनू',
    
    // Top Bar
    'topbar.master_title': 'मास्टर ब्रांड डैशबोर्ड',
    'topbar.merchant_title': 'विक्रेता कंसोल',
    'topbar.storefront': 'ग्राहक स्टोरफ्रंट',
    'topbar.view_live': 'लाइव साइट देखें',
    'topbar.search_placeholder': 'खोजें...',
    
    // Dashboard Home
    'dashboard.title': 'डैशबोर्ड',
    'dashboard.active_merchants': 'सक्रिय विक्रेता',
    'dashboard.master_categories': 'मास्टर श्रेणियां',
    'dashboard.master_products': 'मास्टर उत्पाद',
    'dashboard.delivered_revenue': 'डिलीवर्ड राजस्व',
    'dashboard.live_catalogue': 'लाइव कैटलॉग',
    'dashboard.delinked_products': 'अनलिंक्ड उत्पाद',
    'dashboard.pending_orders': 'लंबित ऑर्डर',
    'dashboard.welcome': 'Sello डैशबोर्ड में आपका स्वागत है',
    'dashboard.overview_subtitle': 'यह देखें कि आज आपके व्यवसार के साथ क्या हो रहा है',
    'dashboard.good_morning': 'शुभ प्रभात',
    'dashboard.good_afternoon': 'नमस्कार',
    'dashboard.good_evening': 'शुभ संध्या',
    
    // Orders
    'orders.title': 'ऑर्डर',
    'orders.id': 'ऑर्डर आईडी',
    'orders.status': 'स्थिति',
    'orders.merchant': 'विक्रेता',
    'orders.time': 'ऑर्डर समय',
    'orders.customer': 'ग्राहक',
    'orders.amount': 'कुल राशि',
    'orders.address': 'पता',
    'orders.payment': 'भुगतान',
    'orders.actions': 'कारवाई',
    'orders.pending': 'लंबित',
    'orders.delivered': 'डिलीवर्ड',
    'orders.cancelled': 'रद्द',
    
    // Products
    'products.title': 'उत्पाद',
    'products.name': 'उत्पाद का नाम',
    'products.price': 'कीमत',
    'products.sku': 'एसकेयू / कोड',
    'products.category': 'श्रेणी',
    'products.description': 'विवरण',
    'products.inventory': 'इन्वेंटरी',
    'products.save': 'सहेजें',
    'products.cancel': 'रद्द करें',
    'products.add': 'उत्पाद जोड़ें',
    'products.edit': 'उत्पाद संपादित करें',
    'products.delete': 'हटाएं',
    'products.view': 'देखें',
    
    // Customers
    'customers.title': 'ग्राहक',
    'customers.id': 'आईडी',
    'customers.name': 'नाम',
    'customers.email': 'ईमेल',
    'customers.phone': 'फोन',
    'customers.platform': 'प्लेटफॉर्म',
    'customers.registration_date': 'पंजीकरण तारीख',
    'customers.signup_platform': 'साइनअप प्लेटफॉर्म',
    'customers.actions': 'कार्रवाई',
    'customers.search': 'ग्राहकों को खोजें...',
    'customers.no_customers': 'कोई ग्राहक नहीं मिला',
    'customers.add_money': 'वॉलेट में पैसे जोड़ें',
    'customers.deduct_money': 'वॉलेट से पैसे निकालें',
    'customers.wallet': 'वॉलेट',
    
    // Merchants
    'merchants.title': 'विक्रेता',
    'merchants.id': 'आईडी',
    'merchants.name': 'विक्रेता का नाम',
    'merchants.email': 'ईमेल',
    'merchants.city': 'शहर',
    'merchants.status': 'स्थिति',
    'merchants.active': 'सक्रिय',
    'merchants.inactive': 'निष्क्रिय',
    'merchants.view_details': 'विवरण देखें',
    
    // Categories
    'categories.title': 'श्रेणियां',
    'categories.name': 'श्रेणी का नाम',
    'categories.description': 'विवरण',
    'categories.add': 'श्रेणी जोड़ें',
    'categories.edit': 'श्रेणी संपादित करें',
    
    // Analytics
    'analytics.title': 'एनालिटिक्स',
    'analytics.revenue': 'राजस्व',
    'analytics.orders': 'ऑर्डर',
    'analytics.customers': 'ग्राहक',
    'analytics.merchants': 'विक्रेਤਾ',
    
    // Settings
    'settings.title': 'सेटिंग्स',
    'settings.language': 'भाषा',
    'settings.account': 'खाता सेटिंग्स',
    'settings.profile': 'प्रोफ़ाइल',
    
    // Common Actions
    'common.search': 'खोजें',
    'common.filter': 'फ़िल्टर',
    'common.export': 'निर्यात',
    'common.import': 'आयात',
    'common.add': 'जोड़ें',
    'common.edit': 'संपादित करें',
    'common.delete': 'हटाएं',
    'common.view': 'देखें',
    'common.save': 'सहेजें',
    'common.cancel': 'रद्द करें',
    'common.back': 'वापस',
    'common.next': 'अगला',
    'common.previous': 'पिछला',
    'common.actions': 'कार्रवाई',
    'common.more': 'अधिक',
    'common.loading': 'लोड हो रहा है...',
    'common.error': 'त्रुटि',
    'common.success': 'सफल',
    'common.warning': 'चेतावनी',
    'common.info': 'जानकारी',
    'common.confirmation': 'पुष्टिकरण',
    'common.no_data': 'कोई डेटा उपलब्ध नहीं',
    'common.this': 'इस',
    'common.total': 'कुल',
    'common.trend': 'ट्रेंड',
    'common.weekly': 'साप्ताहिक',
    'common.monthly': 'मासिक',
    'common.yearly': 'वार्षिक',
    'common.trend_label': 'ट्रेंड',
    
    // Profile
    'profile.title': 'प्रोफ़ाइल',
    'profile.edit': 'प्रोफ़ाइल संपादित करें',
    'profile.name': 'नाम',
    'profile.email': 'ईमेल',
    'profile.phone': 'फोन',
    'profile.address': 'पता',
    'profile.city': 'शहर',
    'profile.state': 'राज्य',
    
    // Login
    'login.title': 'लॉगिन',
    'login.email': 'ईमेल',
    'login.password': 'पासवर्ड',
    'login.submit': 'लॉगिन',
    'login.forgot_password': 'पासवर्ड भूल गए?',
  },
  pa: {
    // Navigation
    'nav.overview': 'ਮੁੱਖ ਪੰਨਾ',
    'nav.analytics': 'ਐਨਾਲਿਟਿਕਸ',
    'nav.customers': 'ਗਾਹਕ',
    'nav.products': 'ਉਤਪਾਦ',
    'nav.merchants': 'ਵਿਕਰੇਤਾ',
    'nav.orders': 'ਆਰਡਰ',
    'nav.profile': 'ਪ੍ਰੋਫਾਈਲ',
    'nav.settings': 'ਸੈਟਿੰਗਾਂ',
    'nav.logout': 'ਲੌਗ ਆਉਟ',
    'nav.main_menu': 'ਮੁੱਖ ਮੇਨੂ',
    
    // Top Bar
    'topbar.master_title': 'ਮਾਸਟਰ ਬ੍ਰਾਂਡ ਡੈਸ਼ਬੋਰਡ',
    'topbar.merchant_title': 'ਵਿਕਰੇਤਾ ਕੰਸੋਲ',
    'topbar.storefront': 'ਗਾਹਕ ਸਟੋਰਫਰੰਟ',
    'topbar.view_live': 'ਲਾਈਵ ਸਾਈਟ ਦੇਖੋ',
    'topbar.search_placeholder': 'ਖੋਜ ਕਰੋ...',
    
    // Dashboard Home
    'dashboard.title': 'ਡੈਸ਼ਬੋਰਡ',
    'dashboard.active_merchants': 'ਸਰਗਰਮ ਵਿਕਰੇਤਾ',
    'dashboard.master_categories': 'ਮਾਸਟਰ ਸ਼੍ਰੇਣੀਆਂ',
    'dashboard.master_products': 'ਮਾਸਟਰ ਉਤਪਾਦ',
    'dashboard.delivered_revenue': 'ਡਿਲੀਵਰਡ ਮਾਲੀਆ',
    'dashboard.live_catalogue': 'ਲਾਈਵ ਕੈਟਾਲਾਗ',
    'dashboard.delinked_products': 'ਅਨਲਿੰਕਡ ਉਤਪਾਦ',
    'dashboard.pending_orders': 'ਲੰਬਿਤ ਆਰਡਰ',
    'dashboard.welcome': 'Sello ਡੈਸ਼ਬੋਰਡ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ',
    'dashboard.overview_subtitle': 'ਇਹ ਦੇਖੋ ਕਿ ਅੱਜ ਤੁਹਾਡੇ ਕਾਰੋਬਾਰ ਨਾਲ ਕੀ ਹੋ ਰਿਹਾ ਹੈ',
    'dashboard.good_morning': 'ਸ਼ੁਭ ਸਵੇਰ',
    'dashboard.good_afternoon': 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ',
    'dashboard.good_evening': 'ਸ਼ੁਭ ਸ਼ਾਮ',
    
    // Orders
    'orders.title': 'ਆਰਡਰ',
    'orders.id': 'ਆਰਡਰ ਆਈਡੀ',
    'orders.status': 'ਸਥਿਤੀ',
    'orders.merchant': 'ਵਿਕਰੇਤਾ',
    'orders.time': 'ਆਰਡਰ ਸਮਾਂ',
    'orders.customer': 'ਗਾਹਕ',
    'orders.amount': 'ਕੁੱਲ ਰਕਮ',
    'orders.address': 'ਪਤਾ',
    'orders.payment': 'ਭੁਗਤਾਨ',
    'orders.actions': 'ਕਾਰਵਾਈ',
    'orders.pending': 'ਲੰਬਿਤ',
    'orders.delivered': 'ਡਿਲੀਵਰਡ',
    'orders.cancelled': 'ਰੱਦ',
    
    // Products
    'products.title': 'ਉਤਪਾਦ',
    'products.name': 'ਉਤਪਾਦ ਦਾ ਨਾਮ',
    'products.price': 'ਕੀਮਤ',
    'products.sku': 'ਐਸਕੇਯੂ / ਕੋਡ',
    'products.category': 'ਸ਼੍ਰੇਣੀ',
    'products.description': 'ਵੇਰਵਾ',
    'products.inventory': 'ਇਨਵੈਂਟਰੀ',
    'products.save': 'ਸੇਵ ਕਰੋ',
    'products.cancel': 'ਰੱਦ ਕਰੋ',
    'products.add': 'ਉਤਪਾਦ ਜੋੜੋ',
    'products.edit': 'ਉਤਪਾਦ ਸੰਪਾਦਿਤ ਕਰੋ',
    'products.delete': 'ਹਟਾਓ',
    'products.view': 'ਦੇਖੋ',
    
    // Customers
    'customers.title': 'ਗਾਹਕ',
    'customers.id': 'ਆਈਡੀ',
    'customers.name': 'ਨਾਮ',
    'customers.email': 'ਈਮੇਲ',
    'customers.phone': 'ਫੋਨ',
    'customers.platform': 'ਪਲੇਟਫਾਰਮ',
    'customers.registration_date': 'ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਮਿਤੀ',
    'customers.signup_platform': 'ਸਾਇਨਅਪ ਪਲੇਟਫਾਰਮ',
    'customers.actions': 'ਕਾਰਵਾਈ',
    'customers.search': 'ਗਾਹਕਾਂ ਦੀ ਖੋਜ ਕਰੋ...',
    'customers.no_customers': 'ਕੋਈ ਗਾਹਕ ਨਹੀਂ ਮਿਲਿਆ',
    'customers.add_money': 'ਵਾਲਿਟ ਵਿੱਚ ਪੈਸੇ ਜੋੜੋ',
    'customers.deduct_money': 'ਵਾਲਿਟ ਵਿੱਚੋਂ ਪੈਸੇ ਕਢਵਾਓ',
    'customers.wallet': 'ਵਾਲਿਟ',
    
    // Merchants
    'merchants.title': 'ਵਿਕਰੇਤਾ',
    'merchants.id': 'ਆਈਡੀ',
    'merchants.name': 'ਵਿਕਰੇਤਾ ਦਾ ਨਾਮ',
    'merchants.email': 'ਈਮੇਲ',
    'merchants.city': 'ਸ਼ਹਿਰ',
    'merchants.status': 'ਸਥਿਤੀ',
    'merchants.active': 'ਸਰਗਰਮ',
    'merchants.inactive': 'ਨਿਸ਼ਕਿਰਿਆ',
    'merchants.view_details': 'ਵੇਰਵੇ ਦੇਖੋ',
    
    // Categories
    'categories.title': 'ਸ਼੍ਰੇਣੀਆਂ',
    'categories.name': 'ਸ਼੍ਰੇਣੀ ਦਾ ਨਾਮ',
    'categories.description': 'ਵੇਰਵਾ',
    'categories.add': 'ਸ਼੍ਰੇਣੀ ਜੋੜੋ',
    'categories.edit': 'ਸ਼੍ਰੇਣੀ ਸੰਪਾਦਿਤ ਕਰੋ',
    
    // Analytics
    'analytics.title': 'ਐਨਾਲਿਟਿਕਸ',
    'analytics.revenue': 'ਮਾਲੀਆ',
    'analytics.orders': 'ਆਰਡਰ',
    'analytics.customers': 'ਗਾਹਕ',
    'analytics.merchants': 'ਵਿਕਰੇਤਾ',
    
    // Settings
    'settings.title': 'ਸੈਟਿੰਗਾਂ',
    'settings.language': 'ਭਾਸ਼ਾ',
    'settings.account': 'ਖਾਤਾ ਸੈਟਿੰਗਾਂ',
    'settings.profile': 'ਪ੍ਰੋਫਾਈਲ',
    
    // Common Actions
    'common.search': 'ਖੋਜ',
    'common.filter': 'ਫਿਲਟਰ',
    'common.export': 'ਐਕਸਪੋਰਟ',
    'common.import': 'ਇੰਪੋਰਟ',
    'common.add': 'ਜੋੜੋ',
    'common.edit': 'ਸੰਪਾਦਿਤ ਕਰੋ',
    'common.delete': 'ਹਟਾਓ',
    'common.view': 'ਦੇਖੋ',
    'common.save': 'ਸੇਵ ਕਰੋ',
    'common.cancel': 'ਰੱਦ ਕਰੋ',
    'common.back': 'ਪਿੱਛੇ',
    'common.next': 'ਅਗਲਾ',
    'common.previous': 'ਪਿਛਲਾ',
    'common.actions': 'ਕਾਰਵਾਈਆਂ',
    'common.more': 'ਹੋਰ',
    'common.loading': 'ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...',
    'common.error': 'ਗਲਤੀ',
    'common.success': 'ਸਫਲਤਾ',
    'common.warning': 'ਚੇਤਾਵਨੀ',
    'common.info': 'ਜਾਣਕਾਰੀ',
    'common.confirmation': 'ਪੁਸ਼ਟੀ',
    'common.no_data': 'ਕੋਈ ਡਾਟਾ ਉਪਲਬਧ ਨਹੀਂ',
    'common.this': 'ਇਸ',
    'common.total': 'ਕੁੱਲ',
    'common.trend': 'ਟ੍ਰੈਂਡ',
    'common.weekly': 'ਹਫ਼ਤਾਵਾਰੀ',
    'common.monthly': 'ਮਹੀਨਾਵਾਰ',
    'common.yearly': 'ਸਾਲਾਨਾ',
    'common.trend_label': 'ਟ੍ਰੈਂਡ',
    
    // Profile
    'profile.title': 'ਪ੍ਰੋਫਾਈਲ',
    'profile.edit': 'ਪ੍ਰੋਫਾਈਲ ਸੰਪਾਦਿਤ ਕਰੋ',
    'profile.name': 'ਨਾਮ',
    'profile.email': 'ਈਮੇਲ',
    'profile.phone': 'ਫੋਨ',
    'profile.address': 'ਪਤਾ',
    'profile.city': 'ਸ਼ਹਿਰ',
    'profile.state': 'ਰਾਜ',
    
    // Login
    'login.title': 'ਲੌਗਇਨ',
    'login.email': 'ਈਮੇਲ',
    'login.password': 'ਪਾਸਵਰਡ',
    'login.submit': 'ਲੌਗਇਨ',
    'login.forgot_password': 'ਪਾਸਵਰਡ ਭੁੱਲ ਗਏ?',
  }
};

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  currentLang = signal<Language>('en');

  constructor() {
    const saved = localStorage.getItem('sello_lang') as Language;
    if (saved && (saved === 'en' || saved === 'hi' || saved === 'pa')) {
      this.currentLang.set(saved);
    }
  }

  setLanguage(lang: Language) {
    this.currentLang.set(lang);
    localStorage.setItem('sello_lang', lang);
  }

  translate(key: keyof typeof DICTIONARY['en']): string {
    const dict = DICTIONARY[this.currentLang()];
    return (dict as any)[key] || key;
  }
}
