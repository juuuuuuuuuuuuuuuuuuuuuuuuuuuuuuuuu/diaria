import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import axios from 'axios';

const WinnerModal = ({ shiftId, isOpen, onClose, onSuccess }) => {
  const [number, setNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!number || number.length !== 2) {
      setError('Debe ser un número de 2 dígitos (00-99)');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      await axios.put(`http://localhost:3001/api/shifts/${shiftId}/winner`, { number });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-96 shadow-xl animate-in fade-in zoom-in duration-200">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center gap-2">
            ⚠️ Acción Requerida
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            El turno anterior no tiene ganador registrado. Ingrese el número ganador para continuar.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <Input 
              autoFocus
              type="text" 
              maxLength={2}
              placeholder="00-99"
              className="text-center text-4xl font-bold h-20 w-32 tracking-widest"
              value={number}
              onChange={(e) => setNumber(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
          {error && <p className="text-sm text-red-500 text-center font-medium">{error}</p>}
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
           <Button variant="outline" onClick={onClose}>Cancelar</Button>
           <Button onClick={handleSubmit} disabled={loading} className="bg-green-600 hover:bg-green-700">
             {loading ? 'Guardando...' : 'Confirmar Ganador'}
           </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default WinnerModal;
