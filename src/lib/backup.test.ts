// Backup file validation — parseBackup is the gate between an arbitrary
// user-supplied file and bulkPut into the live database.
import { describe, expect, it } from "vitest";
import { parseBackup } from "./export";

const valid = JSON.stringify({
  app: "plainvoice",
  format: 1,
  exportedAt: "2026-06-12T00:00:00.000Z",
  data: {
    businesses: [{ id: "b1", name: "Studio" }],
    clients: [{ id: "c1", name: "Acme" }],
    items: [],
    invoices: [{ id: "i1", number: "INV-0001" }],
    invoiceLines: [{ id: "l1", invoiceId: "i1" }],
    payments: [],
    reminders: [],
    settings: [{ id: "singleton", aiUsesLeft: 4 }],
  },
});

describe("parseBackup", () => {
  it("accepts a well-formed backup and returns its tables", () => {
    const d = parseBackup(valid);
    expect(d.invoices).toHaveLength(1);
    expect(d.clients).toHaveLength(1);
    expect((d.settings[0] as any).aiUsesLeft).toBe(4);
  });

  it("rejects non-JSON", () => {
    expect(() => parseBackup("not json {")).toThrow(/valid JSON/);
  });

  it("rejects JSON that isn't a Plainvoice backup", () => {
    expect(() => parseBackup(JSON.stringify({ hello: "world" }))).toThrow(/Plainvoice backup/);
    expect(() => parseBackup(JSON.stringify({ app: "other", data: {} }))).toThrow(/Plainvoice backup/);
  });

  it("rejects backups from a newer format version", () => {
    expect(() => parseBackup(JSON.stringify({ app: "plainvoice", format: 99, data: {} })))
      .toThrow(/newer version/);
  });

  it("drops malformed rows instead of importing junk", () => {
    const d = parseBackup(JSON.stringify({
      app: "plainvoice",
      format: 1,
      data: {
        invoices: [{ id: "ok" }, { noId: true }, "string", null, 42],
        clients: "not-an-array",
      },
    }));
    expect(d.invoices).toHaveLength(1);
    expect(d.clients).toEqual([]);
    expect(d.payments).toEqual([]);
  });
});
