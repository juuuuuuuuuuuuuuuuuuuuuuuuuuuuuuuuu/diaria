import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const Config = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/config');
      setConfig(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await axios.put('http://localhost:3001/api/config', config);
      alert('Configuración guardada');
    } catch (err) {
      alert('Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  if (!config) return <div className="p-10 text-center">Cargando...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
       <div className="flex items-center gap-4 mb-6">
         <h1 className="text-3xl font-bold text-slate-800">Configuración del Sistema</h1>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Límites y Reglas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div>
                  <Label>Límite Máximo por Número (Global)</Label>
                  <div className="flex items-center gap-2 mt-2">
                     <Input 
                       type="number" 
                       value={config.limit_per_number} 
                       onChange={(e) => setConfig({...config, limit_per_number: parseInt(e.target.value) || 0})} 
                     />
                     <span className="text-sm text-muted-foreground whitespace-nowrap">lempiras</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Tope de venta acumulada por número en un turno.</p>
               </div>

               <div>
                  <Label>Límite Total por Turno</Label>
                  <div className="flex items-center gap-2 mt-2">
                     <Input 
                       type="number" 
                       value={config.limit_total_shift} 
                       onChange={(e) => setConfig({...config, limit_total_shift: parseInt(e.target.value) || 0})} 
                     />
                     <span className="text-sm text-muted-foreground whitespace-nowrap">lempiras</span>
                  </div>
               </div>
               
               <div>
                  <Label>Retención del Sistema (%)</Label>
                  <Input 
                     type="number" 
                     className="mt-2"
                     value={config.system_retention} 
                     onChange={(e) => setConfig({...config, system_retention: parseInt(e.target.value) || 0})} 
                   />
               </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Horarios de Turnos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               {['morning', 'afternoon', 'night'].map((key) => (
                 <div key={key}>
                    <Label className="capitalize">{key === 'morning' ? 'Mañana' : key === 'afternoon' ? 'Tarde' : 'Noche'}</Label>
                    <Input 
                      className="mt-1" 
                      value={config.shift_schedule[key]} 
                      onChange={(e) => setConfig({
                        ...config, 
                        shift_schedule: { ...config.shift_schedule, [key]: e.target.value }
                      })}
                    />
                 </div>
               ))}
            </CardContent>
            <CardFooter>
               <p className="text-xs text-muted-foreground">Formato: HH:MM - HH:MM</p>
            </CardFooter>
          </Card>
       </div>

       <div className="flex justify-end">
          <Button size="lg" className="bg-green-600 hover:bg-green-700" onClick={handleSave} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
       </div>
    </div>
  );
};

export default Config;
