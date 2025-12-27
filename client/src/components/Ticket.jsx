import React from 'react';
import { format } from 'date-fns';

const Ticket = ({ sales, total, ticketId, shiftType }) => {
  return (
    <div className="hidden print:block text-black text-xs w-full max-w-[80mm]" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div className="text-center mb-4 border-b border-black pb-2">
        <h2 className="text-xl font-bold uppercase">INVERSIONES M y V</h2>
        <h2 className="text-lg font-bold uppercase">La Diaria</h2>
        <p className="font-bold uppercase">SORTEO {shiftType || 'DIARIO'}</p>
        <p>{format(new Date(), 'dd/MM/yyyy HH:mm:ss')}</p>
        <p className="font-bold">Ticket #{ticketId}</p>
      </div>

      <div className="space-y-1 mb-4">
        {/* Header Row */}
        <div className="grid grid-cols-3 font-bold border-b border-black pb-1 text-xs">
           <span className="text-left">NUM</span>
           <span className="text-right">MONTO</span>
           <span className="text-right">PREMIO</span>
        </div>
        {/* Items */}
        {sales.map((item, idx) => (
           <div key={idx} className="grid grid-cols-3 text-lg items-center">
              <span className="font-bold text-left">{item.number}</span>
              <span className="text-right">Lps. {item.amount}</span>
              <span className="text-right font-medium text-sm">Lps. {item.amount * 80}</span>
           </div>
        ))}
      </div>

      <div className="border-t border-black pt-2 mb-4">
         <div className="flex justify-between text-lg font-bold">
            <span>TOTAL A PAGAR:</span>
            <span>Lps. {total}</span>
         </div>
         {/* Footer prize removed as requested */}
      </div>
      
      <div className="text-center text-[10px] mt-4">
        <p>*** GRACIAS POR SU COMPRA ***</p>
        <p>Revise su ticket antes de retirarse.</p>
        <p>Validez: 3 días.</p>
      </div>
    </div>
  );
};

export default Ticket;
