import { Command } from "commander";
import { registerAuditCommand } from "./commands/audit.js";
import { registerHistoryCommand } from "./commands/history.js";
import { registerFetchCommand } from "./commands/fetch.js";
import { registerFetchAndAuditCommand } from "./commands/fetch-and-audit.js";

export function createCLI(): Command {
  const program = new Command();
  program
    .name("pr-auditor")
    .description("Auditoria automatizada de Pull Requests via CLI")
    .version("0.2.0");

  registerAuditCommand(program);
  registerHistoryCommand(program);
  registerFetchCommand(program);
  registerFetchAndAuditCommand(program);

  return program;
}