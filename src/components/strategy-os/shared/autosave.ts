export function getAutosaveLabel({
  dirty,
  pending,
  error,
}: {
  dirty: boolean;
  pending: boolean;
  error: boolean;
}) {
  if (error) return "Save failed";
  if (pending || dirty) return "Saving...";
  return "Saved";
}
