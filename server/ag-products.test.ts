import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("AG public catalog", () => {
  const file = path.resolve(process.cwd(), "client/public/ag-products.json");
  const rows = JSON.parse(fs.readFileSync(file, "utf8")) as Array<Record<string, unknown>>;

  it("contains only the 177 active quotation items at NT$22", () => {
    expect(rows).toHaveLength(177);
    expect(rows.every((row) => row.status === "available")).toBe(true);
    expect(new Set(rows.map((row) => row.retailPriceTwd))).toEqual(new Set([22]));
  });

  it("does not publish wholesale or logistics fields", () => {
    const forbidden = [
      "wholesaleFobJpy",
      "innerPack",
      "piecesPerCarton",
      "cubicMeters",
      "grossWeightKg",
      "sourceFile",
    ];

    for (const row of rows) {
      expect(forbidden.filter((field) => Object.hasOwn(row, field))).toEqual([]);
    }
  });
});
