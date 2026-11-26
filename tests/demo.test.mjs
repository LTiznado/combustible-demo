import test from "node:test";
import assert from "node:assert/strict";
import { demoDashboard } from "../app/lib/demo.ts";
import { validateCerebro } from "../app/lib/cerebro.ts";
import { GET } from "../app/api/dashboard/route.ts";
import { GET as exportExcel } from "../app/api/export/route.ts";
import { PUT } from "../app/api/odometer-openings/route.ts";
import ExcelJS from "exceljs";
test("Every synthetic resource satisfies the UI contract", () => {
  for (const [key, value] of Object.entries(demoDashboard().resources))
    assert.doesNotThrow(() => validateCerebro(key, value), key);
});
test("Dashboard is generated locally without outgoing network requests", async () => {
  const fetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("Forbidden network");
  };
  try {
    const p = await (
      await GET(new Request("https://demo.invalid/api/dashboard"))
    ).json();
    assert.equal(p.ok, true);
    assert.equal(p.canEditOpenings, false);
    assert.equal(p.resources.mensual.rows.length, 4);
  } finally {
    globalThis.fetch = fetch;
  }
});
test("Month, site and plate filters produce consistent totals", () => {
  const p = demoDashboard(
    new URLSearchParams({ from: "2026-09", to: "2026-10", placa: "DEMO-01" }),
  );
  const rows = p.resources.mensual.rows;
  assert.equal(rows.length, 2);
  assert.equal(p.resources.resumen.global.vehiculos, 1);
  assert.equal(
    p.resources.resumen.global.gasto_total,
    rows.reduce((n, r) => n + r.gasto_total, 0),
  );
  const q = demoDashboard(new URLSearchParams({ sede: "Sede Sur (demo)" }));
  assert.equal(q.resources.mensual.rows.length, 2);
});
test("Exact daily intervals apply to movements", () => {
  const p = demoDashboard(
    new URLSearchParams({ from: "2026-10-14", to: "2026-10-16" }),
  );
  assert.equal(p.resources.gasonet.rows.length, 4);
  assert.equal(p.resources.caja_chica.rows.length, 0);
});
test("Unknown ranges are empty, invalid dates and resources are rejected", async () => {
  assert.equal(
    demoDashboard(new URLSearchParams({ from: "2025-01", to: "2025-02" }))
      .resources.mensual.rows.length,
    0,
  );
  for (const query of [
    "from=2026-02-30",
    "from=2026-11&to=2026-01",
    "recurso=invalid",
  ])
    assert.equal(
      (await GET(new Request("https://demo.invalid/api/dashboard?" + query)))
        .status,
      400,
    );
});
test("Read-only copy rejects opening writes", async () => {
  assert.equal((await PUT()).status, 405);
});
test("Excel export contains only synthetic rows and a demo notice", async () => {
  const response = await exportExcel(
    new Request("https://demo.invalid/api/export?report=all"),
  );
  assert.equal(response.status, 200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
  assert.equal(workbook.creator, "Combustible Demo");
  assert.ok(
    workbook
      .getWorksheet("Cobertura")
      .getColumn(1)
      .values.some((v) => String(v).includes("DEMO")),
  );
  assert.ok(
    workbook
      .getWorksheet("Mensual por vehÃ­culo")
      .getColumn(1)
      .values.some((v) => String(v).startsWith("DEMO-")),
  );
});
