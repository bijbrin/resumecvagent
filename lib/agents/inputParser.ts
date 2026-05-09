import {
  type ResumeJobState,
  AgentStatus,
  updateAgentStatus,
} from "../state/resumeState";

/**
 * Normalizes raw inputs into a clean ResumeJobState.
 * Strips tracking params from the job URL, trims whitespace, etc.
 * Placeholder — real implementation parses PDF/DOCX uploads.
 */
export async function inputParserNode(
  state: ResumeJobState,
): Promise<Partial<ResumeJobState>> {
  return {
    // Normalize the job URL (strip UTM params, etc.) — real logic goes here
    jobUrl: state.jobUrl.split("?")[0] ?? state.jobUrl,
    ...updateAgentStatus(state, "inputParser", AgentStatus.Completed),
  };
}
