import {
  ReviewPacket,
  type ReviewPacket as ReviewPacketArtifact,
} from "../contracts/design/review.ts";
import { reviewPacketSha256 } from "./review.ts";

function escapeMarkdown(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\\", "\\\\")
    .replaceAll("`", "\\`")
    .replaceAll("*", "\\*")
    .replaceAll("_", "\\_")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ")
    .replaceAll("\r", " ")
    .trim();
}

function captureLink(packet: ReviewPacketArtifact, captureId: string): string | null {
  const capture = packet.captures.find(({ id }) => id === captureId);
  if (!capture) return null;
  const label = `${capture.viewport.label} ${capture.viewport.width}×${capture.viewport.height} · ${capture.stateKind}`;
  return `[${escapeMarkdown(label)}](../${capture.path})`;
}

function refs(value: string[]): string {
  return value.length === 0 ? "—" : value.map((id) => `\`${id}\``).join(", ");
}

/** A read-only human-facing projection. The validated review packet remains authoritative. */
export function renderReviewSummary(packetValue: ReviewPacketArtifact): string {
  const packet = ReviewPacket.parse(packetValue);
  const packetHash = reviewPacketSha256(packet);
  const lines = [
    `# Design review · ${packet.intent.product}`,
    "",
    "> Generated, read-only summary of `packet.json`. The packet is authoritative; human decisions must bind to its SHA-256, not this projection.",
    "",
    `- Run: \`${packet.runRef}\``,
    `- Source packet SHA-256: \`${packetHash}\``,
    `- Decision schema: accept (including keep/borrow), reject, revise, or prefer; record decisions in \`decision.json\`.`,
    "",
    "## Project intent",
    "",
    escapeMarkdown(packet.intent.rationale),
    "",
  ];

  packet.directionReviews.forEach(({ direction, critique }, index) => {
    const assessments = new Map(critique.choiceAssessments.map((assessment) => [assessment.choiceRef, assessment]));
    lines.push(`## Direction ${index + 1}`, "", `### Thesis`, "", escapeMarkdown(direction.thesis), "", escapeMarkdown(direction.rationale), "", "### Key choices", "");

    direction.choices.forEach((choice) => {
      const assessment = assessments.get(choice.id);
      const status = assessment?.assessment ?? "unassessed";
      const marker = status === "supported" ? "✓" : status === "weakly-supported" ? "~" : status === "unsupported-default-like" ? "!" : "?";
      lines.push(`- **${marker} ${escapeMarkdown(status)} — ${escapeMarkdown(choice.statement)}**`);
      lines.push(`  - Why: ${escapeMarkdown(choice.rationale)}`);
      const captures = choice.captureRefs.map((id) => captureLink(packet, id)).filter((link): link is string => link !== null);
      lines.push(`  - Captures: ${captures.length ? captures.join(" · ") : "none cited"}`);
      if (assessment) {
        lines.push(`  - Critic: ${escapeMarkdown(assessment.rationale)}`);
        lines.push("  - <details><summary>Choice provenance</summary>");
        lines.push(`    - Sources: ${refs(assessment.supportRefs.map(({ id }) => id))}`);
        lines.push("  </details>");
      }
      lines.push("  - <details><summary>Decision provenance</summary>");
      lines.push(`    - Intent: ${refs(choice.intentRefs)}`);
      lines.push(`    - Reference aspects: ${refs(choice.referenceAspectRefs)}`);
      lines.push(`    - Evidence: ${refs(choice.evidenceRefs)}`);
      lines.push(`    - Profile items: ${refs((choice.profileRefs ?? []).map(({ id }) => id))}`);
      lines.push("  </details>", "");
    });

    lines.push("### Critic concerns", "");
    if (critique.findings.length === 0) {
      lines.push("No findings recorded.", "");
    } else {
      critique.findings.forEach((finding) => {
        const stateLinks = finding.supportRefs
          .filter((ref) => ref.kind === "state-evidence")
          .map((ref) => captureLink(packet, ref.id))
          .filter((link): link is string => link !== null);
        lines.push(`- **${escapeMarkdown(finding.severity)} · ${escapeMarkdown(finding.category)}:** ${escapeMarkdown(finding.rationale)}`);
        lines.push(`  - Suggested resolution: ${escapeMarkdown(finding.suggestedResolution)}`);
        if (stateLinks.length) lines.push(`  - Relevant captures: ${stateLinks.join(" · ")}`);
      });
      lines.push("");
    }

    lines.push("### Uncertainties", "");
    if (critique.uncertainties.length === 0 && direction.uncertainties.length === 0) {
      lines.push("None recorded.", "");
    } else {
      [...new Set([...direction.uncertainties, ...critique.uncertainties])].forEach((uncertainty) => {
        lines.push(`- ${escapeMarkdown(uncertainty)}`);
      });
      lines.push("");
    }
  });

  lines.push(
    "## Source packet",
    "",
    "Open `packet.json` for the complete evidence and citation record. This summary does not carry screenshots inline and is not a decision target.",
    "",
  );
  return lines.join("\n");
}
