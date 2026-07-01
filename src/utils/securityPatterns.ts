/**
 * Fonte única de verdade para padrões de arquivo sensível (RNF-003).
 * Será consumido por `calculateRoutingDecision` (routing ADR-005, Task 3) e por
 * `assembleRecord` (Medida #1 floor, Task 4).
 *
 * União das listas hoje divergentes em LLMIntegrationService.ts
 * (securityPatterns vs. SENSITIVE_FILE_RE). O gate `!isDocumentation`
 * é aplicado pelo chamador (assembleRecord), não por este helper.
 *
 * Agrupado por tema, aproximadamente alfabético para legibilidade.
 */
const SENSITIVE_PATTERNS: readonly RegExp[] = [
  /api[_-]?key/i,
  /auth/i,
  /aws|gcp|azure/i,
  /certificate/i,
  /cloudformation/i,
  /credential/i,
  /crypto/i,
  /\.env/i,
  /\.github[/\\]workflows/i,
  /docker[-_]?compose/i,
  /dockerfile/i,
  /infrastructure/i,
  /infra/i,
  /k8s/i,
  /kubernetes/i,
  /password/i,
  /secret/i,
  /ssl|tls/i,
  /terraform/i,
  /token/i,
];

/**
 * Testa se o caminho do arquivo casa qualquer padrão sensível.
 * Case-insensitive (todas as regexes carregam flag /i).
 * Não recebe FileMetadata — opera só sobre o path (string);
 * o gate `!isDocumentation` é responsabilidade do chamador.
 */
export function matchesSecurityPattern(filePath: string): boolean {
  return SENSITIVE_PATTERNS.some((re) => re.test(filePath));
}
