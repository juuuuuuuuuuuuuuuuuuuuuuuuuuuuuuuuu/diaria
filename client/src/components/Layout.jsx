import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { User, Sun, Moon, LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ConfigModal from '@/components/modals/ConfigModal';
import { useAuth } from '@/context/AuthContext';

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [configModalOpen, setConfigModalOpen] = useState(false);

  // Theme State
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <ConfigModal 
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
      />

      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 px-4 md:px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-2">
           <Link to="/" className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-200">
             POS <span className="text-slate-400 font-light">| La Diaria</span>
           </Link>
        </div>
        
        <div className="flex items-center gap-4">
           {user && (
             <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
                <User className="w-4 h-4" />
                <span className="capitalize">{user.username}</span>
             </div>
           )}
           
           <Button onClick={toggleTheme} variant="ghost" size="icon" className="rounded-full">
                {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-slate-700 dark:text-slate-300" />}
           </Button>

           <Button variant="ghost" size="icon" onClick={() => setConfigModalOpen(true)}>
               <Settings className="w-5 h-5 text-slate-500" />
           </Button>

           <Button variant="ghost" size="icon" onClick={logout} title="Cerrar Sesión">
             <LogOut className="w-5 h-5 text-red-500" />
           </Button>
        </div>
      </header>


      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto h-full">
           <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-blue-50 border-t px-6 py-3 flex items-center justify-between text-sm text-slate-600">
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-1">
             <Sun className="w-4 h-4 text-orange-500" />
             <span>Apertura: 8:00 AM</span>
           </div>
           <div className="h-4 w-px bg-slate-300"></div>
           <div className="flex items-center gap-1">
             <Moon className="w-4 h-4 text-indigo-500" />
             <span>Cierre: 9:00 PM</span>
           </div>
        </div>

        {isHome && (
          <Link to="/history" className="font-medium text-blue-600 hover:underline flex items-center gap-1">
            Ver Historial &rarr;
          </Link>
        )}
      </footer>
    </div>
  );
};

export default Layout;
