import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { LogEntry, LogLevel } from '../types';

interface LogsContextType {
  logs: LogEntry[];
  addLog: (level: LogLevel, message: string) => void;
  clearLogs: () => void;
}

const LogsContext = createContext<LogsContextType | undefined>(undefined);

export const LogsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const counterRef = useRef(0);

  const addLog = useCallback((level: LogLevel, message: string) => {
    counterRef.current += 1;
    const entry: LogEntry = {
      id: `log-${counterRef.current}-${Date.now()}`,
      level,
      message,
      timestamp: new Date(),
    };
    setLogs(prev => [entry, ...prev]);
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  return (
    <LogsContext.Provider value={{ logs, addLog, clearLogs }}>
      {children}
    </LogsContext.Provider>
  );
};

export const useLogs = () => {
  const context = useContext(LogsContext);
  if (!context) {
    throw new Error('useLogs must be used within a LogsProvider');
  }
  return context;
};
