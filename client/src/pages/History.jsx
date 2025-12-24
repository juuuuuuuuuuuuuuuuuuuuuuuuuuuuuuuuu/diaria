import React, { useState, useEffect } from 'react';
import API_URL from '@/config/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Calendar, Users, DollarSign, Trophy } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const History = () => {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [historyList, setHistoryList] = useState([]);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHistoryList();
    fetchDetails();
  }, [date]);

  const fetchHistoryList = async () => {
    try {
      const res = await axios.get(`${API_URL}/history/summary`);
      setHistoryList(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/history/${date}`);
      setDetails(res.data);
    } catch (err) {
      console.error(err);
      setDetails(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
       <div className="flex items-center justify-between">
         <h1 className="text-3xl font-bold text-slate-800">Historial de Sorteos</h1>
         <div className="flex items-center gap-2 bg-white p-2 rounded border shadow-sm">
           <Input 
             type="date" 
             value={date} 
             onChange={(e) => setDate(e.target.value)} 
             className="border-0 shadow-none focus-visible:ring-0"
           />
           <Button size="icon" variant="ghost" onClick={fetchDetails}>
             <Search className="w-5 h-5 text-slate-500" />
           </Button>
         </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          {/* Calendar / List Side (Left) */}
          <Card className="col-span-1 lg:col-span-4 h-full flex flex-col">
             <CardHeader>
               <CardTitle>Resumen Reciente</CardTitle>
             </CardHeader>
             <CardContent className="flex-1 overflow-y-auto space-y-4 pr-2">
                {historyList.map((item) => (
                   <div 
                      key={item.date} 
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${item.date === date ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' : 'bg-white hover:bg-slate-50'}`}
                      onClick={() => setDate(item.date)}
                   >
                     <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                           <Calendar className="w-4 h-4 text-slate-400" /> {item.date}
                        </h3>
                        <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                           {item.total_tickets} Tickets
                        </span>
                     </div>
                     <div className="space-y-1 text-sm text-slate-600">
                        <div className="flex justify-between">
                          <span>Total:</span>
                          <span className="font-bold">Lps. {item.total_sales?.toLocaleString()}</span>
                        </div>
                        {item.winners_summary && (
                           <div className="text-xs text-slate-400 mt-1 pt-1 border-t truncate">
                              Ganadores: {item.winners_summary}
                           </div>
                        )}
                     </div>
                  </div>
                ))}
                
                {historyList.length === 0 && (
                   <div className="text-center py-10 text-slate-400">
                      No hay historial disponible
                   </div>
                )}
             </CardContent>
          </Card>
          
          {/* Details Side (Right) */}
          <div className="col-span-1 lg:col-span-8 flex flex-col gap-6">
             {/* Global Stats for the Day */}
             <div className="grid grid-cols-2 gap-4">
                <Card className="bg-blue-600 text-white border-none">
                   <CardContent className="p-6 flex items-center justify-between">
                      <div>
                         <p className="text-blue-100 text-sm font-medium">Venta Total del Día</p>
                         <h3 className="text-3xl font-bold mt-1">Lps. {details?.totals?.total_sales?.toLocaleString() || 0}</h3>
                      </div>
                      <div className="bg-blue-500/30 p-3 rounded-full">
                         <DollarSign className="w-8 h-8" />
                      </div>
                   </CardContent>
                </Card>
                <Card className="bg-indigo-600 text-white border-none">
                   <CardContent className="p-6 flex items-center justify-between">
                      <div>
                         <p className="text-indigo-100 text-sm font-medium">Total Premios</p>
                         <h3 className="text-3xl font-bold mt-1">Lps. {details?.totals?.total_prizes?.toLocaleString() || 0}</h3>
                      </div>
                      <div className="bg-indigo-500/30 p-3 rounded-full">
                         <Trophy className="w-8 h-8" />
                      </div>
                   </CardContent>
                </Card>
             </div>

             {/* Shift Cards Breakdown */}
             <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-800">Detalle por Turno</h3>
                {loading ? (
                   <div className="text-center py-10 text-slate-400">Cargando datos...</div>
                ) : details?.shifts?.length > 0 ? (
                   <div className="grid grid-cols-1 gap-4">
                      {details.shifts.map((shift) => (
                         <Card key={shift.id} className="overflow-hidden">
                            <div className={`h-2 w-full ${shift.status === 'FINALIZADO' ? 'bg-green-500' : 'bg-slate-300'}`} />
                            <CardContent className="p-6">
                               <div className="flex justify-between items-start mb-6">
                                  <div>

                                     <h4 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                        {shift.type} <span className="text-sm font-normal text-slate-500">({shift.status})</span>
                                     </h4>
                                     {/* Parse ISO date explicitly as local time to avoid UTC offset issues */}
                                     <p className="text-sm text-slate-500 capitalize">
                                       {format(new Date(shift.date + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es })}
                                     </p>
                                  </div>
                                  <div className="text-center bg-slate-100 p-2 rounded-lg min-w-[3rem]">
                                     <span className="block text-xs text-slate-500 uppercase">Ganador</span>
                                     <span className="block text-2xl font-bold text-slate-900">{shift.winning_number || '--'}</span>
                                  </div>
                               </div>

                               <div className="grid grid-cols-3 gap-4 text-sm">
                                  <div className="bg-slate-50 p-3 rounded border">
                                     <p className="text-slate-500 mb-1">Total Vendido</p>
                                     <p className="font-bold text-lg">Lps. {shift.total_sold?.toLocaleString() || 0}</p>
                                  </div>
                                  <div className="bg-slate-50 p-3 rounded border">
                                     <p className="text-slate-500 mb-1">Ganadores</p>
                                     <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-slate-400" />
                                        <p className="font-bold text-lg">{shift.winner_count || 0}</p>
                                     </div>
                                  </div>
                                  <div className="bg-green-50 p-3 rounded border border-green-100">
                                     <p className="text-green-700 mb-1">Total a Pagar</p>
                                     <p className="font-bold text-lg text-green-700">Lps. {shift.total_payout?.toLocaleString() || 0}</p>
                                  </div>
                               </div>
                            </CardContent>
                         </Card>
                      ))}
                   </div>
                ) : (
                   <div className="text-center py-10 bg-white rounded border border-dashed text-slate-400">
                      No hay registros de turnos para esta fecha.
                   </div>
                )}
             </div>
          </div>
       </div>
    </div>
  );
};

export default History;
