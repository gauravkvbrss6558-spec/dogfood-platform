export type VotingConfig = {
  votingEnabled: boolean;
  votingOpensAt: Date | null;
  votingClosesAt: Date | null;
};

/**
 * Voting is open when it's enabled, and `now` falls within
 * [votingOpensAt, votingClosesAt] (either bound may be omitted to mean
 * "no restriction on that side" — e.g. an organizer can open voting
 * immediately with no start date, or leave it open-ended with no end date).
 */
export function isVotingOpen(config: VotingConfig, now: Date): boolean {
  if (!config.votingEnabled) return false;
  if (config.votingOpensAt && now < config.votingOpensAt) return false;
  if (config.votingClosesAt && now > config.votingClosesAt) return false;
  return true;
}

/**
 * Results (vote tallies) are hidden while voting is actively open, per the
 * spec's "hidden results during voting" requirement — showing a running
 * tally mid-vote lets later voters pile onto an early leader instead of
 * judging the project on its own merits. Once voting closes (or was never
 * enabled), tallies are visible to everyone.
 */
export function shouldHideResults(config: VotingConfig, now: Date): boolean {
  return isVotingOpen(config, now);
}
