import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

const SalesGrid = ({ onAddToCart, itemsInCart, usage = {}, limit = 0 }) => {
  const [openNumber, setOpenNumber] = useState(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const numbers = Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0'));

  const handleAdd = (num) => {
    const val = parseInt(amount);
    if (isNaN(val) || val <= 0) {
       setError('Monto inválido');
       return;
    }
    if (val % 5 !== 0) {
       setError('Debe ser múltiplo de 5');
       return;
    }

    onAddToCart({ number: num, amount: val });
    setAmount('');
    setError('');
    setOpenNumber(null);
  };

  const isSelected = (num) => itemsInCart.some(i => i.number === num);
  const getAmount = (num) => {
     const item = itemsInCart.find(i => i.number === num);
     return item ? item.amount : 0;
  };

  return (
    <div className="grid grid-cols-5 md:grid-cols-10 gap-2 h-auto p-1">
      {numbers.map((num) => {
         const selected = isSelected(num);
         const currentAmount = getAmount(num);
         
         // Limit Logic
         const sold = usage[num] || 0;
         const hasLimit = limit && limit > 0;
         const available = hasLimit ? (limit - sold) : 9999;
         const isCritical = hasLimit && available <= 0;
         
         return (
           <Popover 
             key={num} 
             open={openNumber === num} 
             onOpenChange={(open) => {
               if (open) setOpenNumber(num);
               else {
                 setOpenNumber(null);
                 setAmount('');
                 setError('');
               }
             }}
           >
             <PopoverTrigger asChild>
               <Button
                 variant={selected ? "success" : "outline"} 
                 className={cn(
                   "w-full h-full font-bold flex flex-col items-center justify-center p-0 relative shadow-sm border",
                   selected 
                    ? "bg-green-600 text-white hover:bg-green-700 border-green-700" 
                    : isCritical 
                        ? "bg-red-50 dark:bg-red-900/20 text-red-300 dark:text-red-400 border-red-100 dark:border-red-900" 
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800",
                 )}
               >
                 {/* Number */}
                 <span className={cn("text-lg leading-none mb-0.5", isCritical && "line-through opacity-50")}>{num}</span>
                 
                 {/* Selected Amount */}
                 {selected && <span className="text-[10px] leading-none text-green-100 font-normal">Lps. {currentAmount}</span>}
                 
                 {/* Limit Info (Literal) */}
                 {!selected && (
                    <span className={cn(
                        "text-[9px] font-bold leading-none",
                         isCritical ? "text-red-500 dark:text-red-400" : "text-slate-400 dark:text-slate-500"
                    )}>
                        {isCritical ? 'AGOTADO' : (hasLimit ? `Disp: ${available}` : '')}
                    </span>
                 )}
               </Button>
             </PopoverTrigger>
             <PopoverContent className="w-48 p-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
               <div className="space-y-2">
                 <h4 className="font-medium text-center border-b dark:border-slate-800 pb-1 text-slate-900 dark:text-slate-100">Jugar {num}</h4>
                 <div className="flex items-center gap-2">
                   <Label htmlFor="amt" className="sr-only">Monto</Label>
                   <span className="text-slate-500 dark:text-slate-400">Lps.</span>
                   <Input
                     id="amt"
                     autoFocus
                     className="h-8 text-center font-bold bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                     placeholder="0"
                     value={amount}
                     onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter') handleAdd(num);
                     }}
                   />
                 </div>
                 {error && <p className="text-xs text-red-500 font-medium text-center">{error}</p>}
                 <div className="grid grid-cols-2 gap-2 mt-2">
                    {[5, 10, 20, 50].map(val => (
                       <Button key={val} size="sm" variant="outline" className="h-7 text-xs border-slate-200 dark:border-slate-700 bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setAmount(val.toString())}>
                         Lps. {val}
                       </Button>
                    ))}
                 </div>
                 <Button className="w-full h-8 mt-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white" onClick={() => handleAdd(num)}>
                   Agregar
                 </Button>
               </div>
             </PopoverContent>
           </Popover>
         );
      })}
    </div>
  );
};

export default SalesGrid;
