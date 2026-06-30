import { AuditResult, PRCorpus } from "../services/types.js";

export interface GroundingResult {
  groundedGaps: string[];
  rejectedGaps: string[];
  grounded: boolean;
}

/**
 * Medida #2 — valida que cada gap da LLM cita (por basename ou path completo,
 * case-insensitive) um arquivo presente em corpus.files.
 *
 * Matcher MVP: basename/path exato. Não usa similaridade léxica — determinístico,
 * ~15 linhas, zero dependências, evita falso-positivo de grounding.
 */
export function validateGapsGrounding(
  result: Pick<AuditResult, "gaps">,
  corpus: PRCorpus
): GroundingResult {
  const paths = corpus.files.map((f) => f.path.toLowerCase());
  const basenames = corpus.files.map((f) => {
    const parts = f.path.toLowerCase().split("/");
    return parts[parts.length - 1];
  });

  const groundedGaps: string[] = [];
  const rejectedGaps: string[] = [];

  for (const gap of result.gaps) {
    const g = gap.toLowerCase();
    const matches =
      paths.some((p) => g.includes(p)) ||
      basenames.some((b) => g.includes(b));
    if (matches) {
      groundedGaps.push(gap);
    } else {
      rejectedGaps.push(gap);
    }
  }

  return {
    groundedGaps,
    rejectedGaps,
    grounded: groundedGaps.length > 0,
  };
}