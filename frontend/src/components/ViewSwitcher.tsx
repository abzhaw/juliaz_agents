import { useLocation, useNavigate } from 'react-router';
import { LayoutDashboard, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export function ViewSwitcher() {
    const location = useLocation();
    const navigate = useNavigate();

    const isDevView = location.pathname.startsWith('/dev') || location.pathname.startsWith('/architecture');

    const toggleView = () => {
        if (isDevView) {
            navigate('/');
        } else {
            navigate('/dev');
        }
    };

    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleView}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg backdrop-blur-md transition-all border ${isDevView
                    ? "bg-blue-900/30 border-blue-500/30 text-blue-100 hover:bg-blue-800/50 hover:border-blue-400/50"
                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                }`}
        >
            {isDevView ? (
                <>
                    <MessageCircle size={18} />
                    <span className="text-sm font-medium tracking-wide">User View</span>
                </>
            ) : (
                <>
                    <LayoutDashboard size={18} />
                    <span className="text-sm font-medium tracking-wide">Dev View</span>
                </>
            )}
        </motion.button>
    );
}
