import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Ticket from '@/components/Ticket';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { CheckCircle, Clock, Printer } from 'lucide-react';
import axios from 'axios';
import API_URL from '@/config/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ShiftWinnersModal = ({ isOpen, onClose, shift, onUpdate }) => {
    const [winners, setWinners] = useState([]);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState(null);
    const [ticketToPrint, setTicketToPrint] = useState(null);

    useEffect(() => {
        if (isOpen && shift) {
            fetchWinners();
        }
    }, [isOpen, shift]);

    const fetchWinners = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/shifts/${shift.id}/winners`);
            setWinners(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handlePay = async (ticketId) => {
        if (!confirm("¿Marcar ticket como PAGADO?")) return;
        
        setProcessingId(ticketId);
        try {
            await axios.post(`${API_URL}/tickets/${ticketId}/pay`);
            // Update local list state
            setWinners(prev => prev.map(w => 
                w.ticket_id === ticketId 
                    ? { ...w, paid_at: new Date().toISOString() } 
                    : w
            ));
            if(onUpdate) onUpdate();
        } catch (error) {
            alert("Error al pagar ticket");
        } finally {
            setProcessingId(null);
        }
    };

    const handlePrintCopy = async (ticketId) => {
        try {
            const res = await axios.get(`${API_URL}/tickets/${ticketId}/verify`);
            const ticketData = res.data;
            
            setTicketToPrint({
                sales: ticketData.sales,
                total: ticketData.ticket.total,
                ticketId: ticketData.ticket.id,
                shiftType: ticketData.shift.type
            });

            // Allow render then print
            setTimeout(() => {
                window.print();
            }, 500);

        } catch (error) {
            console.error("Error fetching ticket for print", error);
            alert("Error al cargar ticket para impresión");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Ganadores: {shift?.type} - {shift?.date} 
                        <span className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-base font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
                             #{shift?.winning_number}
                        </span>
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 dark:text-slate-400">
                        {winners.length} tickets premiados en este turno.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto mt-4 space-y-3 p-1">
                    {loading ? (
                        <div className="text-center py-8 text-slate-500">Cargando ganadores...</div>
                    ) : winners.length === 0 ? (
                         <div className="text-center py-8 text-slate-500">No hay ganadores registrados.</div>
                    ) : (
                        winners.map((ticket) => (
                            <div key={ticket.ticket_id} className="flex flex-col md:flex-row items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-800 gap-3">
                                <div>
                                    <div className="flex items-center gap-2 font-mono text-sm text-slate-500 dark:text-slate-400">
                                        Ticket #{ticket.ticket_id.slice(-6)}
                                        <span className="text-xs opacity-50">
                                            {format(new Date(ticket.created_at), 'h:mm a')}
                                        </span>
                                    </div>
                                    <div className="font-bold text-lg text-slate-900 dark:text-slate-200">
                                        Premio: Lps. {ticket.prize?.toLocaleString()}
                                    </div>
                                </div>

                                {ticket.paid_at ? (
                                    <div className="flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1.5 rounded-full text-sm font-bold border border-green-200 dark:border-green-800">
                                        <CheckCircle className="w-4 h-4" />
                                        PAGADO
                                        <span className="text-[10px] font-normal opacity-75 hidden md:inline ml-1">
                                            {format(new Date(ticket.paid_at), 'dd/MM HH:mm')}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex gap-2 w-full md:w-auto">
                                        <Button 
                                            onClick={() => handlePrintCopy(ticket.ticket_id)}
                                            size="sm"
                                            variant="outline"
                                            className="flex-1 bg-white hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                                            title="Imprimir Copia"
                                        >
                                            <Printer className="w-4 h-4" />
                                        </Button>
                                        <Button 
                                            onClick={() => handlePay(ticket.ticket_id)}
                                            disabled={!!processingId}
                                            size="sm"
                                            className="bg-green-600 hover:bg-green-700 text-white font-bold flex-1 md:flex-initial"
                                        >
                                            <DollarSignIcon className="w-4 h-4 mr-2" />
                                            PAGAR
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>

            {/* Hidden Print Portal */}
            {ticketToPrint && createPortal(
                <div id="print-portal" className="print:block hidden fixed top-0 left-0 w-full h-full bg-white z-[9999]">
                    <Ticket 
                        sales={ticketToPrint.sales}
                        total={ticketToPrint.total}
                        ticketId={ticketToPrint.ticketId}
                        shiftType={ticketToPrint.shiftType}
                    />
                </div>,
                document.body
            )}
        </Dialog>
    );
};

const DollarSignIcon = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" x2="12" y1="2" y2="22" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
)

export default ShiftWinnersModal;
