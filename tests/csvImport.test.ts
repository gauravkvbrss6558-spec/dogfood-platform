import { describe, it, expect } from "vitest";
import { parseTeamsCsv } from "../lib/csvImport";

describe("parseTeamsCsv", () => {
  it("parses a simple valid CSV", () => {
    const csv = "Team Rocket,alice@example.com,bob@example.com";
    const result = parseTeamsCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { lineNumber: 1, teamName: "Team Rocket", memberEmails: ["alice@example.com", "bob@example.com"] }
    ]);
  });

  it("skips a header row if present", () => {
    const csv = "teamName,email1,email2\nTeam Rocket,alice@example.com";
    const result = parseTeamsCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].teamName).toBe("Team Rocket");
  });

  it("skips blank lines without producing errors", () => {
    const csv = "Team A,a@example.com\n\n\nTeam B,b@example.com";
    const result = parseTeamsCsv(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toEqual([]);
  });

  it("reports a missing team name as an error", () => {
    const csv = ",a@example.com";
    const result = parseTeamsCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0].message).toMatch(/missing team name/i);
  });

  it("reports a team with no member emails as an error", () => {
    const csv = "Lonely Team";
    const result = parseTeamsCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0].message).toMatch(/no member emails/i);
  });

  it("rejects a row with an invalid email and does not import it", () => {
    const csv = "Team A,not-an-email";
    const result = parseTeamsCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0].message).toMatch(/invalid email/i);
  });

  it("truncates to 4 members and warns, but still imports the row", () => {
    const csv = "Big Team,a@x.com,b@x.com,c@x.com,d@x.com,e@x.com";
    const result = parseTeamsCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].memberEmails).toHaveLength(4);
    expect(result.errors[0].message).toMatch(/only the first 4/i);
  });

  it("processes multiple independent rows, isolating errors per row", () => {
    const csv = ["Good Team,a@x.com", "Bad Team", "Also Good,b@x.com,c@x.com"].join("\n");
    const result = parseTeamsCsv(csv);
    expect(result.rows.map((r) => r.teamName)).toEqual(["Good Team", "Also Good"]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].lineNumber).toBe(2);
  });
});
