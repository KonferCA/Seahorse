import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  details?: string;
  onClose: () => void;
}

export function Toast({ message, type = 'info', details, onClose }: ToastProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100, x: 100, scale: 0.8 }}
        animate={{ 
          opacity: 1, 
          y: 0, 
          x: 0, 
          scale: 0.8,
          transition: {
            type: "spring",
            stiffness: 400,
            damping: 25
          }
        }}
        exit={{ 
          opacity: 0, 
          scale: 0.3,
          x: 200,
          y: 100,
          transition: { 
            duration: 0.3,
            ease: [0.4, 0, 0.2, 1], // easeOutQuart for smooth acceleration
            scale: { duration: 0.2 },
            opacity: { duration: 0.2 }
          }
        }}
        whileHover={{ 
          scale: 0.82,
          transition: { duration: 0.2 }
        }}
        className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${
          expanded ? 'max-w-md' : 'max-w-xs'
        } cursor-pointer transition-all duration-200`}
        onClick={() => details && setExpanded(!expanded)}
        style={{
          backgroundColor: type === 'success' ? '#10B981' : 
                          type === 'error' ? '#EF4444' : '#3B82F6'
        }}
      >
        <motion.div 
          className="text-white"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              <motion.span 
                className="mr-2 text-base"
                initial={{ rotate: -180, scale: 0 }}
                animate={{ 
                  rotate: 0, 
                  scale: 1,
                  transition: {
                    type: "spring",
                    stiffness: 400,
                    damping: 20,
                    delay: 0.2
                  }
                }}
              >
                {type === 'success' && '✅'}
                {type === 'error' && '❌'}
                {type === 'info' && 'ℹ️'}
              </motion.span>
              <p className="font-medium text-base whitespace-pre-line leading-snug">{message}</p>
            </div>
            <motion.button 
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="ml-3 hover:text-gray-200 text-base"
              whileHover={{ 
                rotate: 90,
                transition: { duration: 0.2 }
              }}
              whileTap={{ scale: 0.9 }}
            >
              ✕
            </motion.button>
          </div>
          {details && (
            <motion.div 
              initial={false}
              animate={{ 
                height: expanded ? 'auto' : '2.5rem',
                transition: {
                  type: "spring",
                  stiffness: 400,
                  damping: 30
                }
              }}
              className="text-sm opacity-90 overflow-hidden"
            >
              <pre className="whitespace-pre-wrap font-sans">
                {details}
              </pre>
              {!expanded && details.split('\n').length > 2 && (
                <motion.div 
                  className="text-sm mt-1 text-white/70"
                  animate={{
                    opacity: [0.7, 1, 0.7],
                    transition: {
                      duration: 2,
                      repeat: Infinity
                    }
                  }}
                >
                  Click to show more
                </motion.div>
              )}
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
} 