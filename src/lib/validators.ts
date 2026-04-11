export function validarFormatoGestion(s: string): boolean {
  return /^[12]\/\d{4}$/.test(s.trim());
}

export function calcularGestionSiguiente(g: string): string {
  if (!validarFormatoGestion(g)) {
    throw new Error(`Formato de gestión inválido: "${g}". Use N/AAAA donde N es 1 o 2.`);
  }
  const [nStr, anioStr] = g.split('/');
  const n = parseInt(nStr, 10);
  const anio = parseInt(anioStr, 10);
  return n === 1 ? `2/${anio}` : `1/${anio + 1}`;
}

export function parsearGestionesAtipicas(s: string): string[] {
  if (!s || !s.trim()) return [];
  const parts = s.split(',').map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    if (!validarFormatoGestion(part)) {
      throw new Error(`Gestión atípica con formato inválido: "${part}". Use N/AAAA donde N es 1 o 2.`);
    }
  }
  return parts;
}
