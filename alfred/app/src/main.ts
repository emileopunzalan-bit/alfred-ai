import { openDb } from "./memory/db.js";
import { makeAuditor } from "./audit/audit.js";
import { runCommandMode } from "./voice/commandMode.js";

// register actions (important)
import "./actions/expense.approve.js";
import "./actions/inventory.flag.js";

async function main() {
  const db = openDb("alfred.db");
  const auditor = makeAuditor(db);

  // simulate request (later: replace with voice STT text)
  const req = {
    userId: "emil",
    role: "FINANCE",
    text: "approve expense for supplier",
    context: {},
  };

  const res = await runCommandMode({ req, auditor });
  console.log(res);
}

main().catch(console.error);
