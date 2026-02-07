import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '@/config/api';

const ConfigContext = createContext();

export const useConfig = () => {
  return useContext(ConfigContext);
};

export const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API_URL}/config`);
      setConfig(res.data);
      setError(null);
    } catch (err) {
      console.error("Error fetching config:", err);
      setError("No se pudo cargar la configuración.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const refreshConfig = async () => {
      await fetchConfig();
  };

  const value = {
    config,
    loading,
    error,
    refreshConfig
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};
