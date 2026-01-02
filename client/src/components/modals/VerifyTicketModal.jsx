import React, { useState } from 'react';
import API_URL from '@/config/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, CheckCircle, XCircle, Clock, Trophy, Trash2 } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/context/AuthContext';

const VerifyTicketModal = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [ticketId, setTicketId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!ticketId) return;
    
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await axios.get(`${API_URL}/tickets/${ticketId}/verify`);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Error al verificar el ticket");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTicketId('');
    setResult(null);
    setError('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-center text-slate-900 dark:text-slate-100">Verificar Ticket</DialogTitle>
          <DialogDescription className="text-center text-slate-500">
             Ingrese el código del ticket para consultar su estado.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
           {/* Search Input */}
           <form onSubmit={handleVerify} className="flex gap-2">
              <Input 
                placeholder="Escanee o ingrese ID (ej: T-1234-5678)" 
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                autoFocus
                className="uppercase font-mono bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
              <Button type="submit" disabled={loading} className="bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700">
                 <Search className="w-4 h-4" />
              </Button>
           </form>

           {/* Loading */}
           {loading && <p className="text-center text-slate-500 text-sm">Verificando...</p>}

           {/* Error */}
           {error && (
             <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded text-center text-sm font-medium">
               {error}
             </div>
           )}

           {/* Result */}
           {result && (
             <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
               {/* Status Banner */}
               <div className={`p-4 rounded-lg border text-center ${
                   result.status === 'GANADOR' ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-800 text-green-800 dark:text-green-300' :
                   result.status === 'NO_PREMIADO' ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400' :
                   'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400'
               }`}>
                  <div className="flex justify-center mb-2">
                     {result.status === 'GANADOR' && <Trophy className="w-12 h-12 text-green-600 dark:text-green-500" />}
                     {result.status === 'NO_PREMIADO' && <XCircle className="w-12 h-12 text-slate-400 dark:text-slate-500" />}
                     {result.status === 'PENDIENTE' && <Clock className="w-12 h-12 text-yellow-500 dark:text-yellow-600" />}
                  </div>
                  <h3 className="text-2xl font-bold">
                    {result.status === 'GANADOR' ? '¡TICKET GANADOR!' :
                     result.status === 'NO_PREMIADO' ? 'NO PREMIADO' :
                     'SORTEO PENDIENTE'}
                  </h3>
                  {result.status === 'GANADOR' && (
                     <p className="text-3xl font-extrabold mt-2 animate-pulse">Lps. {result.totalWon}</p>
                  )}
               </div>

               {/* Ticket Details */}
               <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded border dark:border-slate-700 text-sm space-y-2">
                  <div className="flex justify-between border-b dark:border-slate-700 pb-2">
                     <span className="text-slate-500 dark:text-slate-400">ID Ticket:</span>
                     <span className="font-mono font-bold text-slate-900 dark:text-slate-200">{result.ticket.id}</span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-slate-500 dark:text-slate-400">Fecha:</span>
                     <span className="text-slate-900 dark:text-slate-200">{format(new Date(result.ticket.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-slate-500 dark:text-slate-400">Turno:</span>
                     <span className="font-medium text-slate-900 dark:text-slate-200">{result.shift.type} ({result.shift.date})</span>
                  </div>
                  {result.winningNumber && (
                    <div className="flex justify-between border-t dark:border-slate-700 pt-2 mt-2">
                       <span className="text-slate-900 dark:text-white font-bold">Ganador Sorteo:</span>
                       <span className="bg-slate-900 dark:bg-slate-950 text-white px-2 rounded font-bold">{result.winningNumber}</span>
                    </div>
                  )}
               </div>

               {/* Items List */}
               <div className="max-h-40 overflow-y-auto border dark:border-slate-700 rounded bg-white dark:bg-slate-900">
                  <table className="w-full text-sm">
                     <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                        <tr>
                           <th className="px-3 py-1 text-left">#</th>
                           <th className="px-3 py-1 text-right">Monto</th>
                           <th className="px-3 py-1 text-right">Estado</th>
                        </tr>
                     </thead>
                     <tbody>
                        {result.sales.map((s, idx) => (
                           <tr key={idx} className={`border-b dark:border-slate-800 ${s.number === result.winningNumber ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
                              <td className="px-3 py-1 font-bold text-slate-800 dark:text-slate-200">{s.number}</td>
                              <td className="px-3 py-1 text-right text-slate-600 dark:text-slate-400">Lps. {s.amount}</td>
                              <td className="px-3 py-1 text-right">
                                 {s.number === result.winningNumber ? 
                                    <span className="text-green-600 dark:text-green-400 font-bold">GANÓ</span> : 
                                    <span className="text-slate-400 dark:text-slate-600">-</span>
                                 }
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
               
                <Button onClick={handleReset} variant="outline" className="w-full text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                  Verificar Otro Ticket
                </Button>

                {/* Delete/Annul Button - Only for Admins/Logged Users */}
                {user && result.shift.status === 'ABIERTO' && (
                  <div className="pt-4 border-t dark:border-slate-800">
                      <Button 
                        onClick={async () => {
                           if (confirm("¿Está seguro de ANULAR este ticket? Esta acción no se puede deshacer.")) {
                               setLoading(true);
                               try {
                                   await axios.delete(`${API_URL}/tickets/${result.ticket.id}`);
                                   alert("Ticket anulado correctamente");
                                   handleReset();
                               } catch (err) {
                                   alert(err.response?.data?.error || "Error al anular ticket");
                               } finally {
                                   setLoading(false);
                               }
                           }
                        }}
                        variant="destructive" 
                        className="w-full bg-red-600 hover:bg-red-700"
                      >
                         <Trash2 className="w-4 h-4 mr-2" /> Anular Ticket
                      </Button>
                      <p className="text-xs text-center text-slate-400 mt-2">
                          Solo se pueden anular tickets de turnos ABIERTOS.
                      </p>
                  </div>
                )}
              </div>
           )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VerifyTicketModal;
