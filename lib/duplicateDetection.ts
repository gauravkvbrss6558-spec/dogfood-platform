// Pure function — takes already-fetched vote rows and returns clusters
// worth a human's attention. Deliberately does not block or delete
// anything: an IP hash shared by many voters is *suggestive* of Sybil
// voting (many fake accounts) but is also just "a college campus" or "an
// office" or "a shared NAT". Auto-blocking on this signal would punish
// legitimate voters, so it's surfaced as an audit report instead. See
// ARCHITECTURE.md for the full reasoning.

export type VoteRecord = {
  submissionId: string;
  voterId: string;
  ipHash: string;
};

export type SuspiciousCluster = {
  ipHash: string;
  distinctVoters: number;
  totalVotes: number;
  submissionIds: string[];
};

/**
 * Flags any IP hash that voted from more than `voterThreshold` distinct
 * accounts. Returns clusters sorted by distinct voter count descending,
 * so the most suspicious pattern surfaces first.
 */
export function detectSuspiciousIpClusters(
  votes: VoteRecord[],
  voterThreshold = 3
): SuspiciousCluster[] {
  const byIp = new Map<string, { voters: Set<string>; submissions: Set<string>; total: number }>();

  for (const v of votes) {
    const entry = byIp.get(v.ipHash) ?? { voters: new Set(), submissions: new Set(), total: 0 };
    entry.voters.add(v.voterId);
    entry.submissions.add(v.submissionId);
    entry.total += 1;
    byIp.set(v.ipHash, entry);
  }

  const clusters: SuspiciousCluster[] = [];
  for (const [ipHash, entry] of byIp) {
    if (entry.voters.size > voterThreshold) {
      clusters.push({
        ipHash,
        distinctVoters: entry.voters.size,
        totalVotes: entry.total,
        submissionIds: [...entry.submissions]
      });
    }
  }

  return clusters.sort((a, b) => b.distinctVoters - a.distinctVoters);
}
