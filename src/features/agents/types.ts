export type AgentType =
  | ""
  | "Exclusive Partner"
  | "Direct Recruiter"
  | "Institutional Agent"
  | "Authorized Consultant"
  | "Regional Partner"
  | "Sub-Agent";

export type AgentStatus = "Active" | "Inactive" | "Suspended";

export interface AgentItem {
  id: string;
  agentCode: string;
  name: string; // Full Name
  email: string; // Email
  phone: string; // Phone
  type: AgentType; // Type
  representative: string; // Display name
  representativeId?: string; // Stable assignment identifier
  country: string; // Country
  status: AgentStatus;
  avatarUrl: string;
  joinedDate: string;
  agencyName?: string;
  notes?: string;
}
