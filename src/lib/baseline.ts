/**
 * Baseline checklist, taken from the Intuit process. New clients start from a
 * copy of this (or of another client's checklist) and can then be edited.
 */
export interface TemplateSeed {
  phase: "ONBOARDING" | "OFFBOARDING";
  title: string;
  description: string;
  owner: "EMPLOYEE" | "HR";
}

export const BASELINE_CHECKLIST: TemplateSeed[] = [
  { phase: "ONBOARDING", owner: "EMPLOYEE", title: "WFH acknowledgement", description: "Read and acknowledge the work-from-home policy." },
  { phase: "ONBOARDING", owner: "EMPLOYEE", title: "Exhibit A — Telecommuter policy", description: "Complete and sign Exhibit A, telecommuter policy." },
  { phase: "ONBOARDING", owner: "EMPLOYEE", title: "Exhibit A — Remote access policy", description: "Complete and sign Exhibit A, remote access policy." },
  { phase: "ONBOARDING", owner: "EMPLOYEE", title: "Infosec training", description: "Complete the client's information security training." },
  { phase: "OFFBOARDING", owner: "EMPLOYEE", title: "Return client assets", description: "Hand over every client-issued asset to the location's asset SPOC." },
  { phase: "OFFBOARDING", owner: "HR", title: "Asset return confirmed by SPOC", description: "SPOC confirms all assets were received back." },
];
