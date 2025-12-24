import React, { useState, useEffect } from 'react';
import API_URL from '@/config/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trophy, Users, DollarSign, AlertTriangle } from 'lucide-react';
import axios from 'axios';

const ConfirmCloseModal = ({ isOpen, onClose, onConfirm, shiftId }) => {
  const [number, setNumber] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setNumber('');
        setStats(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (number.length === 2 && shiftId) {
        fetchSimulation();
    } else {
        setStats(null);
    }
  }, [number, shiftId]);

  const fetchSimulation = async () => {
      try {
          const res = await axios.get(`${API_URL}/shifts/${shiftId}/simulate-winner?number=${number}`);
          setStats(res.data);
      } catch (err) {
          console.error(err);
      }
  };

  const handleConfirm = () => {
      onConfirm(number);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl text-center text-slate-800">Finalizar Turno</DialogTitle>
          <DialogDescription className="text-center mb-4">
             Ingrese el número ganador para cerrar el turno.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded flex gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
                <p className="text-sm text-yellow-700">
                    Al finalizar el turno, las ventas se bloquearán. Ingrese el número ganador para calcular premios.
                </p>
            </div>

            <div className="flex flex-col items-center gap-4">
                <Label htmlFor="winner" className="text-lg font-bold text-slate-700">Número Ganador</Label>
                <Input 
                    id="winner"
                    value={number}
                    onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                        setNumber(val);
                    }}
                    className="w-24 h-24 text-center text-5xl font-bold tracking-widest border-2 border-slate-300 focus:border-blue-500 rounded-xl"
                    placeholder="--"
                    autoFocus
                />
            </div>

            {stats && (
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-lg border">
                    <div className="col-span-2 text-center border-b pb-2 mb-2">
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Resultados Previstos</span>
                    </div>
                    
                    <div className="flex flex-col items-center p-2 bg-white rounded border">
                        <span className="text-xs text-slate-400">Ganadores</span>
                        <div className="flex items-center gap-1 mt-1">
                            <Users className="w-4 h-4 text-blue-500" />
                            <span className="font-bold text-lg">{stats.winner_count}</span>
                        </div>
                    </div>

                    <div className="flex flex-col items-center p-2 bg-white rounded border">
                        <span className="text-xs text-slate-400">Recaudado (N#{number})</span>
                        <span className="font-bold text-lg text-slate-700">Lps. {stats.total_sold}</span>
                    </div>

                    <div className="col-span-2 bg-green-50 border border-green-100 p-3 rounded flex justify-between items-center px-6">
                        <span className="text-sm font-medium text-green-700">Total a Pagar:</span>
                        <span className="text-xl font-bold text-green-700">Lps. {stats.total_prizes.toLocaleString()}</span>
                    </div>
                </div>
            )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="sm:w-1/3">Cancelar</Button>
          <Button 
            onClick={handleConfirm} 
            className="sm:w-2/3 bg-slate-900 hover:bg-slate-800"
            disabled={number.length !== 2}
          >
            Confirmar y Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmCloseModal;
