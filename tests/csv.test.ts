import { describe, it, expect } from "vitest";
import { toCsv } from "../lib/csv";

describe("toCsv", () => {
  it("produces a header row followed by data rows", () => {
    const csv = toCsv([{ a: 1, b: "x" }, { a: 2, b: "y" }], ["a", "b"]);
    expect(csv).toBe("a,b\n1,x\n2,y");
  });

  it("quotes and escapes values containing commas", () => {
    const csv = toCsv([{ name: "Doe, Jane" }], ["name"]);
    expect(csv).toBe('name\n"Doe, Jane"');
  });

  it("escapes embedded double quotes by doubling them", () => {
    const csv = toCsv([{ note: 'She said "hi"' }], ["note"]);
    expect(csv).toBe('note\n"She said ""hi"""');
  });

  it("renders missing values as empty strings", () => {
    const csv = toCsv([{ a: 1 }], ["a", "b"]);
    expect(csv).toBe("a,b\n1,");
  });
});
