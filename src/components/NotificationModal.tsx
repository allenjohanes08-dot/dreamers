// src/components/NotificationModal.tsx
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, CheckCheck, Trash2, Info, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext.tsx';
import { staggerContainer, listItem, scaleIn } from '../lib/animations';

export default function NotificationModal() {
  const { notifications, isOpen, setIsOpen, markAllAsRead, clearNotifications, markAsRead } = useNotifications();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsOpen(false)}
          className="absolute inset-0 bg-gray-900/60 backdrop-blur-xs"
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="bg-white rounded-lg shadow-2xl border border-gray-200 w-full max-w-lg relative z-10 overflow-hidden flex flex-col max-h-[85dvh]"
        >
          {/* Header */}
          <div className="p-6 bg-amazon-navy text-white flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/10 border border-white/10 rounded-lg flex items-center justify-center">
                <Bell className="w-5 h-5 text-amazon-orange" />
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-tight">Platform Notifications</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                  System Alerts & Updates
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/10 text-white rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Bar */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-xs font-bold text-gray-600">
            <button
              onClick={markAllAsRead}
              className="flex items-center space-x-1 hover:text-amazon-blue transition-colors"
            >
              <CheckCheck className="w-4 h-4 text-amazon-blue" />
              <span>Mark all read</span>
            </button>
            <button
              onClick={clearNotifications}
              className="flex items-center space-x-1 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear all</span>
            </button>
          </div>

          {/* Notifications List */}
          <div className="p-6 overflow-y-auto flex-grow divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <motion.div 
                variants={scaleIn}
                className="text-center py-12"
              >
                <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  No notifications
                </p>
              </motion.div>
            ) : (
              <motion.div 
                initial="initial"
                animate="animate"
                variants={staggerContainer(0.05)}
                className="space-y-3"
              >
                <AnimatePresence mode="popLayout">
                  {notifications.map((n) => {
                    const Icon =
                      n.type === 'success'
                        ? CheckCircle2
                        : n.type === 'warning'
                        ? AlertTriangle
                        : n.type === 'error'
                        ? AlertCircle
                        : Info;

                    const colorClass =
                      n.type === 'success'
                        ? 'text-green-600 bg-green-50'
                        : n.type === 'warning'
                        ? 'text-amber-600 bg-amber-50'
                        : n.type === 'error'
                        ? 'text-red-600 bg-red-50'
                        : 'text-amazon-blue bg-blue-50';

                    return (
                      <motion.div
                        layout
                        variants={listItem}
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`pt-3 first:pt-0 flex items-start space-x-3 cursor-pointer group ${
                          !n.read ? 'opacity-100' : 'opacity-70'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${colorClass} shrink-0 mt-0.5 border border-transparent group-hover:border-current/10 transition-all`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-grow min-w-0 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-gray-900 text-xs truncate group-hover:text-amazon-blue transition-colors">
                              {n.title}
                            </h4>
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-amazon-orange shrink-0 ml-2 shadow-sm" />
                            )}
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed font-medium">
                            {n.message}
                          </p>
                          <p className="text-[10px] text-gray-400 font-bold">
                            {new Date(n.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
