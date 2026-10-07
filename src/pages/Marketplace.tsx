/// <reference types="@types/google.maps" />
// src/pages/Marketplace.tsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { fetchWithRetry } from '../lib/api.ts';
import {
  Search,
  SlidersHorizontal,
  ShoppingCart,
  ShoppingBasket,
  X,
  Minus,
  Plus,
  Trash2,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Store,
  ArrowUpDown,
  Tag,
  Eye,
  Check,
  AlertCircle,
  ArrowRight,
  Play
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { translations } from '../lib/translations.ts';
import { useNotifications } from '../context/NotificationContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import { auth } from '../lib/firebase.ts';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import CategorySidebar from '../components/CategorySidebar.tsx';
import { staggerContainer, fadeInUp, cardHover, buttonHover, scaleIn } from '../lib/animations';

// MarketplaceProductCard component for optimized rendering
const MarketplaceProductCard = React.memo(({ p, addToCart, addedNotice, setQuickViewProduct, t }: any) => {
  const item = p.product;
  const isJustAdded = addedNotice === item.id;
  const productImg =
    item.images?.[0] ||
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600';

  return (
    <motion.div
      layout
      variants={fadeInUp}
      whileHover={cardHover.hover}
      className="group bg-slate-900/85 backdrop-blur-md rounded-[2rem] border border-light-green-border/15 p-4 shadow-xl hover:border-blue-500/50 transition-all flex flex-col justify-between relative text-light-green h-full"
    >
      {/* Product Image & Badges */}
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-800 mb-4 cursor-pointer" onClick={() => { setQuickViewProduct(p); }}>
        <img
          src={productImg}
          className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110"
          alt={item.name}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=400';
          }}
        />
        {/* Verification Badge */}
        {p.seller?.verificationStatus === 'VERIFIED' && (
          <div className="absolute top-3 left-3 bg-emerald-500/90 text-white p-1.5 rounded-full shadow-lg" title="Verified Seller">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-grow flex flex-col justify-between">
        <div>
          <h3 className="font-black text-sm uppercase tracking-tight line-clamp-1 group-hover:text-blue-300 transition-colors">{item.name}</h3>
          <p className="text-slate-400 text-[10px] font-bold uppercase mt-1 flex items-center">
            <Store className="w-3 h-3 mr-1" />
            {p.shop?.name || 'Dreamers Shop'}
          </p>
        </div>

        {/* Price & Action */}
        <div className="flex items-center justify-between mt-4">
          <span className="text-light-green font-black text-xs uppercase">{Number(item.price).toLocaleString()} TZS</span>
          <button
            onClick={() => addToCart(p)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition flex items-center space-x-1.5 cursor-pointer border ${
              isJustAdded 
                ? 'bg-emerald-600 text-white border-emerald-500' 
                : 'bg-slate-800 hover:bg-blue-600 text-white border-slate-700'
            }`}
          >
            {isJustAdded ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ShoppingBasket className="w-3.5 h-3.5" />}
            <span>{isJustAdded ? 'Added' : 'Add'}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
});

export default function Marketplace() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'name'>('featured');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [quickViewProduct, setQuickViewProduct] = useState<any | null>(null);
  const [quickViewVideoError, setQuickViewVideoError] = useState(false);
  const [addedNotice, setAddedNotice] = useState<number | null>(null);

  const { user, dbUser, language } = useAuth();
  const { addToCart: addToGlobalCart, openCart } = useCart();
  const { showToast } = useNotifications();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        fetchWithRetry('/api/products'),
        fetchWithRetry('/api/categories'),
      ]);
      if (prodRes.ok) setProducts(await prodRes.json().catch(() => []));
      if (catRes.ok) setCategories(await catRes.json().catch(() => []));
    } catch (err) {
      console.error('Failed to load marketplace products and categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    addToGlobalCart(product);
    setAddedNotice(product.id);
    // Optimistic UI feedback: Immediate toast
    showToast('Added to Cart', `${product.product.name} added.`, 'success');
    setTimeout(() => setAddedNotice(null), 1800);
  };

  const handleResetFilters = () => {
    setSelectedCategory(null);
    setMinPrice('');
    setMaxPrice('');
    setVerifiedOnly(false);
    setInStockOnly(false);
    setSearch('');
    setDebouncedSearch('');
  };

  const t = translations[language].marketplace;

  // Filter & Sort Products (memoized to avoid recomputation on non-filter state updates)
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const item = p.product;
        const seller = p.seller;
        const matchesSearch =
          debouncedSearch === '' ||
          item.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          item.description.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          (p.shop?.name && p.shop.name.toLowerCase().includes(debouncedSearch.toLowerCase()));

        const matchesCategory = selectedCategory === null || item.categoryId === selectedCategory;

        const priceNum = Number(item.price);
        const minNum = minPrice !== '' ? Number(minPrice) : null;
        const maxNum = maxPrice !== '' ? Number(maxPrice) : null;

        const matchesMin = minNum === null || priceNum >= minNum;
        const matchesMax = maxNum === null || priceNum <= maxNum;

        const matchesVerified = !verifiedOnly || seller?.verificationStatus === 'VERIFIED';
        const matchesStock = !inStockOnly || item.stock > 0;

        return matchesSearch && matchesCategory && matchesMin && matchesMax && matchesVerified && matchesStock;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return Number(a.product.price) - Number(b.product.price);
        if (sortBy === 'price-desc') return Number(b.product.price) - Number(a.product.price);
        if (sortBy === 'name') return a.product.name.localeCompare(b.product.name);
        return b.product.id - a.product.id;
      });
  }, [products, debouncedSearch, selectedCategory, minPrice, maxPrice, verifiedOnly, inStockOnly, sortBy]);

  const selectedCategoryName = useMemo(() => {
    return categories.find((c) => c.id === selectedCategory)?.name;
  }, [categories, selectedCategory]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.4, ease: 'easeOut' }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-light-green">
      {/* Top Search, Header & Mobile Filter Trigger */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-400/30">
                Soko Kuu Tanzania
              </span>
              <span className="text-light-green/70 text-xs font-bold">• 100% Escrow Secured</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-light-green uppercase tracking-tight mt-1 drop-shadow-md">
              {selectedCategoryName ? selectedCategoryName : 'Tanzania Multi-Vendor Marketplace'}
            </h1>
          </motion.div>

          {/* Quick Stats or Actions */}
          <div className="flex items-center space-x-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden flex items-center space-x-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-light-green rounded-2xl font-black text-xs uppercase tracking-tight shadow-lg shadow-blue-500/30 border border-light-green/20"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>{t.filters}</span>
            </motion.button>
          </div>
        </div>

        {/* Search Bar & Sort Options */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="md:col-span-8 relative"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200 w-5 h-5 pointer-events-none" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              className="w-full pl-12 pr-4 py-3.5 bg-blue-600 border border-blue-400 rounded-2xl shadow-xl focus:ring-2 focus:ring-blue-300 focus:border-white outline-none transition-all font-bold text-sm text-white placeholder:text-blue-100"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-200 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </motion.button>
            )}
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="md:col-span-4 flex items-center space-x-2"
          >
            <div className="relative w-full">
              <ArrowUpDown className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-200 w-4 h-4 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full pl-10 pr-8 py-3.5 bg-blue-600 border border-blue-400 rounded-2xl shadow-xl focus:ring-2 focus:ring-blue-300 focus:border-white outline-none text-xs font-black text-white uppercase tracking-tight appearance-none cursor-pointer"
              >
                <option value="featured" className="bg-slate-900 text-white">{t.featured}</option>
                <option value="price-asc" className="bg-slate-900 text-white">{t.priceLowHigh}</option>
                <option value="price-desc" className="bg-slate-900 text-white">{t.priceHighLow}</option>
                <option value="name" className="bg-slate-900 text-white">{t.name}</option>
              </select>
            </div>
          </motion.div>
        </div>

        {/* Active Filter Pills */}
        <AnimatePresence>
          {(selectedCategory !== null || minPrice || maxPrice || verifiedOnly || inStockOnly || search) && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap items-center gap-2 pt-1 overflow-hidden"
            >
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">
                Active Filters:
              </span>
              {selectedCategoryName && (
                <motion.span 
                  layout
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center space-x-1.5 px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-bold rounded-full border border-blue-400/30"
                >
                  <Tag className="w-3 h-3" />
                  <span className="truncate max-w-[200px]">{selectedCategoryName}</span>
                  <button onClick={() => setSelectedCategory(null)} className="hover:text-light-green">
                    <X className="w-3 h-3" />
                  </button>
                </motion.span>
              )}
              {search && (
                <motion.span 
                  layout
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center space-x-1.5 px-3 py-1 bg-light-green/10 text-light-green text-xs font-bold rounded-full border border-light-green-border/15"
                >
                  <span>Keyword: "{search}"</span>
                  <button onClick={() => setSearch('')} className="hover:text-slate-300">
                    <X className="w-3 h-3" />
                  </button>
                </motion.span>
              )}
              {minPrice && (
                <motion.span 
                  layout
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-light-green/10 text-light-green text-xs font-bold rounded-full border border-light-green-border/15"
                >
                  <span>Min: {Number(minPrice).toLocaleString()} TZS</span>
                  <button onClick={() => setMinPrice('')} className="hover:text-slate-300">
                    <X className="w-3 h-3" />
                  </button>
                </motion.span>
              )}
              {maxPrice && (
                <motion.span 
                  layout
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-light-green/10 text-light-green text-xs font-bold rounded-full border border-light-green-border/15"
                >
                  <span>Max: {Number(maxPrice).toLocaleString()} TZS</span>
                  <button onClick={() => setMaxPrice('')} className="hover:text-slate-300">
                    <X className="w-3 h-3" />
                  </button>
                </motion.span>
              )}
              {verifiedOnly && (
                <motion.span 
                  layout
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-full border border-emerald-400/30"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified Only</span>
                  <button onClick={() => setVerifiedOnly(false)} className="hover:text-light-green">
                    <X className="w-3 h-3" />
                  </button>
                </motion.span>
              )}
              {inStockOnly && (
                <motion.span 
                  layout
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-bold rounded-full border border-blue-400/30"
                >
                  <span>In Stock Only</span>
                  <button onClick={() => setInStockOnly(false)} className="hover:text-light-green">
                    <X className="w-3 h-3" />
                  </button>
                </motion.span>
              )}
              <motion.button
                layout
                whileHover={{ scale: 1.05 }}
                onClick={handleResetFilters}
                className="text-xs font-black text-red-400 hover:text-red-300 underline uppercase tracking-tight ml-2"
              >
                {t.clearAll}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Two-Column Layout: Category Sidebar + Product Grid */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Category Sidebar */}
        <CategorySidebar
          categories={categories}
          selectedCategoryId={selectedCategory}
          onSelectCategory={(id) => setSelectedCategory(id)}
          language={language}
          minPrice={minPrice}
          maxPrice={maxPrice}
          onMinPriceChange={(val) => setMinPrice(val)}
          onMaxPriceChange={(val) => setMaxPrice(val)}
          verifiedOnly={verifiedOnly}
          onToggleVerifiedOnly={(val) => setVerifiedOnly(val)}
          inStockOnly={inStockOnly}
          onToggleInStockOnly={(val) => setInStockOnly(val)}
          onResetFilters={handleResetFilters}
          isOpenMobile={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          totalProductsCount={filteredProducts.length}
        />

        {/* Product Grid Area */}
        <div className="flex-grow w-full min-h-[400px]">
          {loading ? (
            <motion.div 
              initial="initial"
              animate="animate"
              variants={staggerContainer(0.05)}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"
            >
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  className="animate-pulse bg-slate-900/80 p-5 rounded-[2rem] border border-light-green-border/10 shadow-xs"
                >
                  <div className="bg-slate-800 aspect-square rounded-2xl mb-4" />
                  <div className="h-4 bg-slate-800 rounded-full w-3/4 mb-2" />
                  <div className="h-4 bg-slate-800 rounded-full w-1/2 mb-4" />
                  <div className="h-10 bg-slate-800 rounded-xl" />
                </motion.div>
              ))}
            </motion.div>
          ) : filteredProducts.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20 bg-slate-900/85 backdrop-blur-md rounded-[2.5rem] border border-dashed border-light-green-border/20 p-8"
            >
              <ShoppingBasket className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-black text-light-green uppercase tracking-tight">{t.noProducts}</h3>
              <p className="text-slate-300 font-medium text-sm mt-1 max-w-md mx-auto">{t.noProductsSub}</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleResetFilters}
                className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-light-green rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/30 transition-all border border-light-green-border/20"
              >
                {t.clearAll}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div 
              layout
              initial="initial"
              animate="animate"
              variants={staggerContainer(0.04)}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"
            >
              {filteredProducts.map((p) => {
                const item = p.product;
                const shop = p.shop;
                const isJustAdded = addedNotice === item.id;
                const productImg =
                  item.images?.[0] ||
                  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600';

                return (
                  <motion.div
                    layout
                    key={item.id}
                    variants={fadeInUp}
                    whileHover={cardHover.hover}
                    className="group bg-slate-900/85 backdrop-blur-md rounded-[2rem] border border-light-green-border/15 p-4 shadow-xl hover:border-blue-500/50 transition-all flex flex-col justify-between relative text-light-green h-full"
                  >
                    {/* Product Image & Badges */}
                    <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-800 mb-4 cursor-pointer" onClick={() => { setQuickViewVideoError(false); setQuickViewProduct(p); }}>
                      <img
                        src={productImg}
                        className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110"
                        alt={item.name}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=400';
                        }}
                      />
                      {item.videoUrl && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors pointer-events-none">
                          <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform">
                            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                      {/* Verified Seller Badge */}
                      {p.seller?.verificationStatus === 'VERIFIED' && (
                        <motion.div 
                          initial={{ x: -10, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          className="absolute top-3 left-3 px-2.5 py-1 bg-emerald-600 text-light-green backdrop-blur-xs rounded-full text-[9px] font-black uppercase tracking-wider flex items-center shadow-xs"
                        >
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          <span>Verified</span>
                        </motion.div>
                      )}

                      {/* Quick View Button on Hover */}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickViewProduct(p);
                        }}
                        className="absolute bottom-3 left-3 px-3 py-1.5 bg-slate-900/90 text-light-green backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-tight flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all shadow-md border border-light-green-border/20"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-400" />
                        <span>{t.viewDetails}</span>
                      </motion.button>

                      {/* Quick Add To Cart Icon */}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => addToCart(item, e)}
                        className={`absolute top-3 right-3 p-2.5 rounded-xl shadow-md transition-all ${
                          isJustAdded
                            ? 'bg-emerald-600 text-light-green'
                            : 'bg-slate-900/90 text-light-green hover:bg-blue-600 backdrop-blur-md border border-light-green-border/20'
                        }`}
                      >
                        {isJustAdded ? (
                          <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }}>
                            <Check className="w-4 h-4" />
                          </motion.div>
                        ) : <ShoppingCart className="w-4 h-4" />}
                      </motion.button>
                    </div>

                    {/* Product Details */}
                    <div className="space-y-2 flex-grow flex flex-col justify-between">
                      <div>
                        {shop?.name && (
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest truncate flex items-center gap-1.5">
                            {shop.logoUrl ? (
                              <img
                                src={shop.logoUrl}
                                alt=""
                                className="w-3.5 h-3.5 rounded-full object-cover shrink-0 border border-blue-400/40"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Store className="w-3 h-3 text-blue-400 shrink-0" />
                            )}
                            <span className="truncate">{shop.name}</span>
                          </p>
                        )}
                        <h3 className="font-bold text-light-green text-sm line-clamp-2 mt-0.5 leading-snug group-hover:text-blue-400 transition-colors">
                          {item.name}
                        </h3>
                      </div>

                      <div className="pt-2 border-t border-light-green-border/10 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Price</p>
                          <p className="text-lg font-black text-blue-400 tracking-tight leading-none">
                            {Number(item.price).toLocaleString()} <span className="text-xs">TZS</span>
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-300 bg-light-green/10 px-2 py-1 rounded-lg border border-light-green-border/10">
                          {item.stock} {t.inStock}
                        </span>
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => addToCart(item)}
                        className={`w-full mt-2 py-3 rounded-xl font-black text-xs uppercase tracking-tight flex items-center justify-center space-x-1.5 transition-all shadow-md ${
                          isJustAdded
                            ? 'bg-emerald-600 text-light-green'
                            : 'bg-blue-600 hover:bg-blue-700 text-light-green shadow-blue-500/25 border border-light-green-border/20'
                        }`}
                      >
                        {isJustAdded ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>{t.added}</span>
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-4 h-4" />
                            <span>{t.addToCart}</span>
                          </>
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </div>

      {/* Floating Action Buttons: Cart */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end space-y-3 z-50">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={openCart}
          className="bg-light-green text-slate-900 p-4 rounded-2xl shadow-2xl border border-light-green-border flex items-center space-x-2 transition-all relative"
        >
          <ShoppingCart className="w-5 h-5 text-blue-600" />
          <span className="font-black text-xs uppercase tracking-tight hidden sm:inline">Cart</span>
        </motion.button>
      </div>

      {/* Quick View Product Modal */}
      <AnimatePresence>
        {quickViewProduct && (
          <div className="fixed inset-0 z-[130] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQuickViewProduct(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-light-green w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col md:flex-row max-h-[90dvh] overflow-y-auto my-auto"
            >
              <button
                onClick={() => setQuickViewProduct(null)}
                className="absolute top-4 right-4 z-20 p-2 bg-light-green/80 backdrop-blur-xs rounded-full text-slate-600 hover:text-slate-900 border border-light-green-border cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="md:w-1/2 aspect-square md:aspect-auto bg-light-green relative group/media shrink-0">
                {quickViewProduct.product.videoUrl && !quickViewVideoError ? (
                  <video
                    src={quickViewProduct.product.videoUrl}
                    className="w-full h-full object-cover"
                    controls
                    playsInline
                    muted
                    autoPlay
                    onError={() => setQuickViewVideoError(true)}
                  />
                ) : (
                  <img
                    src={
                      quickViewProduct.product.images?.[0] ||
                      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800'
                    }
                    alt={quickViewProduct.product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800';
                    }}
                  />
                )}
              </div>

              <div className="md:w-1/2 p-6 sm:p-8 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                    {quickViewProduct.shop?.logoUrl ? (
                      <img
                        src={quickViewProduct.shop.logoUrl}
                        alt=""
                        className="w-4 h-4 rounded-full object-cover shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Store className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{quickViewProduct.shop?.name || 'Tanzanian Seller'}</span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    {quickViewProduct.product.name}
                  </h2>
                  <p className="text-2xl font-black text-blue-600 tracking-tight">
                    {Number(quickViewProduct.product.price).toLocaleString()} TZS
                  </p>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {quickViewProduct.product.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Stock:</span>
                    <span className="font-bold text-slate-800">
                      {quickViewProduct.product.stock} units available
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      addToCart(quickViewProduct.product);
                      setQuickViewProduct(null);
                    }}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-light-green rounded-2xl font-black uppercase tracking-tight text-xs flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/20 transition-all"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>{t.addToCart}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
