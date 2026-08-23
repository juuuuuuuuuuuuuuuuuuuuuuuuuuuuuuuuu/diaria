import React, { useState, useEffect } from 'react';
import API_URL from '@/config/api'; 
import { useConfig } from '@/context/ConfigContext';

// ... imports

// Replace all occurrences:
// `http://${window.location.hostname}:3001/api` -> `${API_URL}`
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// Removed invalid Badge import from lucide-react
import { DollarSign, Ticket as TicketIcon, Award, Users, Lock, ShoppingCart, Moon, Sun, Settings, History, Trash2, Beaker, Printer } from 'lucide-react'; 
import { cn } from '@/lib/utils';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

import { DialogDescription } from '@/components/ui/dialog';
import { createPortal } from 'react-dom';
import Ticket from '@/components/Ticket';

import WinnerModal from '@/components/modals/WinnerModal';
import SalesModal from '@/components/modals/SalesModal';
import CloseShiftModal from '@/components/modals/CloseShiftModal';
import ConfirmCloseModal from '@/components/modals/ConfirmCloseModal';
import VerifyTicketModal from '@/components/modals/VerifyTicketModal';
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
  const [loadingShift, setLoadingShift] = useState(false);
  
  const [stats, setStats] = useState({ total: 0, count: 0 }); // count now represents Clients
  const [recentSales, setRecentSales] = useState([]);
  const { config } = useConfig();
  
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

  // Reprint State
  const [reprintData, setReprintData] = useState(null);
  const [reprintingId, setReprintingId] = useState(null);

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
      // Optimized: Fetch all dashboard data in one go
      const url = currentId ? `${API_URL}/dashboard/summary?shift_id=${currentId}` : `${API_URL}/dashboard/summary`;
      const res = await axios.get(url);
      const data = res.data;

      setShiftsStatus(data.shifts);

      if (data.activeShiftData) {
         // Update active shift if explicitly requested OR if we don't have one and backend found one (auto-select)
         if (currentId || !activeShift) {
             setActiveShift(data.activeShiftData);
         }
         
         setStats(data.stats);
         setRecentSales(data.recentSales);
      } else {
         // No active shift data returned
         if (!activeShift) {
             setStats({ total: 0, count: 0, clientCount: 0 });
             setRecentSales([]);
         }
      }
      
    } catch (error) {
      console.error("Error fetching dashboard data", error);
    }
  };

  const handleShiftSelect = async (type) => {
     if (loadingShift) return;
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
     setLoadingShift(true);
     try {
       const res = await axios.post(`${API_URL}/shifts/open`, { type });
       if (res.data.success) {
          // Success, now we essentially have it open. 
          const newShift = { id: res.data.id, type, status: 'ABIERTO' };
          setActiveShift(newShift);
          await fetchData(newShift.id);
       }
     } catch (err) {
        setAlertConfig({
           title: "No se puede abrir turno",
           message: err.response?.data?.error || "Error al abrir turno"
        });
        setAlertOpen(true);
     } finally {
        setLoadingShift(false);
     }
  };

  const handleCloseShiftClick = () => {
    setCloseShiftModalOpen(true);
  };

  const handleReprint = async (ticketId) => {
    try {
      setReprintingId(ticketId);
      const res = await axios.get(`${API_URL}/tickets/${ticketId}/verify`);
      if (res.data) {
        setReprintData(res.data);
        // Wait for portal to render
        setTimeout(() => {
           window.print();
           // Clear after print
           setReprintData(null);
           setReprintingId(null);
        }, 1000);
      }
    } catch (err) {
      console.error("Error reprinting ticket", err);
      setAlertConfig({ title: "Error", message: "No se pudo recuperar el ticket para imprimir." });
      setAlertOpen(true);
      setReprintingId(null);
    }
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

  const handleDeleteTestShift = async () => {
    if (!activeShift || (activeShift.type !== 'Prueba' && !activeShift.is_test)) return;
    if (!window.confirm("¿Estás seguro de ELIMINAR este turno de prueba? Se borrarán todas las ventas y tickets asociados.")) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/shifts/${activeShift.id}`, {
          headers: { Authorization: `Bearer ${token}` }
      });
      setActiveShift(null);
      fetchData(null);
      alert("Turno de prueba eliminado correctamente.");
    } catch (err) {
      console.error("Delete shift error:", err.response?.data || err.message);
      alert(err.response?.data?.error || "Error al eliminar turno de prueba (403: Prohibido)");
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
               disabled={loadingShift || isFinalized}
               className={cn(
                 "py-2 px-4 rounded-md text-sm font-medium transition-all border",
                 loadingShift && "opacity-60 cursor-wait",
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
            ? activeShift.is_test 
                ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300"
                : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300"
            : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
        )}>
           <div className={cn("p-2 rounded-full", 
               activeShift 
               ? activeShift.is_test 
                   ? "bg-yellow-100 dark:bg-yellow-900/40"
                   : "bg-blue-100 dark:bg-blue-900/40" 
               : "bg-slate-200 dark:bg-slate-800"
           )}>
             {activeShift?.is_test ? <Beaker className="w-5 h-5 text-yellow-600 dark:text-yellow-400" /> : <TicketIcon className={cn("w-5 h-5", activeShift ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400")} />}
           </div>
           <div className="flex-1">
             <h4 className="font-bold flex items-center gap-2">
                 {activeShift?.is_test ? "MODO PRUEBA" : (activeShift ? `Turno Activo: ${activeShift.type}` : 'Ninguno Seleccionado')}
             </h4>
             <p className="text-sm opacity-80">
                 {activeShift ? 'Listo para vender' : 'Seleccione un turno para comenzar'}
             </p>
           </div>
           
           {(activeShift?.is_test || activeShift?.type === 'Prueba') && (
               <Button 
                   size="sm" 
                   variant="destructive" 
                   onClick={handleDeleteTestShift}
                   className="h-8 bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
               >
                   <Trash2 className="w-4 h-4 mr-1" /> Eliminar Prueba
               </Button>
           )}
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
             icon={TicketIcon} 
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
                 <TicketIcon className="w-5 h-5 mr-2" /> Verificar
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
        
        {/* Test Shift Button (Only if no active shift) */}
        {!activeShift && (
             <Button 
               variant="ghost" 
               disabled={loadingShift}
               className="w-full text-sm text-slate-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 border border-dashed border-slate-300 dark:border-slate-700 h-10" 
               onClick={() => handleShiftSelect('Prueba')}
             >
                 <Beaker className="w-4 h-4 mr-2" /> Abrir Turno de Prueba
             </Button>
        )}

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
              Tickets Recientes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <div className="divide-y dark:divide-slate-800">
               {recentSales.map((ticket) => (
                 <div key={ticket.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                         Ticket #{ticket.id}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <span className="font-bold text-slate-900 dark:text-green-400">Lps. {ticket.total}</span>
                       <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 px-2 text-xs gap-1 border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-slate-700 dark:text-blue-400"
                          onClick={() => handleReprint(ticket.id)}
                          disabled={reprintingId === ticket.id}
                       >
                          <Printer className="w-3.5 h-3.5" />
                          {reprintingId === ticket.id ? '...' : 'Imprimir'}
                       </Button>
                    </div>
                 </div>
               ))}
               {recentSales.length === 0 && (
                 <div className="p-4 text-center text-muted-foreground text-sm">No hay tickets recientes</div>
               )}
             </div>
          </CardContent>
        </Card>

        {reprintData && createPortal(
            <div id="print-portal" className="print:block hidden fixed top-0 left-0 w-full h-full bg-white z-[9999]">
                <Ticket 
                    sales={reprintData.sales} 
                    total={reprintData.ticket.total} 
                    ticketId={reprintData.ticket.id}
                    shiftType={reprintData.shift.type} 
                    multiplier={config?.prize_multiplier || 70}
                />
            </div>,
            document.body
        )}
      </div>
    </div>
  );
};

export default Dashboard;
