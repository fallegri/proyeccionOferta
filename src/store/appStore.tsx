'use client';

import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { AppState, HistoricoRow, MallaRow, ConfigCalculo, FilaProyeccion } from '@/lib/types';

type Action =
  | { type: 'SET_HISTORICO'; payload: HistoricoRow[] }
  | { type: 'SET_MALLA'; payload: MallaRow[] }
  | { type: 'SET_CONFIG'; payload: ConfigCalculo }
  | { type: 'SET_RESULTADOS'; payload: FilaProyeccion[] }
  | { type: 'SET_PASO'; payload: AppState['paso'] }
  | { type: 'SET_CARGANDO'; payload: boolean }
  | { type: 'SET_ERRORES'; payload: string[] }
  | { type: 'UPDATE_PROYECCION'; payload: { sigla: string; carrera: string; valor: number } }
  | { type: 'RESET' };

const initialState: AppState = {
  historicoRows: [],
  mallaRows: [],
  config: null,
  resultados: [],
  paso: 'carga',
  cargando: false,
  errores: [],
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_HISTORICO': return { ...state, historicoRows: action.payload };
    case 'SET_MALLA': return { ...state, mallaRows: action.payload };
    case 'SET_CONFIG': return { ...state, config: action.payload };
    case 'SET_RESULTADOS': return { ...state, resultados: action.payload };
    case 'SET_PASO': return { ...state, paso: action.payload };
    case 'SET_CARGANDO': return { ...state, cargando: action.payload };
    case 'SET_ERRORES': return { ...state, errores: action.payload };
    case 'UPDATE_PROYECCION':
      return {
        ...state,
        resultados: state.resultados.map(r =>
          r.sigla === action.payload.sigla && r.carrera === action.payload.carrera
            ? { ...r, proyeccionInscritos: action.payload.valor, editadoManualmente: true }
            : r
        ),
      };
    case 'RESET': return initialState;
    default: return state;
  }
}

type AppContextValue = {
  state: AppState;
  dispatch: React.Dispatch<Action>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
}
