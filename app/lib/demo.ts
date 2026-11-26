import {
  productCodes,
  summaryFields,
  summaryCashFields,
  cashStatuses,
} from "./cerebro-contract.ts";
import type {
  Vehicle,
  MonthlyRow,
  GasonetRow,
  CashRow,
  SummaryTotals,
  SummaryProduct,
  VehicleProduct,
  SummaryFuel,
  DashboardPayload,
  OdometerRow,
  Product,
  ResourceMap,
} from "./cerebro-contract.ts";

/** Generated from constants, never derived from private records or real identities. */
export const demoVehicles: Vehicle[] = Array.from({ length: 4 }, (_, i) => ({
  placa: `DEMO-0${i + 1}`,
  sede: i % 2 ? "Sede Sur (demo)" : "Sede Norte (demo)",
  area: i % 2 ? "Reparto demo" : "Operaciones demo",
  conductor: `Conductor ficticio ${i + 1}`,
  combustibles: [["GASOLINA REGULAR", "DIESEL", "GLP", "GNV"][i]],
  activo: true,
  notas: "Vehículo ficticio para demostración.",
  variantes: [],
}));
export const demoMonths = Array.from(
  { length: 6 },
  (_, i) => `2026-${String(i + 5).padStart(2, "0")}`,
);
const money = (value: number) => Math.round(value * 100) / 100;
const sum = (rows: object[], field: string) =>
  money(
    rows.reduce(
      (n, row) => n + (Number((row as Record<string, unknown>)[field]) || 0),
      0,
    ),
  );
const gas: GasonetRow[] = [];
const cash: CashRow[] = [];
const monthly: MonthlyRow[] = [];
for (let i = 0; i < demoVehicles.length; i++) {
  const v = demoVehicles[i];
  let odometer = 12000 * (i + 1);
  for (let m = 0; m < demoMonths.length; m++) {
    const month = demoMonths[m],
      product = v.combustibles[0] as Product,
      unit = i === 3 ? ("M3" as const) : ("GAL" as const),
      price = [17, 15, 8, 3][i];
    const movements = [5, 15, 25].map((day, j): GasonetRow => {
      const quantity = 12 + i * 3 + m + j;
      return {
        id: `DEMO-CARGA-${i}-${m}-${j}`,
        fecha: `${month}-${String(day).padStart(2, "0")}`,
        periodo: month,
        placa_original: v.placa,
        placa: v.placa,
        estado_placa: "EXACTA",
        combustible: product,
        tipo: product,
        producto: product,
        unidad: unit,
        cantidad: quantity,
        total: money(quantity * price),
        estacion: "Estación ficticia",
        portador: v.conductor,
        precio_unitario: price,
        ticket: `DEMO-TICKET-${i}-${m}-${j}`,
        km_digitado: null,
        odometro_inicio: null,
        odometro_fin: null,
        alerta_km: "SIN_KM",
        fuente: "LIBRO_ANUAL",
        sede: v.sede,
        area: v.area,
        identificador: "SIMULADO",
        detalle: { aviso: "Registro generado; no existe un comprobante real." },
      };
    });
    gas.push(...movements);
    const cashQuantity = 5 + i + m,
      cashAmount = money(cashQuantity * price),
      doc = `DEMO-FACTURA-${i + 1}-${m + 1}`;
    cash.push({
      id: doc,
      fecha_comprobante: `${month}-20`,
      fecha_columna: `${month}-20`,
      periodo_contable: month,
      importe_total: cashAmount,
      importe_rendido: cashAmount,
      base: money(cashAmount / 1.18),
      igv: money(cashAmount - cashAmount / 1.18),
      sede: v.sede,
      sede_fuente: "VEHICULO",
      cantidad: cashQuantity,
      unidad: unit,
      combustible: product,
      producto: product,
      combustible_fuente: "XML",
      ruc_proveedor: "PROVEEDOR-FICTICIO",
      factura_fecha: `${month}-20`,
      factura_total: cashAmount,
      validacion_xml: "XML_COINCIDE",
      nota_xml: "Simulación; no existe XML ni factura real.",
      area: v.area,
      placa_original: v.placa,
      placa_normalizada: v.placa,
      estado_placa: "EXACTA",
      apodo: null,
      estado: "CONCILIADO",
      validacion_documental: "ERP_COINCIDE",
      origen: "DEMO",
      archivo: "Sin archivo real (demo)",
      ruta: "",
      motivo_revision: null,
      documento: doc,
      documento_lineas: 1,
      documento_suma_lineas: cashAmount,
      documento_total_erp: cashAmount,
      documento_base_erp: money(cashAmount / 1.18),
      documento_igv_erp: money(cashAmount - cashAmount / 1.18),
      ruc: "PROVEEDOR-FICTICIO",
      proveedor: "Proveedor ficticio",
      descripcion: "Combustible de demostración",
      ceco: "DEMO",
      hoja: "DEMO",
      fila: m + 1,
      flags: ["DATOS_FICTICIOS"],
      ultima_sincronizacion: null,
    });
    const distance = 850 + i * 120 + m * 25,
      gasQuantity = sum(movements, "cantidad"),
      gasAmount = sum(movements, "total");
    const volumes = {
      galones_gasolina: i === 0 ? gasQuantity : 0,
      galones_diesel: i === 1 ? gasQuantity : 0,
      galones_glp: i === 2 ? gasQuantity : 0,
      m3_gnv: i === 3 ? gasQuantity : 0,
    };
    const row: MonthlyRow = {
      placa: v.placa,
      periodo: month,
      sede: v.sede,
      area: v.area,
      conductor: v.conductor,
      activo: true,
      km_inicio: odometer,
      km_fin: odometer + distance,
      recorrido_km: distance,
      recorrido_parcial_km: null,
      estado_odometro: "COMPLETO",
      gasonet_cargas: 3,
      gasonet_soles: gasAmount,
      ...volumes,
      soles_gasolina: i === 0 ? gasAmount : 0,
      soles_diesel: i === 1 ? gasAmount : 0,
      soles_glp: i === 2 ? gasAmount : 0,
      soles_gnv: i === 3 ? gasAmount : 0,
      caja_chica_lineas: 1,
      caja_chica_soles: cashAmount,
      otros_soles: 0,
      gasto_total: money(gasAmount + cashAmount),
      observaciones: "Datos ficticios, generados con una fórmula fija.",
      caja_galones_gasolina: i === 0 ? cashQuantity : 0,
      caja_galones_diesel: i === 1 ? cashQuantity : 0,
      caja_galones_glp: i === 2 ? cashQuantity : 0,
      caja_m3_gnv: i === 3 ? cashQuantity : 0,
      caja_chica_lineas_sin_cantidad: 0,
      soles_por_km: money((gasAmount + cashAmount) / distance),
      km_por_galon:
        i === 3 ? null : money(distance / (gasQuantity + cashQuantity)),
      km_por_galon_base: i === 3 ? null : "GALONES",
      galones_equivalentes: i === 3 ? null : gasQuantity + cashQuantity,
      combustibles_del_mes: [product],
      calidad: "OK",
    };
    monthly.push(row);
    odometer += distance;
  }
}
function totals(rows: MonthlyRow[]): SummaryTotals {
  const result = Object.fromEntries(
    summaryFields.map((field) => [field, sum(rows, field)]),
  ) as SummaryTotals;
  result.vehiculos = new Set(rows.map((r) => r.placa)).size;
  result.soles_por_km = result.recorrido_km
    ? money((result.gasto_total || 0) / result.recorrido_km)
    : null;
  return result;
}
function productRows(rows: MonthlyRow[], plate?: string): SummaryProduct[] {
  return productCodes
    .map((product): SummaryProduct => {
      const selected = rows.filter(
        (r) =>
          r.combustibles_del_mes.includes(product) &&
          (!plate || r.placa === plate),
      );
      const fields =
        product === "GNV"
          ? ["m3_gnv", "caja_m3_gnv"]
          : product === "DIESEL"
            ? ["galones_diesel", "caja_galones_diesel"]
            : product === "GLP"
              ? ["galones_glp", "caja_galones_glp"]
              : ["galones_gasolina", "caja_galones_gasolina"];
      const a = sum(selected, fields[0]),
        b = sum(selected, fields[1]),
        sa = sum(selected, "gasonet_soles"),
        sb = sum(selected, "caja_chica_soles");
      return {
        producto: product,
        unidad:
          product === "NO_IDENTIFICADO"
            ? null
            : product === "GNV"
              ? "M3"
              : "GAL",
        gasonet_cantidad: a,
        gasonet_soles: sa,
        caja_chica_cantidad: b,
        caja_chica_soles: sb,
        caja_chica_sin_cantidad: 0,
        cantidad_total: a + b,
        soles_total: money(sa + sb),
      };
    })
    .filter((r) => (r.cantidad_total ?? 0) > 0);
}
function date(value: string | null, fallback: string, end = false): string {
  if (!value) return fallback;
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value))
    return end
      ? new Date(
          Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)), 0),
        )
          .toISOString()
          .slice(0, 10)
      : value + "-01";
  const d = new Date(value + "T00:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== value
  )
    throw new Error("Fecha inválida.");
  return value;
}
export function demoDashboard(
  search: URLSearchParams = new URLSearchParams(),
): DashboardPayload {
  const from = date(search.get("from"), "2026-10-01"),
    to = date(search.get("to"), "2026-10-31", true);
  if (from > to) throw new Error("El inicio debe ser anterior al final.");
  const site = search.get("sede"),
    plate = search.get("placa");
  const scope = (row: { sede?: string | null; placa?: string | null }) =>
    (!site || row.sede === site) && (!plate || row.placa === plate);
  const rows = monthly.filter(
    (r) =>
      r.periodo >= from.slice(0, 7) && r.periodo <= to.slice(0, 7) && scope(r),
  );
  const movements = gas.filter(
    (r) => r.fecha >= from && r.fecha <= to && scope(r),
  );
  const cashRows = cash.filter(
    (r) =>
      r.fecha_comprobante >= from &&
      r.fecha_comprobante <= to &&
      scope({ sede: r.sede, placa: r.placa_normalizada }),
  );
  const period = {
    desde: from.slice(0, 7),
    hasta: to.slice(0, 7),
    mes_en_curso: "2026-11",
    datos_al: "2026-10-31",
  };
  const coverage = {
    meses_sin_gasonet: [],
    meses_gasonet_libro_anual: [],
    advertencia: "DEMO: todos los datos son ficticios.",
    notas: {
      soles_por_km: "Gasto simulado dividido entre recorrido simulado.",
      km_por_galon: "Solo volúmenes en galones; GNV se mantiene en m³.",
    },
  };
  const products = productRows(rows);
  const byVehicle: VehicleProduct[] = demoVehicles.flatMap((v) =>
    productRows(rows, v.placa).map((p) => ({ ...p, placa: v.placa })),
  );
  const fuels: SummaryFuel[] = products.map(({ producto, ...p }) => ({
    ...p,
    combustible: (producto.startsWith("GASOLINA")
      ? "GASOLINA"
      : producto) as SummaryFuel["combustible"],
  }));
  const bySite = [...new Set(rows.map((r) => r.sede || ""))].map((sede) => ({
    ...totals(rows.filter((r) => r.sede === sede)),
    sede,
  }));
  const byMonth = [...new Set(rows.map((r) => r.periodo))].map((periodo) => ({
    ...totals(rows.filter((r) => r.periodo === periodo)),
    periodo,
  }));
  const bySiteMonth = bySite.flatMap(({ sede }) =>
    byMonth
      .filter(({ periodo }) =>
        rows.some((r) => r.sede === sede && r.periodo === periodo),
      )
      .map(({ periodo }) => ({
        ...totals(rows.filter((r) => r.sede === sede && r.periodo === periodo)),
        sede,
        periodo,
      })),
  );
  const cashSummary = Object.fromEntries(
    summaryCashFields.map((k) => [k, 0]),
  ) as ResourceMap["resumen"]["caja_chica"];
  cashSummary.sumable_soles = sum(rows, "caja_chica_soles");
  cashSummary.sumable_lineas = rows.length;
  const odometers: OdometerRow[] = rows.map((r) => ({
    placa: r.placa,
    periodo: r.periodo,
    km_inicio: r.km_inicio,
    fuente_inicio: "DEMO",
    km_fin: r.km_fin,
    fuente_fin: "DEMO",
    estado: "COMPLETO",
    recorrido: r.recorrido_km,
    recorrido_parcial: null,
    recorrido_entre_fotos: null,
    fotos: 0,
    ultima_foto_km: null,
    ultima_foto_fecha: null,
    fotos_descartadas: 0,
  }));
  return {
    ok: true,
    mode: "cerebro",
    errors: {},
    requested: {
      from: search.get("from"),
      to: search.get("to"),
      sede: site,
      placa: plate,
    },
    fetchedAt: new Date().toISOString(),
    canEditOpenings: false,
    resources: {
      resumen: {
        ok: true,
        periodo: period,
        cobertura: coverage,
        global: totals(rows),
        por_sede: bySite,
        por_mes: byMonth,
        por_sede_mes: bySiteMonth,
        por_producto: products,
        por_combustible: fuels,
        por_vehiculo_producto: byVehicle,
        caja_chica: cashSummary,
      },
      mensual: { ok: true, periodo: period, cobertura: coverage, rows },
      odometro: { ok: true, rows: odometers },
      gasonet: { ok: true, rows: movements },
      caja_chica: {
        ok: true,
        rows: cashRows,
        totales: {
          importe_total_sumable: sum(cashRows, "importe_total"),
          lineas_sumables: cashRows.length,
          por_estado: cashStatuses.map((estado) => ({
            estado,
            lineas: cashRows.filter((r) => r.estado === estado).length,
            importe_total: sum(
              cashRows.filter((r) => r.estado === estado),
              "importe_total",
            ),
          })),
          cobertura_completa: true,
          advertencia: "Datos de demostración; sin documentos reales.",
        },
        pendientes: [],
        archivos_respaldo: [],
        cobertura: {
          sync_en_curso: false,
          ultima_sincronizacion: null,
          archivos_por_estado: {},
          archivos_pendientes: 0,
          archivos_con_error: 0,
        },
      },
      vehiculos: {
        ok: true,
        vehiculos: demoVehicles.map((v) => ({
          ...v,
          variantes: [...v.variantes],
          combustibles: [...v.combustibles],
        })),
      },
      sin_flota: { ok: true, rows: [] },
      importaciones: { ok: true, importaciones: [] },
      aperturas: { ok: true, aperturas: [] },
      estado: {
        sync_en_curso: false,
        archivos_por_estado: {},
        archivos_pendientes: 0,
        archivos_con_error: 0,
        ultima_sync_ok: null,
        ultimo_error: null,
        ultimas_corridas: [],
      },
    },
  };
}
