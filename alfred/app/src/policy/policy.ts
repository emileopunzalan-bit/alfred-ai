import type { PolicyDecision, Role } from "../core/types.js";
import { roleAtLeast } from "./roles.js";

export type ActionName = "expense.approve" | "inventory.flag";

// policy rules: deterministic, auditable
export function evaluatePolicy(params: {
  role: Role;
  actionName: string;
  input: any;
}): PolicyDecision {
  const { role, actionName, input } = params;

  // Example: expense approvals
  if (actionName === "expense.approve") {
    const amount = Number(input?.amount ?? 0);

    // Staff cannot approve any expense
    if (!roleAtLeast(role, "FINANCE")) {
      return { decision: "DENY", reason: "Only FINANCE+ can approve expenses." };
    }

    // Any approval over 50k needs Founder (unless you're already Founder)
    if (amount > 50000 && role !== "FOUNDER") {
      return {
        decision: "REQUIRE_APPROVAL",
        reason: "Amount exceeds FINANCE limit (₱50,000).",
        requires: { approverRole: "FOUNDER", threshold: 50000 },
      };
    }

    return { decision: "ALLOW", reason: "Within expense policy." };
  }

  // Example: inventory flagging allowed for warehouse+
  if (actionName === "inventory.flag") {
    if (!roleAtLeast(role, "WAREHOUSE")) {
      return { decision: "DENY", reason: "Only WAREHOUSE+ can flag inventory issues." };
    }
    return { decision: "ALLOW", reason: "Warehouse operations permitted." };
  }

  // default: require founder approval for unknown actions
  return {
    decision: "REQUIRE_APPROVAL",
    reason: "Unclassified action. Needs Founder approval.",
    requires: { approverRole: "FOUNDER" },
  };
}

// Convenience helper for simple allow/deny checks.
export function canPerform(role: Role, action: ActionName, input: any = {}): boolean {
  return evaluatePolicy({ role, actionName: action, input }).decision === "ALLOW";
}
