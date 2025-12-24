import React, { useState, useEffect } from 'react';
import API_URL from '@/config/api';
import { Button } from '@/components/ui/button';
import { createPortal } from 'react-dom';
// Removing unused Dialog imports if we are using manual div, or keeping if needed for other modals
// But SalesGrid imports Popover.
import SalesGrid from '@/components/SalesGrid';
import Ticket from '@/components/Ticket';
import { Trash2, Printer, CheckCircle } from 'lucide-react';
import axios from 'axios';
import LimitResolutionModal from './LimitResolutionModal';
import { DialogDescription } from '@/components/ui/dialog'; // Importing just in case we need it or for LimitResolutionModal if we were rendering it here? No, LimitResolutionModal is a separate component.

const SalesModal = ({ isOpen, onClose, onSaleComplete, shiftId, shiftType }) => {
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null); 
  
  // Limit & Usage State
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitItem, setLimitItem] = useState(null); 
  const [usage, setUsage] = useState({});
  const [limitPerNumber, setLimitPerNumber] = useState(0);

  useEffect(() => {
      if (isOpen && shiftId) {
          fetchUsageData();
      }
  }, [isOpen, shiftId]);

  const fetchUsageData = async () => {
      try {
          const [resConfig, resUsage] = await Promise.all([
             axios.get(`${API_URL}/config`),
             axios.get(`${API_URL}/sales/usage?shift_id=${shiftId}`)
          ]);
          
          setLimitPerNumber(resConfig.data.limit_per_number);
          setUsage(resUsage.data);
      } catch (err) {
          console.error("Error fetching usage", err);
      }
  };
// ... rest of file




  if (!isOpen) return null;

  if (successData) {
     const handlePrint = () => { window.print(); };
     const handleNewSale = () => {
        setSuccessData(null);
        setCart([]);
        onSaleComplete(); 
        onClose();
     };
     
     // Portal for print optimization
     const printContent = createPortal(
        <div id="print-portal" className="print:block hidden fixed top-0 left-0 w-full h-full bg-white z-[9999]">
            <Ticket 
                sales={successData.sales} 
                total={successData.total} 
                ticketId={successData.id}
                shiftType={shiftType} 
            />
        </div>,
        document.body
     );

     return (
        <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center font-sans">
           {printContent}
           
           <div className="bg-white dark:bg-slate-900 p-8 rounded-lg shadow-xl text-center space-y-6 max-w-md w-full print:hidden border dark:border-slate-800">
              <div className="flex justify-center"><CheckCircle className="w-20 h-20 text-green-500" /></div>
              <h2 className="text-3xl font-bold text-slate-800 dark:text-white">¡Venta Exitosa!</h2>
              <p className="text-lg text-slate-600 dark:text-slate-300">Total: Lps. {successData.total}</p>
              <div className="space-y-3">
                 <Button onClick={handlePrint} size="lg" className="w-full bg-blue-600 hover:bg-blue-700 h-14 text-lg text-white"><Printer className="w-6 h-6 mr-2" /> Imprimir Ticket</Button>
                 <Button onClick={handleNewSale} size="lg" variant="outline" className="w-full h-14 text-lg border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Nueva Venta</Button>
              </div>
           </div>
        </div>
     );

  }

  const handleAddToCart = ({ number, amount }) => {
    setCart(prev => {
      const clean = prev.filter(i => i.number !== number);
      return [...clean, { number, amount }];
    });
  };

  const removeFromCart = (num) => {
    setCart(prev => prev.filter(i => i.number !== num));
  };
  
  const handleUpdateLimit = (number, newAmount) => {
      if (newAmount <= 0) {
          removeFromCart(number);
      } else {
          handleAddToCart({ number, amount: newAmount });
      }
      setLimitModalOpen(false);
      setLimitItem(null);
      // Optional: Auto-retry? Let's leave it manual for control
  };

  const total = cart.reduce((acc, curr) => acc + curr.amount, 0);

  const handleSubmit = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    setError('');

    try {
        const res = await axios.post(`${API_URL}/sales/bulk`, {
            shift_id: shiftId,
            items: cart
        });

        if (res.data.success) {
             setSuccessData({
                sales: [...cart],
                total: total,
                id: res.data.ticketId
             });
             setCart([]);
             onSaleComplete(); 
             
             // Auto Print (simulated delay for portal render)
             setTimeout(() => {
                window.print();
             }, 500);
        }

    } catch (err) {
        console.error(err);
        
        // Handle Limit Exceeded gracefully
        if (err.response?.status === 409 && err.response?.data?.code === 'LIMIT_EXCEEDED') {
            const firstFail = err.response.data.failedItems[0]; // Handle one at a time for simplicity
            setLimitItem(firstFail);
            setLimitModalOpen(true);
        } else {
            setError(err.response?.data?.error || "Error al procesar venta");
        }
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-300">
       <LimitResolutionModal 
          isOpen={limitModalOpen}
          item={limitItem}
          onClose={() => setLimitModalOpen(false)}
          onConfirm={handleUpdateLimit}
       />

       {/* Header */}
       <div className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm">
         <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Nueva Venta</h2>
         <Button variant="ghost" onClick={onClose} className="text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">Cerrar</Button>
       </div>

       <div className="flex flex-1 overflow-hidden">
          {/* Left: Grid */}
          <div className="flex-1 p-4 bg-slate-50 dark:bg-slate-900/50 overflow-y-auto">
             <SalesGrid 
                onAddToCart={handleAddToCart} 
                itemsInCart={cart} 
                usage={usage}
                limit={limitPerNumber}
             />
          </div>

          {/* Right: Cart */}
          <div className="w-80 bg-white dark:bg-slate-900 border-l dark:border-slate-800 shadow-xl flex flex-col">
             <div className="p-4 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
               <h3 className="font-bold text-slate-700 dark:text-slate-300">Carrito de Compras</h3>
               <p className="text-sm text-slate-500 dark:text-slate-500">{cart.length} Jugadas</p>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-3">
               {cart.length === 0 && (
                 <div className="text-center text-slate-400 dark:text-slate-600 mt-10">
                   Carrito vacío
                 </div>
               )}
               {cart.map((item) => (
                 <div key={item.number} className="flex items-center justify-between bg-white dark:bg-slate-800 border dark:border-slate-700 rounded p-2 shadow-sm">
                    <div className="flex items-center gap-3">
                       <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold w-8 h-8 flex items-center justify-center rounded-full">
                         {item.number}
                       </span>
                       <div>
                         <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Apuesta: Lps. {item.amount}</p>
                         <p className="text-xs text-green-600 dark:text-green-400">Premio: Lps. {item.amount * 80}</p>
                       </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => removeFromCart(item.number)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                 </div>
               ))}
             </div>

             <div className="p-4 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900 space-y-3">
               {error && (
                 <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-900 whitespace-pre-wrap">
                   {error}
                 </div>
               )}
               
               <div className="flex justify-between items-end">
                 <span className="text-sm text-slate-500 dark:text-slate-400">Total a Pagar:</span>
                 <span className="text-2xl font-bold text-slate-900 dark:text-white">Lps. {total}</span>
               </div>
               
               <Button 
                 className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 shadow-md text-white" 
                 disabled={cart.length === 0 || loading}
                 onClick={handleSubmit}
               >
                 {loading ? 'Procesando...' : 'Generar Ticket'}
               </Button>
             </div>
          </div>
       </div>
    </div>
  );
};

export default SalesModal;
