// Pure function — no DB access. Parses CSV text into structured rows the
// import API route can then validate against the database (does the
// email exist? is the team name taken?). Keeping parsing separate from
// those DB-dependent checks means the parsing logic itself is fully
// unit-testable, and the two failure classes (malformed CSV vs. valid-CSV-
// but-invalid-data) stay clearly separated.

export type ParsedTeamRow = {
  lineNumber: number;
  teamName: string;
  memberEmails: string[];
};

export type ParseResult = {
  rows: ParsedTeamRow[];
  errors: { lineNumber: number; message: string }[];
};

/**
 * Expected format, one team per line, no header row required (but
 * tolerated and skipped if present):
 *   teamName,member1@example.com,member2@example.com
 *
 * A team needs a name and at least one member email. Up to 3 additional
 * emails are read (4 total) since that's this platform's team size cap —
 * extra columns beyond that are ignored with a warning-level error so the
 * rest of the row still imports rather than failing outright.
 */
export function parseTeamsCsv(csvText: string): ParseResult {
  const rows: ParsedTeamRow[] = [];
  const errors: ParseResult["errors"] = [];

  const lines = csvText.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (line === "") return; // blank lines are silently skipped, not errors

    const cells = line.split(",").map((c) => c.trim());

    const [teamName, ...emailCells] = cells;

    // Tolerate an optional header row like "teamName,email1,email2".
    // Checked against the first cell's literal text ("team" / "teamname",
    // ignoring case/spacing) rather than inferring from the other cells —
    // an earlier version tried to infer "is this a header?" from whether
    // the remaining cells looked like emails, but that broke on the
    // legitimate case of a data row with a deliberately-invalid email
    // (no "@" to detect), which is exactly the kind of row this importer
    // most needs to catch and report, not silently skip.
    if (lineNumber === 1 && /^team ?name$|^team$/i.test(teamName.replace(/\s+/g, ""))) {
      return;
    }

    if (!teamName) {
      errors.push({ lineNumber, message: "Missing team name" });
      return;
    }

    const emails = emailCells.filter(Boolean);
    if (emails.length === 0) {
      errors.push({ lineNumber, message: `Team "${teamName}" has no member emails` });
      return;
    }

    const MAX_MEMBERS = 4;
    if (emails.length > MAX_MEMBERS) {
      errors.push({
        lineNumber,
        message: `Team "${teamName}" lists ${emails.length} members; only the first ${MAX_MEMBERS} were imported`
      });
    }

    const invalidEmails = emails.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (invalidEmails.length > 0) {
      errors.push({
        lineNumber,
        message: `Team "${teamName}" has invalid email(s): ${invalidEmails.join(", ")}`
      });
      return;
    }

    rows.push({ lineNumber, teamName, memberEmails: emails.slice(0, MAX_MEMBERS) });
  });

  return { rows, errors };
}
