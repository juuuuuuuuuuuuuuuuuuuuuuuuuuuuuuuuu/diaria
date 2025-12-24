
import React, { useRef, useState, useEffect } from 'react';
import API_URL from '@/config/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, FileDown } from 'lucide-react';
import axios from 'axios';
import html2canvas from 'html2canvas';

const CloseShiftModal = ({ isOpen, onClose, shiftId, onCloseTotal, onProceed }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const reportRef = useRef(null);

  useEffect(() => {
    if (isOpen && shiftId) {
      loadReport();
    }
  }, [isOpen, shiftId]);

  const loadReport = async () => {
    try {
      const res = await axios.get(`${API_URL}/shifts/${shiftId}/report`);
      setReport(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCloseShift = async () => {
    // Navigate to Confirm Modal
    if (onProceed) onProceed();
  };

  const handleWhatsApp = async () => {
    setLoading(true);
    try {
       // 1. Create a dedicated container for the image export
       const container = document.createElement('div');
       container.style.position = 'fixed';
       container.style.top = '-10000px';
       container.style.left = '-10000px';
       container.style.width = '1000px'; // Wide format for better quality
       container.style.backgroundColor = 'white';
       container.style.padding = '40px';
       container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
       container.style.color = '#1e293b'; // slate-800
       container.style.zIndex = '-9999';
       
       // 2. Build Internal HTML Structure
       const dateStr = report?.shift ? new Date().toLocaleDateString('es-HN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
       
       container.innerHTML = `
         <div style="margin-bottom: 20px; text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
            <h1 style="font-size: 32px; font-weight: bold; margin: 0; color: #0f172a;">REPORTE DE CIERRE</h1>
            <p style="font-size: 18px; color: #64748b; margin: 10px 0 0 0;">
               TURNO: <span style="font-weight: bold; text-transform: uppercase;">${report?.shift?.type || ''}</span> | FECHA: ${dateStr}
            </p>
         </div>

         <div style="display: flex; gap: 20px; margin-bottom: 30px;">
            <div style="flex: 1; background: #f0fdf4; padding: 20px; border-radius: 12px; border: 1px solid #bbf7d0; text-align: center;">
               <p style="margin: 0; font-size: 14px; color: #166534; font-weight: 600;">TOTAL VENDIDO</p>
               <p style="margin: 5px 0 0 0; font-size: 36px; font-weight: 800; color: #15803d;">Lps. ${report?.totalSold?.toLocaleString() || '0'}</p>
            </div>
            <div style="flex: 1; background: #eff6ff; padding: 20px; border-radius: 12px; border: 1px solid #bfdbfe; text-align: center;">
               <p style="margin: 0; font-size: 14px; color: #1e40af; font-weight: 600;">CANTIDAD DE JUGADAS</p>
               <p style="margin: 5px 0 0 0; font-size: 36px; font-weight: 800; color: #1d4ed8;">${report?.sales?.length || 0}</p>
            </div>
         </div>

         <div style="margin-bottom: 15px;">
            <h3 style="font-size: 20px; font-weight: bold; margin: 0 0 15px 0;">Detalle de Ventas</h3>
         </div>

         <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px;">
            ${report?.sales?.map(s => `
               <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 15px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 20px; font-weight: bold; color: #0f172a; background: #e2e8f0; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">${s.number}</span>
                  <span style="font-size: 18px; font-weight: 600; color: #334155;">${s.total_amount}</span>
               </div>
            `).join('')}
         </div>

         <div style="margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px;">
            Generado por Sistema POS La Diaria - ${new Date().toLocaleString()}
         </div>
       `;

       document.body.appendChild(container);

       // 3. Generate Canvas
       const canvas = await html2canvas(container, {
          scale: 1, // 1 is enough for 1000px width usually, but let's see. 1000px is wide.
          useCORS: true,
          scrollY: 0
       });
       
       document.body.removeChild(container);

       // 4. Config & Export
       const configRes = await axios.get(`${API_URL}/config`);
       const whatsappNumber = configRes.data.whatsapp_number;

       canvas.toBlob(async (blob) => {
          if (!blob) return;
          const text = `Reporte de Cierre. Turno: ${report?.shift?.type}. Total: ${report?.totalSold}`;
          
          // 1. Download/Save Image logic (Common for both)
          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/png');
          link.download = `cierre_${shiftId}.png`;
          link.click();

          // 2. Open WhatsApp (Prioritize direct number)
          if (whatsappNumber) {
              // Add a small delay for mobile to process the download
              setTimeout(() => {
                 window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`, '_blank');
              }, 500);
          } else {
              // Fallback to generic share if no number configured (and supported)
              const file = new File([blob], `cierre_turno_${shiftId}.png`, { type: 'image/png' });
              if (navigator.canShare && navigator.canShare({ files: [file] })) {
                  try {
                      await navigator.share({
                          files: [file],
                          title: 'Cierre de Turno',
                          text: text
                      });
                  } catch (e) { console.log(e); }
              } else {
                  alert("Imagen descargada. Configure un número de WhatsApp para envío directo.");
              }
          }
       }, 'image/png');

    } catch (err) {
       console.error("Error exporting", err);
       alert("Error al generar imagen");
    } finally {
       setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Cierre de Turno</DialogTitle>
          <DialogDescription className="hidden">
            Resumen de ventas y cierre de turno.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col md:flex-row gap-4">
           {/* Report Preview Area */}
           <div className="flex-1 bg-white p-4 border rounded shadow-sm" ref={reportRef}>
              <div className="text-center border-b pb-2 mb-2">
                 <h3 className="font-bold text-lg">Reporte de Cierre</h3>
                 <p className="text-sm text-slate-500">
                   Turno: {report?.shift?.type} | Fecha: {report?.shift?.date}
                 </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                 <div className="bg-slate-50 p-3 rounded">
                    <p className="text-xs text-slate-500">Total Vendido</p>
                    <p className="text-xl font-bold text-green-600">Lps. {report?.totalSold?.toLocaleString()}</p>
                 </div>
                 <div className="bg-slate-50 p-3 rounded">
                    <p className="text-xs text-slate-500">Números Jugados</p>
                    <p className="text-xl font-bold text-blue-600">{report?.sales?.length}</p>
                 </div>
              </div>

              <div className="max-h-[300px] overflow-y-auto">
                 <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-600">
                       <tr>
                          <th className="px-3 py-2">Número</th>
                          <th className="px-3 py-2 text-right">Total</th>
                       </tr>
                    </thead>
                    <tbody>
                       {report?.sales?.map((s) => (
                          <tr key={s.number} className="border-b hover:bg-slate-50">
                             <td className="px-3 py-1 font-bold">{s.number}</td>
                             <td className="px-3 py-1 text-right">Lps. {s.total_amount}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
              <div className="mt-4 text-xs text-center text-slate-400">
                 Generado el {new Date().toLocaleString()}
              </div>
           </div>

           {/* Actions */}
           <div className="w-full md:w-64 space-y-3">
              <Button onClick={() => handleWhatsApp()} className="w-full bg-green-500 hover:bg-green-600">
                 <MessageCircle className="w-4 h-4 mr-2" /> Exportar a WhatsApp
              </Button>
              <Button onClick={() => {}} variant="outline" className="w-full">
                 <FileDown className="w-4 h-4 mr-2" /> Generar PDF (Simulado)
              </Button>
              
              <div className="pt-10">
                 <Button onClick={handleCloseShift} className="w-full bg-red-600 hover:bg-red-700 text-white">
                    Finalizar Turno
                 </Button>
                 <Button onClick={onClose} variant="ghost" className="w-full mt-2">
                    Cancelar
                 </Button>
              </div>
           </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CloseShiftModal;
