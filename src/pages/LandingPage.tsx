// src/pages/LandingPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { fetchWithRetry } from '../lib/api.ts';
import {
  ShoppingBasket,
  Truck,
  ShieldCheck,
  Zap,
  ArrowRight,
  Star,
  Globe,
  TrendingUp,
  Users,
  Store,
  ShoppingBag,
  Search,
  CheckCircle2,
  Tag,
  Sparkles,
  Layers,
  ShoppingCart,
  Download,
  Play
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import { useNotifications } from '../context/NotificationContext.tsx';
import { translations } from '../lib/translations.ts';
import { staggerContainer, fadeInUp, scaleIn, buttonHover, listItem } from '../lib/animations';

export default function LandingPage() {
  const { language } = useAuth();
  const { addToCart, openCart } = useCart();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [activeSector, setActiveSector] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const t = translations[language].landingPage;

  useEffect(() => {
    fetchLiveProducts();
  }, []);

  const fetchLiveProducts = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        fetchWithRetry('/api/products?limit=12'),
        fetchWithRetry('/api/categories'),
      ]);
      if (prodRes.ok) setProducts(await prodRes.json());
      if (catRes.ok) setCategories(await catRes.json());
    } catch (e) {
      console.error('Failed to fetch front page products', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/marketplace?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/marketplace');
    }
  };

  const displayedProducts = useMemo(() => {
    return products.filter((p) => {
      if (activeSector === null) return true;
      return p.product.categoryId === activeSector;
    });
  }, [products, activeSector]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5, ease: 'easeOut' }
    }
  };

  return (
    <div className="flex flex-col bg-transparent overflow-x-hidden text-light-green">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Animated Background Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/40 via-transparent to-slate-950/60 z-0" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full pt-20 pb-16">
          <div className="max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center space-x-2 px-3 py-1 bg-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.3em] rounded-full mb-8 border border-primary/20 backdrop-blur-md shadow-xl"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.slogan}</span>
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-6xl sm:text-8xl md:text-[9.5rem] font-black text-white leading-[0.85] uppercase tracking-tighter mb-8"
            >
              {t.headline.split(' ').map((word, i) => (
                <span key={i} className="inline-block mr-4">
                  {word.toLowerCase() === 'dreams.' ? <span className="text-primary">{word}</span> : word}
                </span>
              ))}
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-xl sm:text-2xl text-slate-200 font-medium leading-relaxed max-w-2xl mb-12 drop-shadow-lg"
            >
              {t.subheadline}
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="flex flex-col sm:flex-row items-center gap-5"
            >
              <Link
                to="/register"
                className="w-full sm:w-auto px-12 py-5.5 bg-primary text-slate-900 rounded-2xl font-black uppercase tracking-tight text-center hover:bg-emerald-50 transition-all shadow-2xl shadow-primary/30 text-lg hover:scale-105 active:scale-95"
              >
                {t.registerBtn}
              </Link>
              <button
                onClick={() => {
                  const target = document.getElementById('marketplace-showcase');
                  if (target) target.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-12 py-5.5 bg-white/5 backdrop-blur-xl text-white border border-white/20 rounded-2xl font-black uppercase tracking-tight text-center hover:bg-white/10 transition-all text-lg hover:scale-105 active:scale-95"
              >
                {t.buyNow}
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FRONT-SCREEN PRODUCTS SHOWCASE BEFORE REGISTRATION */}
      <section id="marketplace-showcase" className="py-20 bg-slate-950/75 backdrop-blur-md border-y border-light-green/10 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeInUp}
            className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10"
          >
            <div>
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-widest rounded-full mb-3 border border-blue-400/30">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Immediate Access • No Account Required to Browse</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-light-green uppercase tracking-tight">
                {t.frontProductsTitle}
              </h2>
              <p className="text-light-green/70 font-medium text-sm mt-1 max-w-xl">
                {t.frontProductsSub}
              </p>
            </div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                to="/marketplace"
                className="inline-flex items-center space-x-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-light-green rounded-2xl text-xs font-black uppercase tracking-tight shadow-lg shadow-blue-500/25 transition-all self-start md:self-auto border border-light-green/20"
              >
                <span>{t.viewAllProducts}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </motion.div>

          {/* Sector Filter Chips on Home Screen */}
          {categories.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex items-center space-x-2 overflow-x-auto pb-6 no-scrollbar"
            >
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveSector(null)}
                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                  activeSector === null
                    ? 'bg-blue-600 text-light-green shadow-md shadow-blue-500/30 border border-blue-400'
                    : 'bg-slate-900/80 backdrop-blur-md text-light-green/70 hover:text-light-green border border-light-green/10'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{t.allSectors}</span>
              </motion.button>
              {categories.map((cat) => (
                <motion.button
                  key={cat.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveSector(cat.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                    activeSector === cat.id
                      ? 'bg-blue-600 text-light-green shadow-md shadow-blue-500/30 border border-blue-400'
                      : 'bg-slate-900/80 backdrop-blur-md text-light-green/70 hover:text-light-green border border-light-green/10'
                  }`}
                >
                  <Tag className="w-3 h-3 text-blue-400" />
                  <span>{cat.name.split('(')[0].trim()}</span>
                </motion.button>
              ))}
            </motion.div>
          )}

          {/* Products Grid right on front screen */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse bg-slate-900/80 p-4 rounded-3xl border border-light-green-border/10">
                  <div className="bg-slate-800 aspect-square rounded-2xl mb-4" />
                  <div className="h-4 bg-slate-800 rounded-full w-3/4 mb-2" />
                  <div className="h-4 bg-slate-800 rounded-full w-1/2 mb-4" />
                  <div className="h-10 bg-slate-800 rounded-xl" />
                </div>
              ))}
            </div>
          ) : displayedProducts.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 bg-slate-900/80 backdrop-blur-md rounded-3xl border border-dashed border-light-green-border/20 p-8"
            >
              <ShoppingBasket className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-300 font-bold text-sm">
                No products found in this sector yet.
              </p>
              <Link
                to="/marketplace"
                className="mt-4 inline-block text-xs font-black text-blue-400 underline uppercase tracking-wider"
              >
                Browse all marketplace items
              </Link>
            </motion.div>
          ) : (
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={containerVariants}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
            >
              {displayedProducts.slice(0, 8).map((p) => {
                const item = p.product;
                const shop = p.shop;
                const img =
                  item.images?.[0] ||
                  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=500';

                return (
                  <motion.div
                    key={item.id}
                    variants={itemVariants}
                    whileHover={{ y: -8, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}
                    className="bg-[#1a2230] rounded-2xl border border-gray-800 p-4.5 shadow-xl hover:border-orange-500/40 transition-all flex flex-col justify-between group h-full"
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-800 mb-3.5">
                      <img
                        src={img}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=400';
                        }}
                      />
                      {item.videoUrl && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                          <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform">
                            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                      )}
                      {p.seller?.verificationStatus === 'VERIFIED' && (
                        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-orange-500 text-white rounded-md text-[8px] font-black uppercase tracking-wider flex items-center shadow-md">
                          <ShieldCheck className="w-2.5 h-2.5 mr-1" />
                          <span>Prime Seller</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2.5 flex-grow flex flex-col justify-between">
                      <div>
                        {shop?.name && (
                          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider truncate">
                            {shop.name}
                          </p>
                        )}
                        <h3 className="font-bold text-white text-xs sm:text-sm line-clamp-2 mt-0.5 leading-snug group-hover:text-orange-400 transition-colors">
                          {item.name}
                        </h3>
                        
                        {/* Amazon Ratings */}
                        <div className="flex items-center space-x-1 mt-1">
                          <div className="flex text-amber-400 text-xs">
                            ★ ★ ★ ★ ★
                          </div>
                          <span className="text-[10px] text-gray-400 font-bold">(142)</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-800 flex flex-col gap-1">
                        <div className="flex items-baseline justify-between">
                          <p className="text-base font-black text-white leading-none">
                            {Number(item.price).toLocaleString()} <span className="text-[10px] font-bold">TZS</span>
                          </p>
                          <span className="text-[10px] font-bold text-gray-400 bg-slate-900 px-2 py-0.5 rounded">
                            {item.stock} left
                          </span>
                        </div>
                        {/* Amazon Prime Delivery Note */}
                        <div className="flex items-center space-x-1 mt-0.5">
                          <span className="text-[9px] font-black text-sky-400 bg-sky-950 px-1 py-0.5 rounded uppercase tracking-widest scale-90 origin-left">Prime</span>
                          <p className="text-[10px] font-bold text-gray-300">Eligible for FREE Delivery</p>
                        </div>
                      </div>

                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <button
                          type="button"
                          onClick={() => {
                            addToCart(item);
                            openCart();
                            showToast('Mkokoteni / Cart', `${item.name} imeongezwa kwenye mkokoteni!`, 'success');
                          }}
                          className="w-full mt-2 py-2.5 bg-[#ffd814] hover:bg-[#f7ca00] active:bg-[#f2c200] text-[#0f1111] border border-[#a88734] rounded-full font-black text-xs uppercase tracking-tight flex items-center justify-center space-x-1.5 transition-colors shadow-sm cursor-pointer"
                        >
                          <ShoppingCart className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Add to Cart</span>
                        </button>
                      </motion.div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </section>

          {/* Stats Section */}
      <section className="py-20 bg-slate-900/65 backdrop-blur-md relative border-b border-light-green-border/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-50px' }}
            variants={staggerContainer(0.1)}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12"
          >
            {[
              { label: 'Active Buyers', val: '25K+', icon: Users },
              { label: 'Verified Sellers', val: '5K+', icon: Store },
              { label: 'Daily Orders', val: '1.2K+', icon: ShoppingBasket },
              { label: 'Regions Covered', val: '31', icon: Globe },
            ].map((stat, i) => (
              <motion.div key={i} variants={fadeInUp} className="flex flex-col items-center text-center group">
                <motion.div 
                  whileHover={{ scale: 1.1, rotate: 5, backgroundColor: 'rgba(59, 130, 246, 0.2)' }}
                  className="w-14 h-14 bg-light-green/10 border border-light-green/20 rounded-2xl flex items-center justify-center mb-4 shadow-md transition-colors group-hover:border-blue-400/50"
                >
                  <stat.icon className="w-6 h-6 text-blue-400" />
                </motion.div>
                <p className="text-3xl font-black text-light-green tracking-tight leading-none">{stat.val}</p>
                <p className="text-[10px] font-black text-light-green/60 uppercase tracking-widest mt-2">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Why Dreamers Features */}
      <section className="py-24 bg-slate-950/70 backdrop-blur-md relative border-b border-light-green-border/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-black text-light-green tracking-tighter uppercase">
              {t.whyTitle}
            </h2>
            <p className="mt-3 text-base sm:text-lg text-slate-300 font-medium max-w-2xl mx-auto leading-relaxed">
              {t.whySub}
            </p>
          </motion.div>

          <motion.div 
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer(0.1)}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {[
              {
                title: t.feature1,
                desc: t.feature1Desc,
                icon: ShoppingBasket,
                color: 'bg-blue-600 text-light-green',
              },
              {
                title: t.feature2,
                desc: t.feature2Desc,
                icon: Truck,
                color: 'bg-indigo-600 text-light-green',
              },
              {
                title: t.feature3,
                desc: t.feature3Desc,
                icon: Zap,
                color: 'bg-purple-600 text-light-green',
              },
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                variants={fadeInUp}
                whileHover={{ y: -10, backgroundColor: 'rgba(30, 41, 59, 0.95)', borderColor: 'rgba(59, 130, 246, 0.4)' }}
                className="bg-slate-900/85 backdrop-blur-md p-8 sm:p-10 rounded-[2.5rem] shadow-xl border border-light-green-border/15 relative overflow-hidden group transition-colors duration-300"
              >
                <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500" />
                <motion.div
                  whileHover={{ rotate: 10, scale: 1.1 }}
                  className={`${feature.color} w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-xl border border-light-green-border/20`}
                >
                  <feature.icon className="w-7 h-7" />
                </motion.div>
                <h3 className="text-xl font-black text-light-green mb-2 tracking-tight uppercase">
                  {feature.title}
                </h3>
                <p className="text-slate-300 text-sm font-medium leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-transparent px-4">
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto bg-slate-900/90 backdrop-blur-md rounded-[3.5rem] p-10 sm:p-16 relative overflow-hidden text-center sm:text-left border border-light-green-border/20 shadow-2xl"
        >
          <div className="absolute top-0 right-0 w-[60%] h-full bg-blue-600 rounded-l-full translate-x-[40%] opacity-25 blur-[100px]" />
          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-10">
            <div className="max-w-xl">
              <h2 className="text-3xl sm:text-5xl font-black text-light-green tracking-tighter leading-[0.95] mb-4 uppercase">
                {t.registerCta}
              </h2>
              <p className="text-slate-300 font-medium text-base leading-relaxed">
                {t.registerCtaSub}
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full sm:w-auto">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  to="/register"
                  className="block bg-light-green text-slate-900 px-8 py-4 rounded-2xl font-black uppercase tracking-tight text-center hover:bg-emerald-50 transition-all shadow-xl text-sm"
                >
                  {t.registerBtn}
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <a
                  href="/dreamers-heritage.apk"
                  download="dreamers-heritage.apk"
                  className="block bg-light-green/10 text-light-green px-8 py-4 rounded-2xl font-black uppercase tracking-tight text-center border border-light-green-border/30 hover:bg-light-green/20 transition-all text-sm cursor-pointer"
                >
                  {t.downloadApp}
                </a>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950/90 backdrop-blur-md py-16 border-t border-light-green/10 text-light-green">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2">
            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="flex items-center space-x-3 mb-6"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center border border-light-green/20">
                <ShoppingBag className="text-light-green w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black text-light-green tracking-tighter leading-tight uppercase">
                  Dreamers
                </span>
                <span className="text-[9px] font-black text-blue-400 tracking-widest uppercase -mt-1">
                  Tanzania
                </span>
              </div>
            </motion.div>
            <p className="text-light-green/60 font-medium text-sm max-w-sm">
              DREAMERS is Tanzania's premier digital multi-vendor marketplace. Empowering local
              business, connecting the nation.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-black text-light-green uppercase tracking-[0.2em] mb-6">Platform</h4>
            <ul className="space-y-3 font-bold text-light-green/70 text-xs">
              <li>
                <Link to="/marketplace" className="hover:text-blue-400 transition-colors">
                  Marketplace
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-blue-400 transition-colors">
                  Sell on Dreamers
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-black text-light-green uppercase tracking-[0.2em] mb-6">Info</h4>
            <p className="text-xs text-light-green/60 font-medium leading-relaxed">
              Kariakoo, Dar es Salaam, Tanzania
              <br />
              Slogan: <strong className="text-light-green/80">KARIBU TUONGEE BIASHARA</strong>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
