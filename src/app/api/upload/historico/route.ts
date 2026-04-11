import { parseHistorico } from '@/lib/importer';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return Response.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = parseHistorico(buffer);
    if (result.errores.length > 0) {
      return Response.json({ error: result.errores[0], details: result.errores }, { status: 400 });
    }
    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return Response.json({ error: msg }, { status: 500 });
  }
}
