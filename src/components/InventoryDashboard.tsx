import React, { useState } from 'react';
import { 
  InventoryProduct, 
  ActiveProductCheckout, 
  InventoryLog, 
  TreatmentArtist, 
  StaffMember, 
  Language 
} from '../types';
import { 
  Package, 
  AlertTriangle, 
  UserCheck, 
  Plus, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  TrendingUp, 
  Filter, 
  Layers, 
  Zap, 
  ArrowRight,
  Info,
  Check,
  X,
  Edit2,
  Trash2,
  Lock,
  RotateCcw
} from 'lucide-react';

interface InventoryDashboardProps {
  products: InventoryProduct[];
  activeCheckouts: ActiveProductCheckout[];
  inventoryLogs: InventoryLog[];
  stylists: TreatmentArtist[];
  staffMembers?: StaffMember[];
  userRole?: string;
  onAddProduct: (prod: Omit<InventoryProduct, 'id' | 'created_at'>) => Promise<void>;
  onUpdateProduct: (id: string, updates: Partial<InventoryProduct>) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onCheckoutProduct: (productId: string, stylistId: string, stylistName: string, forceOverride?: boolean, overrideReason?: string) => Promise<{ success: boolean; warning?: string }>;
  onIncrementCheckoutUsage: (checkoutId: string) => Promise<void>;
  onCompleteCheckout: (checkoutId: string, reason?: string) => Promise<void>;
  onRestockProduct: (productId: string, quantityToAdd: number) => Promise<void>;
  lang: Language;
}

export default function InventoryDashboard({
  products,
  activeCheckouts,
  inventoryLogs,
  stylists,
  staffMembers = [],
  userRole = 'cashier',
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onCheckoutProduct,
  onIncrementCheckoutUsage,
  onCompleteCheckout,
  onRestockProduct,
  lang
}: InventoryDashboardProps) {
  // Navigation sub-tab inside inventory module
  const [subTab, setSubTab] = useState<'stylist_active' | 'catalog' | 'alerts' | 'audit_log'>('stylist_active');
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'single_use' | 'multiple_use' | 'low_stock'>('all');
  const [selectedStylistFilter, setSelectedStylistFilter] = useState<string>('all');

  // Checkout modal states
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutProductId, setCheckoutProductId] = useState('');
  const [checkoutStylistId, setCheckoutStylistId] = useState('');
  const [checkoutWarning, setCheckoutWarning] = useState<string | null>(null);
  const [checkoutBlockedCheckoutId, setCheckoutBlockedCheckoutId] = useState<string | null>(null);
  const [showForceOverrideOption, setShowForceOverrideOption] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);

  // Add/Edit product modal states
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodCategoryType, setProdCategoryType] = useState<'single_use' | 'multiple_use'>('multiple_use');
  const [prodCategoryLabel, setProdCategoryLabel] = useState<'Hair' | 'Nails' | 'Skin' | 'Massage' | 'General'>('Hair');
  const [prodStock, setProdStock] = useState<number>(10);
  const [prodUnit, setProdUnit] = useState('bottles');
  const [prodLowThreshold, setProdLowThreshold] = useState<number>(3);
  const [prodMinClients, setProdMinClients] = useState<number>(5);
  const [prodPrice, setProdPrice] = useState<number>(30);

  // Restock modal state
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockProduct, setRestockProduct] = useState<InventoryProduct | null>(null);
  const [restockQty, setRestockQty] = useState<number>(5);

  // Stylists list (strictly Treatment Artists / Stylists only - staff and assistants excluded)
  const allProviders = (stylists || []).map(s => ({
    id: s.id,
    name: s.name,
    role: s.specialty ? `${s.specialty} Artist` : 'Stylist'
  }));

  // Active checkouts (status === 'active')
  const currentActiveCheckouts = activeCheckouts.filter(c => c.status === 'active');
  const lowStockProducts = products.filter(p => p.stock_quantity <= p.low_stock_threshold);

  // Filter products catalog
  const filteredProducts = (products || []).filter(p => {
    const pName = p?.name || '';
    const uName = p?.unit_name || '';
    const qStr = searchQuery || '';
    const matchesSearch = pName.toLowerCase().includes(qStr.toLowerCase()) || 
                          uName.toLowerCase().includes(qStr.toLowerCase());
    if (!matchesSearch) return false;
    if (typeFilter === 'single_use') return p.category_type === 'single_use';
    if (typeFilter === 'multiple_use') return p.category_type === 'multiple_use';
    if (typeFilter === 'low_stock') return p.stock_quantity <= p.low_stock_threshold;
    return true;
  });

  // Open checkout modal
  const handleOpenCheckout = (prodId?: string, stylId?: string) => {
    setCheckoutProductId(prodId || (products[0]?.id || ''));
    setCheckoutStylistId(stylId || (allProviders[0]?.id || ''));
    setCheckoutWarning(null);
    setCheckoutBlockedCheckoutId(null);
    setShowForceOverrideOption(false);
    setOverrideReason('');
    setShowCheckoutModal(true);
  };

  // Execute checkout submission with multi-use restriction logic
  const handlePerformCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutProductId || !checkoutStylistId) return;

    const selectedProd = products.find(p => p.id === checkoutProductId);
    const selectedStylist = allProviders.find(s => s.id === checkoutStylistId);
    if (!selectedProd || !selectedStylist) return;

    setIsSubmittingCheckout(true);
    try {
      const res = await onCheckoutProduct(
        selectedProd.id,
        selectedStylist.id,
        selectedStylist.name,
        showForceOverrideOption,
        overrideReason.trim()
      );

      if (!res.success && res.warning) {
        setCheckoutWarning(res.warning);
        // Find blocked checkout id if available
        const existingActive = currentActiveCheckouts.find(
          c => c.product_id === selectedProd.id && c.stylist_id === selectedStylist.id
        );
        if (existingActive) {
          setCheckoutBlockedCheckoutId(existingActive.id);
        }
      } else {
        setShowCheckoutModal(false);
        setCheckoutWarning(null);
        setCheckoutBlockedCheckoutId(null);
        setShowForceOverrideOption(false);
        setOverrideReason('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  // Open add product modal
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProdName('');
    setProdCategoryType('multiple_use');
    setProdCategoryLabel('Hair');
    setProdStock(10);
    setProdUnit('bottles');
    setProdLowThreshold(3);
    setProdMinClients(5);
    setProdPrice(35);
    setShowProductModal(true);
  };

  // Open edit product modal
  const handleOpenEditProduct = (p: InventoryProduct) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdCategoryType(p.category_type);
    setProdCategoryLabel(p.category_label || 'Hair');
    setProdStock(p.stock_quantity);
    setProdUnit(p.unit_name);
    setProdLowThreshold(p.low_stock_threshold);
    setProdMinClients(p.min_clients_per_unit || 1);
    setProdPrice(p.price_per_unit || 0);
    setShowProductModal(true);
  };

  // Save product (Add / Update)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) return;

    if (editingProduct) {
      await onUpdateProduct(editingProduct.id, {
        name: prodName.trim(),
        category_type: prodCategoryType,
        category_label: prodCategoryLabel,
        stock_quantity: Number(prodStock),
        unit_name: prodUnit.trim(),
        low_stock_threshold: Number(prodLowThreshold),
        min_clients_per_unit: prodCategoryType === 'single_use' ? 1 : Number(prodMinClients),
        price_per_unit: Number(prodPrice)
      });
    } else {
      await onAddProduct({
        name: prodName.trim(),
        category_type: prodCategoryType,
        category_label: prodCategoryLabel,
        stock_quantity: Number(prodStock),
        unit_name: prodUnit.trim(),
        low_stock_threshold: Number(prodLowThreshold),
        min_clients_per_unit: prodCategoryType === 'single_use' ? 1 : Number(prodMinClients),
        price_per_unit: Number(prodPrice)
      });
    }
    setShowProductModal(false);
  };

  // Execute restock submit
  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockProduct || restockQty <= 0) return;
    await onRestockProduct(restockProduct.id, Number(restockQty));
    setShowRestockModal(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Module Title Banner & Quick Action Buttons */}
      <div className="bg-gradient-to-r from-amber-950 via-neutral-900 to-neutral-950 text-white rounded-[28px] p-6 shadow-ios relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
              <Package className="w-3.5 h-3.5" />
              <span>Kaldas Beauty Salon • Smart Inventory Engine</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-amber-100">
              {lang === 'am' ? 'የእቃና ምርት ክምችት መቆጣጠሪያ' : 'Product Inventory & Usage Control'}
            </h1>
            <p className="text-xs md:text-sm text-neutral-300 max-w-2xl font-normal leading-relaxed">
              Track single-use consumables and enforce multi-use bottle checkout restrictions per stylist to eliminate wastage and leakage.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => handleOpenCheckout()}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-2xl flex items-center space-x-2 transition-all shadow-md cursor-pointer ios-active-scale"
              id="btn-checkout-product"
            >
              <UserCheck className="w-4 h-4" />
              <span>{lang === 'am' ? 'ምርት ለስታይሊስት ስጥ' : 'Checkout to Stylist'}</span>
            </button>

            <button
              onClick={handleOpenAddProduct}
              className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs rounded-2xl border border-neutral-700 flex items-center space-x-2 transition-all cursor-pointer ios-active-scale"
              id="btn-add-inventory-product"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>{lang === 'am' ? 'አዲስ ምርት መዝግብ' : 'Add New Product'}</span>
            </button>
          </div>
        </div>

        {/* Top KPI Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-neutral-800/80">
          <div className="bg-neutral-900/80 backdrop-blur-md p-3.5 rounded-2xl border border-neutral-800 flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/15 text-amber-400 rounded-xl shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Total Products</div>
              <div className="text-lg font-black text-amber-100">{products.length} Items</div>
            </div>
          </div>

          <div className="bg-neutral-900/80 backdrop-blur-md p-3.5 rounded-2xl border border-neutral-800 flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/15 text-emerald-400 rounded-xl shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Active Bottles In-Use</div>
              <div className="text-lg font-black text-emerald-300">{currentActiveCheckouts.length} Active</div>
            </div>
          </div>

          <div className="bg-neutral-900/80 backdrop-blur-md p-3.5 rounded-2xl border border-neutral-800 flex items-center space-x-3">
            <div className={`p-2.5 ${lowStockProducts.length > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-neutral-800 text-neutral-400'} rounded-xl shrink-0`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Low Stock Warning</div>
              <div className={`text-lg font-black ${lowStockProducts.length > 0 ? 'text-rose-400' : 'text-neutral-300'}`}>
                {lowStockProducts.length} Products
              </div>
            </div>
          </div>

          <div className="bg-neutral-900/80 backdrop-blur-md p-3.5 rounded-2xl border border-neutral-800 flex items-center space-x-3">
            <div className="p-2.5 bg-sky-500/15 text-sky-400 rounded-xl shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Single / Multi Ratio</div>
              <div className="text-lg font-black text-sky-200">
                {products.filter(p => p.category_type === 'single_use').length} / {products.filter(p => p.category_type === 'multiple_use').length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Warning Alert Banner if any */}
      {lowStockProducts.length > 0 && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-neutral-950 flex items-center justify-center font-bold shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center space-x-2">
                <span>Low Inventory Alert ({lowStockProducts.length} items below minimum threshold)</span>
              </h4>
              <p className="text-xs text-amber-900 font-medium mt-0.5">
                Low items: {lowStockProducts.map(p => `${p.name} (${p.stock_quantity} ${p.unit_name} remaining)`).join(', ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSubTab('catalog')}
            className="text-xs bg-amber-950 hover:bg-neutral-900 text-amber-200 font-bold px-3 py-1.5 rounded-xl transition-colors shrink-0 shadow-xs cursor-pointer"
          >
            Review Catalog & Restock
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs inside Module */}
      <div className="flex flex-wrap items-center gap-2 bg-neutral-100 p-1.5 rounded-2xl border border-neutral-200/70">
        <button
          onClick={() => setSubTab('stylist_active')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
            subTab === 'stylist_active' 
              ? 'bg-neutral-900 text-white shadow-xs' 
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
          }`}
          id="tab-sub-stylist-inventory"
        >
          <UserCheck className="w-4 h-4 text-amber-400" />
          <span>Stylist Active Inventory ({currentActiveCheckouts.length})</span>
        </button>

        <button
          onClick={() => setSubTab('catalog')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
            subTab === 'catalog' 
              ? 'bg-neutral-900 text-white shadow-xs' 
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
          }`}
          id="tab-sub-product-catalog"
        >
          <Package className="w-4 h-4 text-emerald-400" />
          <span>Product Catalog & Stock ({products.length})</span>
        </button>

        <button
          onClick={() => setSubTab('alerts')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
            subTab === 'alerts' 
              ? 'bg-neutral-900 text-white shadow-xs' 
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
          }`}
          id="tab-sub-inventory-alerts"
        >
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span>Usage Alerts & Restrictions</span>
          {lowStockProducts.length > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
              {lowStockProducts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setSubTab('audit_log')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
            subTab === 'audit_log' 
              ? 'bg-neutral-900 text-white shadow-xs' 
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
          }`}
          id="tab-sub-audit-logs"
        >
          <Clock className="w-4 h-4 text-sky-400" />
          <span>Audit History ({inventoryLogs.length})</span>
        </button>
      </div>

      {/* VIEW 1: STYLIST ACTIVE INVENTORY CARD GRID */}
      {subTab === 'stylist_active' && (
        <div className="space-y-5 animate-fade-in">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-neutral-200/60 shadow-xs">
            <div>
              <h3 className="text-sm font-extrabold text-neutral-900 flex items-center space-x-2">
                <span>Stylist Active Bottles & Containers</span>
                <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                  Multi-Use Restriction Tracker
                </span>
              </h3>
              <p className="text-xs text-neutral-500">
                Monitors active shampoo, treatment jars, and developers assigned per stylist. Track client servicing counts before new checkouts are permitted.
              </p>
            </div>

            {/* Stylist filter dropdown */}
            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-neutral-600">Filter Stylist:</label>
              <select
                value={selectedStylistFilter}
                onChange={(e) => setSelectedStylistFilter(e.target.value)}
                className="bg-neutral-50 border border-neutral-200 py-1.5 px-3 rounded-xl text-xs font-bold text-neutral-800 focus:outline-none"
              >
                <option value="all">All Treatment Providers ({allProviders.length})</option>
                {allProviders.map(st => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>
          </div>

          {allProviders.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-neutral-200 text-center text-xs text-neutral-500">
              No stylists registered yet. Please add treatment providers in the Staff/Stylists section.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {allProviders
                .filter(st => selectedStylistFilter === 'all' || st.id === selectedStylistFilter)
                .map(stylist => {
                  const stylistActiveCheckouts = currentActiveCheckouts.filter(c => c.stylist_id === stylist.id);
                  const completedCount = activeCheckouts.filter(c => c.stylist_id === stylist.id && c.status === 'completed').length;

                  return (
                    <div 
                      key={stylist.id} 
                      className="bg-white rounded-3xl border border-neutral-200/80 shadow-ios p-5 space-y-4 hover:border-amber-400/60 transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        {/* Stylist Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-neutral-950 font-black flex items-center justify-center text-sm shadow-xs">
                              {stylist.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-extrabold text-neutral-900 text-sm leading-tight">{stylist.name}</h4>
                              <span className="text-[11px] text-neutral-500 font-medium">{stylist.role}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="inline-block bg-neutral-100 text-neutral-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                              {stylistActiveCheckouts.length} Active Items
                            </span>
                          </div>
                        </div>

                        {/* Active checked out items list */}
                        {stylistActiveCheckouts.length === 0 ? (
                          <div className="py-6 text-center bg-neutral-50/70 rounded-2xl border border-dashed border-neutral-200 space-y-2">
                            <CheckCircle2 className="w-6 h-6 text-neutral-300 mx-auto" />
                            <p className="text-xs text-neutral-500 font-medium">No active bottles checked out.</p>
                            <button
                              onClick={() => handleOpenCheckout(undefined, stylist.id)}
                              className="text-[11px] text-amber-700 font-bold hover:underline cursor-pointer"
                            >
                              + Issue Multi-Use Bottle
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {stylistActiveCheckouts.map(checkout => {
                              const progressPct = Math.min(100, Math.round((checkout.clients_serviced_count / (checkout.target_min_clients || 1)) * 100));
                              const isTargetReached = checkout.clients_serviced_count >= checkout.target_min_clients;

                              return (
                                <div key={checkout.id} className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/70 space-y-2.5">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <span className="inline-block bg-amber-200 text-amber-950 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider mb-1">
                                        In Use by Stylist {stylist.name}
                                      </span>
                                      <h5 className="font-extrabold text-xs text-neutral-900 leading-snug">{checkout.product_name}</h5>
                                    </div>
                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                                      isTargetReached ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                                    }`}>
                                      {isTargetReached ? 'Target Reached' : 'Active Bottle'}
                                    </span>
                                  </div>

                                  {/* Progress bar showing clients serviced vs target */}
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-[11px] font-bold">
                                      <span className="text-neutral-600">Serviced Clients:</span>
                                      <span className={isTargetReached ? 'text-emerald-700' : 'text-neutral-900'}>
                                        {checkout.clients_serviced_count} / {checkout.target_min_clients} Clients
                                      </span>
                                    </div>

                                    <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full transition-all duration-300 ${isTargetReached ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                        style={{ width: `${progressPct}%` }}
                                      />
                                    </div>
                                  </div>

                                  {/* Action Buttons for this checked out bottle */}
                                  <div className="flex items-center space-x-1.5 pt-1 border-t border-neutral-200/50">
                                    <button
                                      onClick={() => onIncrementCheckoutUsage(checkout.id)}
                                      className="flex-1 py-1.5 px-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-[11px] rounded-xl flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                                      title="Record 1 client serviced with this bottle"
                                    >
                                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                                      <span>+1 Client</span>
                                    </button>

                                    <button
                                      onClick={() => onCompleteCheckout(checkout.id, 'Bottle finished')}
                                      className="py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                                      title="Mark bottle empty/finished to allow new checkout"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Finish Bottle</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Footer actions per stylist */}
                      <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
                        <span className="text-neutral-400 text-[11px]">Historical completed: {completedCount}</span>
                        <button
                          onClick={() => handleOpenCheckout(undefined, stylist.id)}
                          className="font-bold text-amber-700 hover:text-amber-900 flex items-center space-x-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Issue Item</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: PRODUCT CATALOG & STOCK TABLE */}
      {subTab === 'catalog' && (
        <div className="space-y-4 animate-fade-in">
          
          {/* Search and Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200/60 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name or unit..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-900"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  typeFilter === 'all' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                All ({products.length})
              </button>
              <button
                onClick={() => setTypeFilter('single_use')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  typeFilter === 'single_use' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                Single-Use Consumables ({products.filter(p => p.category_type === 'single_use').length})
              </button>
              <button
                onClick={() => setTypeFilter('multiple_use')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  typeFilter === 'multiple_use' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                Multi-Use Bottles/Jars ({products.filter(p => p.category_type === 'multiple_use').length})
              </button>
              <button
                onClick={() => setTypeFilter('low_stock')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  typeFilter === 'low_stock' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                }`}
              >
                Low Stock ({lowStockProducts.length})
              </button>
            </div>
          </div>

          {/* Catalog Grid / Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map(p => {
              const isLowStock = p.stock_quantity <= p.low_stock_threshold;
              const isSingleUse = p.category_type === 'single_use';

              return (
                <div 
                  key={p.id}
                  className={`bg-white rounded-2xl border p-5 space-y-3.5 shadow-ios transition-all flex flex-col justify-between ${
                    isLowStock ? 'border-rose-300 bg-rose-50/20' : 'border-neutral-200'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        isSingleUse ? 'bg-sky-100 text-sky-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {isSingleUse ? 'Single-Use (Consumable 1:1)' : `Multi-Use (Min ${p.min_clients_per_unit} Clients)`}
                      </span>

                      {isLowStock ? (
                        <span className="bg-rose-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Low Stock</span>
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          In Stock
                        </span>
                      )}
                    </div>

                    <h4 className="font-extrabold text-neutral-900 text-base">{p.name}</h4>
                    <p className="text-xs text-neutral-500">
                      Category: <strong>{p.category_label || 'Salon Supply'}</strong> • Unit: <strong>{p.unit_name}</strong>
                    </p>
                  </div>

                  <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100 flex items-center justify-between text-xs font-bold">
                    <div>
                      <span className="text-neutral-500 text-[11px] block font-normal">Current Quantity</span>
                      <span className={`text-lg font-black ${isLowStock ? 'text-rose-600' : 'text-neutral-900'}`}>
                        {p.stock_quantity} {p.unit_name}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-neutral-500 text-[11px] block font-normal">Min Threshold</span>
                      <span className="text-neutral-700 font-extrabold">{p.low_stock_threshold} {p.unit_name}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-2 border-t border-neutral-100">
                    <button
                      onClick={() => handleOpenCheckout(p.id)}
                      className="flex-1 py-2 px-3 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span>Issue / Checkout</span>
                    </button>

                    <button
                      onClick={() => {
                        setRestockProduct(p);
                        setRestockQty(5);
                        setShowRestockModal(true);
                      }}
                      className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                      title="Restock units"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Restock</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditProduct(p)}
                      className="p-2 text-neutral-500 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
                      title="Edit Product"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: USAGE ALERTS & RESTRICTIONS ENGINE SUMMARY */}
      {subTab === 'alerts' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-ios space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center font-bold">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-neutral-900">Multi-Use Bottle Restriction Rules Engine</h3>
                <p className="text-xs text-neutral-500">
                  Prevents stylists from checking out duplicate shampoo bottles or jars before completing the minimum expected client usage count.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-2">
                <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span>Rule 1: Active Bottle Lock</span>
                </h4>
                <p className="text-xs text-amber-900 font-medium">
                  If a stylist attempts to check out a bottle of <strong>Multiple-Use Product X</strong> while holding an active bottle with servicing count below minimum (e.g., 2 out of 5 clients serviced), the system blocks the transaction and presents a warning alert.
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-2">
                <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Rule 2: Seamless Re-issuance</span>
                </h4>
                <p className="text-xs text-emerald-900 font-medium">
                  Once the stylist reaches the required client count or explicitly marks the bottle as finished/empty, the system automatically unlocks checkout for a new unit.
                </p>
              </div>
            </div>
          </div>

          {/* Active Flagged Attempts or Log Warnings */}
          <div className="bg-white rounded-3xl border border-neutral-200 p-5 space-y-3">
            <h4 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider">
              Recent Flagged Checkout Warnings & Logs
            </h4>

            {inventoryLogs.filter(l => l.action === 'flagged_attempt').length === 0 ? (
              <p className="text-xs text-neutral-400 py-4 text-center">No flagged checkout violations recorded.</p>
            ) : (
              <div className="space-y-2">
                {inventoryLogs.filter(l => l.action === 'flagged_attempt').map(log => (
                  <div key={log.id} className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <div>
                        <span className="font-bold text-rose-950">{log.product_name}</span>
                        <span className="text-rose-800 ml-2">• {log.details}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-rose-700 font-bold">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 4: AUDIT LOG HISTORY */}
      {subTab === 'audit_log' && (
        <div className="bg-white rounded-3xl border border-neutral-200 p-5 space-y-4 shadow-ios animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-neutral-900 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Inventory & Usage Audit Log History</span>
            </h3>
            <span className="text-xs text-neutral-400 font-medium">{inventoryLogs.length} Records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-400 uppercase text-[10px] font-black">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Action Type</th>
                  <th className="py-2.5 px-3">Stylist / Performed By</th>
                  <th className="py-2.5 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium">
                {inventoryLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-neutral-400">No inventory transactions logged yet.</td>
                  </tr>
                ) : (
                  inventoryLogs.map(log => (
                    <tr key={log.id} className="hover:bg-neutral-50/70">
                      <td className="py-2.5 px-3 text-neutral-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-neutral-900">{log.product_name}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          log.action === 'checkout_single' ? 'bg-sky-100 text-sky-800' :
                          log.action === 'checkout_multi' ? 'bg-amber-100 text-amber-900' :
                          log.action === 'completed_bottle' ? 'bg-emerald-100 text-emerald-800' :
                          log.action === 'flagged_attempt' ? 'bg-rose-100 text-rose-800' :
                          'bg-neutral-100 text-neutral-800'
                        }`}>
                          {log.action.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-neutral-700">{log.stylist_name || 'System / Admin'}</td>
                      <td className="py-2.5 px-3 text-neutral-600">{log.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: CHECKOUT PRODUCT TO STYLIST (WITH MULTI-USE RESTRICTION ALERT ENGINE) */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-neutral-200 max-w-lg w-full p-6 space-y-5 shadow-2xl relative animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-neutral-950 flex items-center justify-center font-bold">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-neutral-900">Checkout Product to Stylist</h3>
                  <p className="text-xs text-neutral-500">Assign single-use consumables or multi-use bottles.</p>
                </div>
              </div>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-full hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* MANDATORY WARNING ALERT IF MULTI-USE RESTRICTION IS TRIPPED */}
            {checkoutWarning && (
              <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-4 space-y-3 shadow-sm animate-pulse-subtle">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">
                      Multi-Use Checkout Restricted
                    </h4>
                    <p className="text-xs font-bold text-amber-900 leading-relaxed">
                      {checkoutWarning}
                    </p>
                  </div>
                </div>

                {/* Quick actions to resolve restriction */}
                <div className="pt-2 border-t border-amber-300/60 flex flex-wrap items-center gap-2">
                  {checkoutBlockedCheckoutId && (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          await onIncrementCheckoutUsage(checkoutBlockedCheckoutId);
                          setCheckoutWarning(null);
                        }}
                        className="text-[11px] bg-neutral-900 hover:bg-neutral-800 text-white font-bold px-3 py-1.5 rounded-xl cursor-pointer"
                      >
                        + Record 1 Client Serviced
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          await onCompleteCheckout(checkoutBlockedCheckoutId, 'Marked empty during checkout attempt');
                          setCheckoutWarning(null);
                        }}
                        className="text-[11px] bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-xl cursor-pointer"
                      >
                        Mark Active Bottle Finished
                      </button>
                    </>
                  )}

                  {!showForceOverrideOption && (
                    <button
                      type="button"
                      onClick={() => setShowForceOverrideOption(true)}
                      className="text-[11px] bg-amber-700 hover:bg-amber-800 text-white font-bold px-3 py-1.5 rounded-xl cursor-pointer ml-auto"
                    >
                      Admin Force Override
                    </button>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handlePerformCheckout} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Select Product / Item
                </label>
                <select
                  value={checkoutProductId}
                  onChange={(e) => {
                    setCheckoutProductId(e.target.value);
                    setCheckoutWarning(null);
                  }}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs font-bold text-neutral-900 focus:outline-none"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category_type === 'single_use' ? 'Single-Use' : `Multi-Use - Min ${p.min_clients_per_unit} Clients`}) - Stock: {p.stock_quantity}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Select Stylist / Staff Member
                </label>
                <select
                  value={checkoutStylistId}
                  onChange={(e) => {
                    setCheckoutStylistId(e.target.value);
                    setCheckoutWarning(null);
                  }}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs font-bold text-neutral-900 focus:outline-none"
                >
                  {allProviders.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional Force Override Reason */}
              {showForceOverrideOption && (
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl space-y-2">
                  <label className="block text-xs font-bold text-rose-950 uppercase tracking-wider">
                    Admin Force Override Reason (Required)
                  </label>
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="e.g., Previous bottle spilled or defective container..."
                    className="w-full bg-white border border-rose-300 rounded-xl py-2 px-3 text-xs text-neutral-900 focus:outline-none"
                    required={showForceOverrideOption}
                  />
                </div>
              )}

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="px-4 py-2 bg-neutral-100 text-neutral-700 font-bold text-xs rounded-xl hover:bg-neutral-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCheckout}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
                >
                  {isSubmittingCheckout ? 'Checking out...' : showForceOverrideOption ? 'Force Issue Bottle' : 'Confirm Checkout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT PRODUCT CATALOG ITEM */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-neutral-200 max-w-lg w-full p-6 space-y-5 shadow-2xl relative animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="font-extrabold text-base text-neutral-900">
                {editingProduct ? 'Edit Product Item' : 'Add New Inventory Product'}
              </h3>
              <button
                onClick={() => setShowProductModal(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-full hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="e.g. 1L Professional Moisture Shampoo"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2 px-3 text-xs font-bold text-neutral-900 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Usage Category Type
                  </label>
                  <select
                    value={prodCategoryType}
                    onChange={(e) => setProdCategoryType(e.target.value as any)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2 px-3 text-xs font-bold text-neutral-900 focus:outline-none"
                  >
                    <option value="multiple_use">Multiple-Use (Bottles/Jars)</option>
                    <option value="single_use">Single-Use (Consumables)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Department Label
                  </label>
                  <select
                    value={prodCategoryLabel}
                    onChange={(e) => setProdCategoryLabel(e.target.value as any)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2 px-3 text-xs font-bold text-neutral-900 focus:outline-none"
                  >
                    <option value="Hair">Hair Care</option>
                    <option value="Nails">Nails</option>
                    <option value="Skin">Skin Care</option>
                    <option value="Massage">Massage</option>
                    <option value="General">General Supply</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Stock Qty
                  </label>
                  <input
                    type="number"
                    value={prodStock}
                    onChange={(e) => setProdStock(Number(e.target.value))}
                    min={0}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2 px-3 text-xs font-bold text-neutral-900 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Unit Name
                  </label>
                  <input
                    type="text"
                    value={prodUnit}
                    onChange={(e) => setProdUnit(e.target.value)}
                    placeholder="bottles, packets..."
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2 px-3 text-xs font-bold text-neutral-900 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Low Stock Threshold
                  </label>
                  <input
                    type="number"
                    value={prodLowThreshold}
                    onChange={(e) => setProdLowThreshold(Number(e.target.value))}
                    min={1}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2 px-3 text-xs font-bold text-neutral-900 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {prodCategoryType === 'multiple_use' && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl space-y-1">
                  <label className="block text-xs font-extrabold text-amber-950 uppercase tracking-wider">
                    Expected Min Clients Serviced Per Bottle/Unit
                  </label>
                  <input
                    type="number"
                    value={prodMinClients}
                    onChange={(e) => setProdMinClients(Number(e.target.value))}
                    min={1}
                    className="w-full bg-white border border-amber-300 rounded-xl py-2 px-3 text-xs font-bold text-neutral-900 focus:outline-none"
                    required
                  />
                  <span className="text-[10px] text-amber-800 font-medium block">
                    Stylists must service at least this many clients before checking out a new bottle of this item.
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 bg-neutral-100 text-neutral-700 font-bold text-xs rounded-xl hover:bg-neutral-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-neutral-900 text-white font-bold text-xs rounded-xl hover:bg-neutral-800 cursor-pointer"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: QUICK RESTOCK PRODUCT */}
      {showRestockModal && restockProduct && (
        <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-neutral-200 max-w-md w-full p-6 space-y-5 shadow-2xl relative animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="font-extrabold text-base text-neutral-900">
                Restock Product: {restockProduct.name}
              </h3>
              <button
                onClick={() => setShowRestockModal(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-full hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="space-y-4">
              <div className="bg-neutral-50 p-3 rounded-2xl text-xs space-y-1">
                <div className="text-neutral-500 font-medium">Current Stock Level:</div>
                <div className="font-extrabold text-neutral-900 text-sm">
                  {restockProduct.stock_quantity} {restockProduct.unit_name}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Quantity to Add ({restockProduct.unit_name})
                </label>
                <input
                  type="number"
                  value={restockQty}
                  onChange={(e) => setRestockQty(Number(e.target.value))}
                  min={1}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2 px-3 text-xs font-bold text-neutral-900 focus:outline-none"
                  required
                />
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowRestockModal(false)}
                  className="px-4 py-2 bg-neutral-100 text-neutral-700 font-bold text-xs rounded-xl hover:bg-neutral-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  Confirm Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
