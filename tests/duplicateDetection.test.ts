import { describe, it, expect } from "vitest";
import { detectSuspiciousIpClusters } from "../lib/duplicateDetection";

describe("detectSuspiciousIpClusters", () => {
  it("does not flag an IP with few distinct voters", () => {
    const votes = [
      { submissionId: "s1", voterId: "u1", ipHash: "ip-a" },
      { submissionId: "s2", voterId: "u2", ipHash: "ip-a" }
    ];
    expect(detectSuspiciousIpClusters(votes, 3)).toEqual([]);
  });

  it("flags an IP exceeding the voter threshold", () => {
    const votes = [
      { submissionId: "s1", voterId: "u1", ipHash: "ip-a" },
      { submissionId: "s1", voterId: "u2", ipHash: "ip-a" },
      { submissionId: "s1", voterId: "u3", ipHash: "ip-a" },
      { submissionId: "s1", voterId: "u4", ipHash: "ip-a" }
    ];
    const result = detectSuspiciousIpClusters(votes, 3);
    expect(result).toHaveLength(1);
    expect(result[0].ipHash).toBe("ip-a");
    expect(result[0].distinctVoters).toBe(4);
    expect(result[0].totalVotes).toBe(4);
  });

  it("sorts multiple clusters by distinct voter count descending", () => {
    const votes = [
      { submissionId: "s1", voterId: "u1", ipHash: "ip-small" },
      { submissionId: "s1", voterId: "u2", ipHash: "ip-small" },
      { submissionId: "s1", voterId: "u3", ipHash: "ip-small" },
      { submissionId: "s1", voterId: "u4", ipHash: "ip-small" },
      { submissionId: "s1", voterId: "u5", ipHash: "ip-big" },
      { submissionId: "s1", voterId: "u6", ipHash: "ip-big" },
      { submissionId: "s1", voterId: "u7", ipHash: "ip-big" },
      { submissionId: "s1", voterId: "u8", ipHash: "ip-big" },
      { submissionId: "s1", voterId: "u9", ipHash: "ip-big" }
    ];
    const result = detectSuspiciousIpClusters(votes, 3);
    expect(result.map((c) => c.ipHash)).toEqual(["ip-big", "ip-small"]);
  });

  it("counts distinct submissions touched by a cluster", () => {
    const votes = [
      { submissionId: "s1", voterId: "u1", ipHash: "ip-a" },
      { submissionId: "s2", voterId: "u2", ipHash: "ip-a" },
      { submissionId: "s1", voterId: "u3", ipHash: "ip-a" },
      { submissionId: "s3", voterId: "u4", ipHash: "ip-a" }
    ];
    const result = detectSuspiciousIpClusters(votes, 3);
    expect(result[0].submissionIds.sort()).toEqual(["s1", "s2", "s3"]);
  });
});
