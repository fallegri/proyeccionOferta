import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validarFormatoGestion, calcularGestionSiguiente, parsearGestionesAtipicas } from '../validators';

const validGestionArb = fc.oneof(
  fc.integer({ min: 2000, max: 2099 }).map(y => `1/${y}`),
  fc.integer({ min: 2000, max: 2099 }).map(y => `2/${y}`)
);

describe('Feature: student-growth-estimator — Validators Property Tests', () => {
  it('Feature: student-growth-estimator, Property 7: Validación del formato de gestión — acepta N/AAAA válidos', () => {
    fc.assert(
      fc.property(validGestionArb, (g) => {
        expect(validarFormatoGestion(g)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('Feature: student-growth-estimator, Property 7b: Validación del formato de gestión — rechaza formatos inválidos', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => !/^[12]\/\d{4}$/.test(s.trim())),
        (s) => {
          expect(validarFormatoGestion(s)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: student-growth-estimator, Property 8: Cálculo correcto de la gestión siguiente', () => {
    fc.assert(
      fc.property(validGestionArb, (g) => {
        const siguiente = calcularGestionSiguiente(g);
        const [nStr, anioStr] = g.split('/');
        const n = parseInt(nStr, 10);
        const anio = parseInt(anioStr, 10);
        if (n === 1) {
          expect(siguiente).toBe(`2/${anio}`);
        } else {
          expect(siguiente).toBe(`1/${anio + 1}`);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Feature: student-growth-estimator, Property 10: Parsing correcto de gestiones atípicas — gestiones válidas', () => {
    fc.assert(
      fc.property(
        fc.array(validGestionArb, { minLength: 1, maxLength: 5 }),
        (gestiones) => {
          const input = gestiones.join(', ');
          const result = parsearGestionesAtipicas(input);
          expect(result).toEqual(gestiones);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: student-growth-estimator, Property 10b: Parsing correcto de gestiones atípicas — lanza error en formato inválido', () => {
    fc.assert(
      fc.property(
        // Generate strings that are non-empty after trim AND contain at least one non-empty token
        // that is not a valid gestión format
        fc.string().filter(s => {
          const trimmed = s.trim();
          if (!trimmed) return false;
          // Must have at least one non-empty part after splitting by comma
          const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
          if (parts.length === 0) return false;
          // At least one part must be an invalid gestión
          return parts.some(p => !/^[12]\/\d{4}$/.test(p));
        }),
        (invalidInput) => {
          expect(() => parsearGestionesAtipicas(invalidInput)).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: student-growth-estimator, Property 10c: Parsing de string vacío retorna array vacío', () => {
    expect(parsearGestionesAtipicas('')).toEqual([]);
    expect(parsearGestionesAtipicas('   ')).toEqual([]);
  });
});
