export async function GET() {
  return Response.json({ ok: true, aperturas: [] });
}
export async function PUT() {
  return Response.json(
    { ok: false, detail: "Demo de solo lectura: no se guardan aperturas." },
    { status: 405 },
  );
}
export const POST = PUT;
