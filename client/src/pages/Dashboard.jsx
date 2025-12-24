import React, { useState, useEffect } from 'react';
import API_URL from '@/config/api'; // Added import

// ... imports

// Replace all occurrences:
// `http://${window.location.hostname}:3001/api` -> `${API_URL}`
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from 'lucide-react'; // Wait, Badge is a component, not icon. Using a div for now.
import { DollarSign, Ticket, Award, Users, Lock, ShoppingCart, Moon, Sun, Settings, History } from 'lucide-react'; // Added History
import { cn } from '@/lib/utils';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

import WinnerModal from '@/components/modals/WinnerModal';
import SalesModal from '@/components/modals/SalesModal';
import CloseShiftModal from '@/components/modals/CloseShiftModal';
import ConfirmCloseModal from '@/components/modals/ConfirmCloseModal';
import VerifyTicketModal from '@/components/modals/VerifyTicketModal'; // NEW
import AlertModal from '@/components/modals/AlertModal';
import ConfigModal from '@/components/modals/ConfigModal';

const Dashboard = () => {
  const navigate = useNavigate();
  // State
  // Theme State
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'light';
    }
    return 'light';
  });

  const [shiftsStatus, setShiftsStatus] = useState({}); // { Mañana: null, Tarde: {status...}, ...}
  const [activeShift, setActiveShift] = useState(null); // The currently SELECTED shift context
  
  const [stats, setStats] = useState({ total: 0, count: 0 }); // count now represents Clients
  const [recentSales, setRecentSales] = useState([]);
  const [config, setConfig] = useState(null);
  
  // Modals
  const [winnerModalOpen, setWinnerModalOpen] = useState(false);
  const [pendingShiftId, setPendingShiftId] = useState(null);
  const [closeShiftModalOpen, setCloseShiftModalOpen] = useState(false);
  const [confirmCloseModalOpen, setConfirmCloseModalOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '' });
  const [salesModalOpen, setSalesModalOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false); // NEW
  const [winningNumber, setWinningNumber] = useState('');

  // Validar Tema
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Initial Load
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [activeShift?.id]);

  const fetchData = async (currentId = activeShift?.id) => {
    try {
      // 1. Always get day status to update buttons
      const resStatus = await axios.get(`${API_URL}/shifts/day-status`);
      setShiftsStatus(resStatus.data.shifts);

      // 2. If we have an active shift selected, refresh its stats
      if (currentId) {
          const [resStats, resClients, resSales] = await Promise.all([
             axios.get(`${API_URL}/sales/stats?shift_id=${currentId}`),
             axios.get(`${API_URL}/stats/clients?shift_id=${currentId}`),
             axios.get(`${API_URL}/sales/recent?shift_id=${currentId}`)
          ]);
          
          setStats({
              ...resStats.data,
              clientCount: resClients.data.count
          });
          setRecentSales(resSales.data);
      } else {
          // Attempt to auto-select the first available OPEN shift if none selected
          const shifts = resStatus.data.shifts;
          const openShiftType = ['Mañana', 'Tarde', 'Noche'].find(t => shifts[t]?.status === 'ABIERTO');
          if (openShiftType && !activeShift) {
             const s = shifts[openShiftType];
             setActiveShift(s);
          } else if (!activeShift) {
             setStats({ total: 0, count: 0, clientCount: 0 });
             setRecentSales([]);
          }
      }

      const resConfig = await axios.get(`${API_URL}/config`);
      setConfig(resConfig.data);

    } catch (error) {
      console.error("Error fetching dashboard data", error);
    }
  };

  const handleShiftSelect = async (type) => {
     const statusObj = shiftsStatus[type];
     
     // Case 1: Already Open -> Select it
     if (statusObj && statusObj.status === 'ABIERTO') {
         setActiveShift(statusObj);
         // Reset data immediate
         setStats({ total: 0, count: 0 });
         setRecentSales([]);
         fetchData(statusObj.id);
         return;
     }

     // Case 2: Finalized -> Block
     if (statusObj && (statusObj.status === 'CERRADO' || statusObj.status === 'FINALIZADO')) {
         setAlertConfig({
            title: "Turno Finalizado",
            message: `El turno de la ${type} ya fue cerrado por hoy.`
         });
         setAlertOpen(true);
         return;
     }

     // Case 3: Not exists -> Open it
     try {
       const res = await axios.post(`${API_URL}/shifts/open`, { type });
       if (res.data.success) {
          // Success, now we essentially have it open. 
          // We need to construct the object or just refetch.
          const newShift = { id: res.data.id, type, status: 'ABIERTO' };
          setActiveShift(newShift);
          fetchData(newShift.id);
       }
     } catch (err) {
        setAlertConfig({
           title: "No se puede abrir turno",
           message: err.response?.data?.error || "Error al abrir turno"
        });
        setAlertOpen(true);
     }
  };

  const handleCloseShiftClick = () => {
    setCloseShiftModalOpen(true);
  };

  const handleFinalizeShift = async (winningNumber) => {
    if (!activeShift) return;
    try {
      await axios.post(`${API_URL}/shifts/close`, { 
          winning_number: winningNumber,
          shift_id: activeShift.id 
      });
      setConfirmCloseModalOpen(false);
      setActiveShift(null); // Deselect on close
      fetchData(null);
    } catch (err) {
      setAlertConfig({ title: 'Error', message: err.response?.data?.error || "Error al cerrar" });
      setAlertOpen(true);
    }
  };

  const KPICard = ({ title, value, icon: Icon, colorClass }) => (
    <Card className="shadow-sm">
      <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
        <div className={cn("p-3 rounded-full bg-opacity-20", colorClass.bg)}>
          <Icon className={cn("w-8 h-8", colorClass.text)} />
        </div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full p-4 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Left Panel: Status & KPIs */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Shift Selectors */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
           {['Mañana', 'Tarde', 'Noche'].map((s) => {
             const statusObj = shiftsStatus[s];
             const isSelected = activeShift?.type === s;
             const isOpen = statusObj?.status === 'ABIERTO';
             const isFinalized = statusObj?.status === 'FINALIZADO' || statusObj?.status === 'CERRADO';

             return (
             <button
               key={s}
               onClick={() => handleShiftSelect(s)}
             // ... existing classes ...
               className={cn(
                 "py-2 px-4 rounded-md text-sm font-medium transition-all border",
                 isSelected
                   ? "bg-white dark:bg-slate-800 border-blue-500 text-blue-700 dark:text-blue-400 shadow-md ring-1 ring-blue-500" 
                   : isOpen
                     ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
                     : isFinalized
                       ? "bg-slate-50 dark:bg-slate-900 border-transparent text-slate-400 dark:text-slate-600 cursor-not-allowed"
                       : "bg-white dark:bg-slate-800 border-transparent text-slate-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700",
               )}
             >
               <div className="flex flex-col items-center">
                   <span>{s}</span>
                   <span className="text-[10px] uppercase font-bold mt-0.5">
                       {isSelected ? 'SELECCIONADO' : (statusObj?.status || 'DISPONIBLE')}
                   </span>
               </div>
             </button>
             );
           })}
        </div>
        
        {/* Active Shift Banner */}
        <div className={cn(
            "border rounded-lg p-4 flex items-center gap-3 transition-colors",
            activeShift 
                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300"
                : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
        )}>
           <div className={cn("p-2 rounded-full", activeShift ? "bg-blue-100 dark:bg-blue-900/40" : "bg-slate-200 dark:bg-slate-800")}>
             <Ticket className={cn("w-5 h-5", activeShift ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400")} />
           </div>
           <div>
             <h4 className="font-bold">Turno Activo: {activeShift?.type || 'Ninguno Seleccionado'}</h4>
             <p className="text-sm opacity-80">
                 {activeShift ? 'Listo para vender' : 'Seleccione un turno para comenzar'}
             </p>
           </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
           <KPICard 
             title="Total Ventas" 
             value={`Lps. ${stats.total?.toLocaleString() || '0.00'}`} 
             icon={DollarSign} 
             colorClass={{ bg: 'bg-blue-100', text: 'text-blue-600' }} 
           />
           <KPICard 
             title="Números Vendidos" 
             value={stats.count || 0} 
             icon={Ticket} 
             colorClass={{ bg: 'bg-cyan-100', text: 'text-cyan-600' }} 
           />
           <KPICard 
             title="Límite Restante" 
             value={config?.limit_total_shift ? (config.limit_total_shift - (stats.total || 0)) : '∞'} 
             icon={Lock} 
             colorClass={{ bg: 'bg-red-100', text: 'text-red-500' }} 
           />
           <div className="grid grid-cols-2 gap-4 col-span-2 lg:col-span-3">
              <KPICard 
                title="Ganancia Estimada (15%)" 
                value={`Lps. ${((stats.total || 0) * 0.15).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} 
                icon={Award}
                colorClass={{ bg: 'bg-indigo-100', text: 'text-indigo-600' }} 
              />
              <KPICard 
                title="Clientes Hoy" 
                value={stats.clientCount || 0}
                icon={Users} 
                colorClass={{ bg: 'bg-orange-100', text: 'text-orange-600' }} 
              />
           </div>
        </div>
      </div>

      {/* Right Panel: Actions & Recent */}
      <div className="space-y-6">
        <div className="space-y-3">
           <Button className="w-full h-16 text-xl bg-green-600 hover:bg-green-700 shadow-lg" size="lg" disabled={!activeShift} onClick={() => setSalesModalOpen(true)}>
             <ShoppingCart className="w-6 h-6 mr-2" /> VENDER
           </Button>

           <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => setIsVerifyOpen(true)} className="h-12 text-lg bg-blue-600 hover:bg-blue-700 text-white">
                 <Ticket className="w-5 h-5 mr-2" /> Verificar
              </Button>
              <div className="flex gap-2">
                  <Button onClick={() => navigate('/history')} variant="outline" className="h-12 flex-1 text-lg border-2 dark:border-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                     <History className="w-5 h-5 mr-2" /> Historial
                  </Button>
              </div>
           </div>
           
           <Button 
             className="w-full h-12 text-lg bg-orange-500 hover:bg-orange-600 text-white" 
             variant="secondary"
             onClick={handleCloseShiftClick}
             disabled={!activeShift}
           >
             <Lock className="w-5 h-5 mr-2" /> Cerrar Turno
           </Button>
        </div>

        <WinnerModal 
          isOpen={winnerModalOpen} 
          shiftId={pendingShiftId} 
          onClose={() => setWinnerModalOpen(false)}
          onSuccess={() => {
             fetchData();
          }}
        />
        
        <SalesModal
          isOpen={salesModalOpen}
          shiftId={activeShift?.id}
          shiftType={activeShift?.type}
          onClose={() => setSalesModalOpen(false)}
          onSaleComplete={() => {
             fetchData(activeShift?.id);
          }}
        />

        <CloseShiftModal
          isOpen={closeShiftModalOpen}
          shiftId={activeShift?.id}
          onClose={() => setCloseShiftModalOpen(false)}
          onProceed={() => {
             setCloseShiftModalOpen(false);
             setConfirmCloseModalOpen(true);
          }}
          onCloseTotal={() => fetchData(activeShift?.id)}
        />

        <ConfirmCloseModal 
          isOpen={confirmCloseModalOpen}
          onClose={() => setConfirmCloseModalOpen(false)}
          onConfirm={handleFinalizeShift}
          shiftId={activeShift?.id}
        />

        <VerifyTicketModal 
        isOpen={isVerifyOpen} 
        onClose={() => setIsVerifyOpen(false)} 
      />

      <ConfigModal 
        isOpen={isConfigOpen} 
        onClose={() => setIsConfigOpen(false)} 
      />
        <AlertModal 
           isOpen={alertOpen}
           onClose={() => setAlertOpen(false)}
           title={alertConfig.title}
           message={alertConfig.message}
        />

        <Card className="shadow-sm border-0 dark:bg-slate-900/50 dark:border-slate-800">
          <CardHeader className="pb-3 border-b dark:border-slate-800">
            <CardTitle className="text-lg flex items-center gap-2 dark:text-white">
              Ventas Recientes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <div className="divide-y dark:divide-slate-800">
               {recentSales.map((sale) => (
                 <div key={sale.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                         {sale.ticket_id ? `Ticket #${sale.ticket_id.split('-')[1]}` : `Venta #${sale.id}`}
                      </span>
                      <span className="text-slate-500 mx-1">-</span>
                      <span className="font-medium text-slate-900 dark:text-green-400">Lps. {sale.amount}</span>
                    </div>
                   <div className="flex items-center gap-2">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-600 dark:text-slate-400">Nu: {sale.number}</span>
                   </div>
                 </div>
               ))}
               {recentSales.length === 0 && (
                 <div className="p-4 text-center text-muted-foreground text-sm">No hay ventas recientes</div>
               )}
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
