export type SolMindExplorerProfileFieldKey =
  | "displayName"
  | "preferredContact"
  | "primaryGoal"
  | "checkInCadence";

export type SolMindExplorerProfileField = {
  key: SolMindExplorerProfileFieldKey;
  label: string;
  previewValue: string;
};

export const SOLMIND_EXPLORER_PROFILE_PREVIEW_FIELDS: SolMindExplorerProfileField[] =
  [
    {
      key: "displayName",
      label: "Name",
      previewValue: "Explorer preview",
    },
    {
      key: "preferredContact",
      label: "Preferred contact",
      previewValue: "Email or SMS",
    },
    {
      key: "primaryGoal",
      label: "Current goal",
      previewValue: "Getting to know you",
    },
    {
      key: "checkInCadence",
      label: "Check-in rhythm",
      previewValue: "Daily preview",
    },
  ];