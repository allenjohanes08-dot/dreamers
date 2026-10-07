// src/components/CategorySidebar.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { staggerContainer, fadeInUp, listItem } from '../lib/animations';
import {
  Layers,
  Sprout,
  Palette,
  Shirt,
  Smartphone,
  Coffee,
  Hammer,
  Wrench,
  Sofa,
  Sparkles,
  CheckCircle2,
  SlidersHorizontal,
  X,
  ChevronRight,
  ShieldCheck,
  PackageCheck,
  RotateCcw,
  Store
} from 'lucide-react';

export interface CategoryItem {
  id: number;
  name: string;
  description?: string | null;
  icon?: string | null;
  productCount?: number;
}

interface CategorySidebarProps {
  categories: CategoryItem[];
  selectedCategoryId: number | null;
  onSelectCategory: (id: number | null) => void;
  language: 'en' | 'sw';
  minPrice: string;
  maxPrice: string;
  onMinPriceChange: (val: string) => void;
  onMaxPriceChange: (val: string) => void;
  verifiedOnly: boolean;
  onToggleVerifiedOnly: (val: boolean) => void;
  inStockOnly: boolean;
  onToggleInStockOnly: (val: boolean) => void;
  onResetFilters: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  totalProductsCount: number;
}

// Map sector name to distinctive icon and Swahili/English translation helpers
const getSectorIcon = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('kilimo') || lower.includes('agri') || lower.includes('mazao') || lower.includes('farm')) {
    return <Sprout className="w-5 h-5 text-emerald-600" />;
  }
  if (lower.includes('sanaa') || lower.includes('craft') || lower.includes('art') || lower.includes('ufundi')) {
    return <Palette className="w-5 h-5 text-amber-600" />;
  }
  if (lower.includes('mavazi') || lower.includes('fashion') || lower.includes('cloth') || lower.includes('kitenge')) {
    return <Shirt className="w-5 h-5 text-pink-600" />;
  }
  if (lower.includes('elektroniki') || lower.includes('tech') || lower.includes('phone') || lower.includes('vifaa')) {
    return <Smartphone className="w-5 h-5 text-blue-600" />;
  }
  if (lower.includes('chakula') || lower.includes('food') || lower.includes('spice') || lower.includes('viungo') || lower.includes('coffee') || lower.includes('kahawa')) {
    return <Coffee className="w-5 h-5 text-orange-600" />;
  }
  if (lower.includes('ujenzi') || lower.includes('build') || lower.includes('construction') || lower.includes('hardware')) {
    return <Hammer className="w-5 h-5 text-stone-700" />;
  }
  if (lower.includes('magari') || lower.includes('auto') || lower.includes('spare') || lower.includes('vipuri') || lower.includes('pikipiki')) {
    return <Wrench className="w-5 h-5 text-indigo-600" />;
  }
  if (lower.includes('samani') || lower.includes('furnitur') || lower.includes('nyumbani') || lower.includes('home')) {
    return <Sofa className="w-5 h-5 text-purple-600" />;
  }
  return <Sparkles className="w-5 h-5 text-blue-600" />;
};

export default function CategorySidebar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  language,
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
  verifiedOnly,
  onToggleVerifiedOnly,
  inStockOnly,
  onToggleInStockOnly,
  onResetFilters,
  isOpenMobile,
  onCloseMobile,
  totalProductsCount,
}: CategorySidebarProps) {
  const [searchSector, setSearchSector] = useState('');

  const t = {
    en: {
      sectorsTitle: 'Tanzania Business Sectors',
      sectorsSub: 'Explore certified local vendors',
      allSectors: 'All Business Sectors',
      searchSectorPlaceholder: 'Filter sectors...',
      filtersTitle: 'Price & Verification',
      priceRange: 'Price Range (TZS)',
      minPrice: 'Min Price',
      maxPrice: 'Max Price',
      verifiedOnly: 'Verified Tanzanian Sellers',
      verifiedSub: 'Only show shops with official verification',
      inStockOnly: 'In Stock Only',
      inStockSub: 'Ready for immediate dispatch',
      resetAll: 'Reset All Filters',
      close: 'Close Filters',
      productsFound: 'Products Available',
    },
    sw: {
      sectorsTitle: 'Sekta za Biashara Tanzania',
      sectorsSub: 'Vinjari wauzaji walioidhinishwa',
      allSectors: 'Sekta Zote za Biashara',
      searchSectorPlaceholder: 'Tafuta sekta...',
      filtersTitle: 'Bei & Uhakiki wa Muuzaji',
      priceRange: 'Kiwango cha Bei (TZS)',
      minPrice: 'Bei ya Chini',
      maxPrice: 'Bei ya Juu',
      verifiedOnly: 'Wauzaji Waliohakikiwa Pekee',
      verifiedSub: 'Onyesha maduka yaliyothibitishwa',
      inStockOnly: 'Bidhaa Zilizo Stoo Pekee',
      inStockSub: 'Tayari kusafirishwa haraka',
      resetAll: 'Weka Upya Vichujio',
      close: 'Funga Vichujio',
      productsFound: 'Bidhaa Zinazopatikana',
    },
  }[language];

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchSector.toLowerCase())
  );

  const sidebarContent = (
    <motion.div 
      initial="initial"
      animate="animate"
      variants={staggerContainer(0.05)}
      className="space-y-6"
    >
      {/* Header / Total Count */}
      <motion.div variants={fadeInUp} className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-3xl text-light-green shadow-xl shadow-blue-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-light-green/10 rounded-full -mr-12 -mt-12 blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-light-green/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-2">
            <Layers className="w-3.5 h-3.5" />
            <span>DREAMERS TZ</span>
          </div>
          <h3 className="text-xl font-black uppercase tracking-tight leading-tight">
            {t.sectorsTitle}
          </h3>
          <p className="text-xs text-blue-100 font-medium mt-1">{t.sectorsSub}</p>

          <div className="mt-4 pt-3 border-t border-light-green-border/20 flex items-center justify-between text-xs">
            <span className="text-blue-100 font-bold">{t.productsFound}</span>
            <span className="font-black bg-light-green text-blue-900 px-2.5 py-0.5 rounded-full text-xs shadow-xs">
              {totalProductsCount}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Sector Search & List */}
      <motion.div variants={fadeInUp} className="bg-slate-900/90 backdrop-blur-md p-5 rounded-3xl border border-light-green-border/15 shadow-xl space-y-4 text-light-green">
        <div className="flex items-center justify-between pb-2 border-b border-light-green-border/10">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center">
            <Store className="w-4 h-4 mr-2 text-blue-400" />
            {t.allSectors}
          </h4>
          {selectedCategoryId !== null && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelectCategory(null)}
              className="text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest flex items-center"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </motion.button>
          )}
        </div>

        {categories.length > 5 && (
          <input
            type="text"
            value={searchSector}
            onChange={(e) => setSearchSector(e.target.value)}
            placeholder={t.searchSectorPlaceholder}
            className="w-full px-3.5 py-2.5 bg-blue-600 border border-blue-400 rounded-xl text-xs font-bold text-white placeholder:text-blue-100 outline-none focus:ring-2 focus:ring-blue-300 focus:border-white shadow-sm"
          />
        )}

        {/* Categories Menu List */}
        <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
          {/* "All Sectors" button */}
          <motion.button
            whileHover={{ x: 4 }}
            onClick={() => {
              onSelectCategory(null);
              onCloseMobile();
            }}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all font-bold text-xs ${
              selectedCategoryId === null
                ? 'bg-blue-600 text-light-green shadow-lg shadow-blue-500/30 font-black border border-blue-400'
                : 'bg-slate-800/60 hover:bg-slate-800 text-slate-200 hover:text-light-green border border-light-green-border/10'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  selectedCategoryId === null ? 'bg-light-green/20 text-light-green' : 'bg-slate-700 shadow-xs text-blue-400'
                }`}
              >
                <Layers className="w-4 h-4" />
              </div>
              <span className="truncate">{t.allSectors}</span>
            </div>
            {selectedCategoryId === null ? (
              <CheckCircle2 className="w-4 h-4 text-light-green shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            )}
          </motion.button>

          {filteredCategories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <motion.button
                key={cat.id}
                whileHover={{ x: 4 }}
                onClick={() => {
                  onSelectCategory(cat.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all font-bold text-xs group ${
                  isSelected
                    ? 'bg-blue-600 text-light-green shadow-lg shadow-blue-500/30 font-black border border-blue-400'
                    : 'bg-slate-800/60 hover:bg-slate-800 text-slate-200 hover:text-light-green border border-light-green-border/10'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0 pr-2">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-light-green/20' : 'bg-slate-700 shadow-xs'
                    }`}
                  >
                    {getSectorIcon(cat.name)}
                  </div>
                  <span className="truncate">{cat.name}</span>
                </div>
                {isSelected ? (
                  <CheckCircle2 className="w-4 h-4 text-light-green shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-400 shrink-0" />
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Advanced Filters: Price & Verification */}
      <motion.div variants={fadeInUp} className="bg-slate-900/90 backdrop-blur-md p-5 rounded-3xl border border-light-green-border/15 shadow-xl space-y-5 text-light-green">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center">
          <SlidersHorizontal className="w-4 h-4 mr-2 text-blue-400" />
          {t.filtersTitle}
        </h4>

        {/* Price Range */}
        <div className="space-y-2.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
            {t.priceRange}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <input
                type="number"
                placeholder={t.minPrice}
                value={minPrice}
                onChange={(e) => onMinPriceChange(e.target.value)}
                className="w-full px-3 py-2.5 bg-blue-600 border border-blue-400 rounded-xl text-xs font-bold text-white placeholder:text-blue-100 outline-none focus:ring-2 focus:ring-blue-300 focus:border-white shadow-sm"
              />
            </div>
            <div>
              <input
                type="number"
                placeholder={t.maxPrice}
                value={maxPrice}
                onChange={(e) => onMaxPriceChange(e.target.value)}
                className="w-full px-3 py-2.5 bg-blue-600 border border-blue-400 rounded-xl text-xs font-bold text-white placeholder:text-blue-100 outline-none focus:ring-2 focus:ring-blue-300 focus:border-white shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Filter Toggles */}
        <div className="space-y-3 pt-2 border-t border-light-green-border/10">
          {/* Verified Sellers Toggle */}
          <label className="flex items-start justify-between cursor-pointer group">
            <div className="pr-3">
              <div className="flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200 group-hover:text-blue-400">
                  {t.verifiedOnly}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">{t.verifiedSub}</p>
            </div>
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => onToggleVerifiedOnly(e.target.checked)}
              className="w-4 h-4 accent-blue-600 text-blue-600 rounded-md focus:ring-blue-400 border-blue-400 bg-blue-600 mt-1 cursor-pointer"
            />
          </label>

          {/* In Stock Only Toggle */}
          <label className="flex items-start justify-between cursor-pointer group">
            <div className="pr-3">
              <div className="flex items-center space-x-1.5">
                <PackageCheck className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-slate-200 group-hover:text-blue-400">
                  {t.inStockOnly}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">{t.inStockSub}</p>
            </div>
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => onToggleInStockOnly(e.target.checked)}
              className="w-4 h-4 accent-blue-600 text-blue-600 rounded-md focus:ring-blue-400 border-blue-400 bg-blue-600 mt-1 cursor-pointer"
            />
          </label>
        </div>

        {/* Reset Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onResetFilters}
          className="w-full py-3 bg-light-green/10 hover:bg-light-green/20 text-slate-200 hover:text-light-green rounded-2xl text-xs font-black uppercase tracking-tight transition-all flex items-center justify-center space-x-2 border border-light-green-border/10"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t.resetAll}</span>
        </motion.button>
      </motion.div>
    </motion.div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:block w-72 shrink-0 sticky top-24 self-start">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop and Modal */}
      <AnimatePresence>
        {isOpenMobile && (
          <div className="fixed inset-0 z-[120] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
              onClick={onCloseMobile}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed inset-y-0 left-0 max-w-xs w-full bg-slate-950 p-6 shadow-2xl z-[130] overflow-y-auto flex flex-col justify-between border-r border-white/10"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="text-sm font-black uppercase text-light-green tracking-tight flex items-center">
                    <SlidersHorizontal className="w-4 h-4 mr-2 text-blue-400" />
                    {t.sectorsTitle}
                  </span>
                  <button
                    onClick={onCloseMobile}
                    className="p-2 rounded-xl bg-white/5 text-slate-300 hover:text-light-green border border-white/10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {sidebarContent}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onCloseMobile}
                className="mt-6 w-full py-4 bg-blue-600 text-light-green rounded-2xl font-black uppercase tracking-tight shadow-lg shadow-blue-500/20"
              >
                {t.close}
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
