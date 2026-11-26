import { demoDashboard } from "../../lib/demo.ts";
import { resources } from "../../lib/cerebro-contract.ts";
import type { Resource } from "../../lib/cerebro-contract.ts";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams;
    const resource = search.get("recurso");
    if (resource && !resources.includes(resource as Resource))
      throw new Error("Recurso no válido.");
    const payload = demoDashboard(search);
    return Response.json(
      resource ? payload.resources[resource as Resource] : payload,
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        detail: error instanceof Error ? error.message : "Consulta inválida.",
      },
      { status: 400 },
    );
  }
}
