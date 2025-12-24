import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';

const LimitResolutionModal = ({ isOpen, item, onClose, onConfirm }) => {
  const [newAmount, setNewAmount] = useState('');

  useEffect(() => {
    if (item && isOpen) {
       // Default to available amount if possible, else 0
       setNewAmount(item.available > 0 ? item.available.toString() : '0');
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const handleSubmit = () => {
     const val = parseInt(newAmount);
     if (isNaN(val) || val < 0) return;
     if (val > item.available) {
         // Maybe show error or just prevent? 
         // Let's assume user might want to try again or understands 
         // But for UX, let's clamp or warn. 
         // For now, strict confirm.
     }
     onConfirm(item.number, val);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 mb-2">
             <AlertTriangle className="w-6 h-6" />
             <span className="font-bold">Límite Excedido</span>
          </div>
          <DialogTitle>Número {item.number}</DialogTitle>
          <DialogDescription>
             Este número ha alcanzado su límite de ventas.
             <br />
             <span className="font-semibold text-slate-900 mt-2 block">
                Solicitado: Lps. {item.requested} | Disponible: Lps. {item.available}
             </span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
           <label className="text-sm font-medium mb-1 block">Nuevo Monto:</label>
           <Input 
              type="number" 
              value={newAmount} 
              onChange={(e) => setNewAmount(e.target.value)}
              className="text-lg font-bold"
              min="0"
              max={item.available}
           />
           <p className="text-xs text-slate-500 mt-2">
              Ingrese un monto menor o igual al disponible. (0 para eliminar)
           </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar Venta</Button>
          <Button onClick={handleSubmit} className="bg-amber-600 hover:bg-amber-700 text-white">
            Actualizar y Reintentar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LimitResolutionModal;
