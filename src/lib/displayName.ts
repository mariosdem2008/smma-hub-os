export type DisplayNameProfile = {
  full_name?: string | null;
  email?: string | null;
};

type DisplayNameOptions = {
  unassigned?: boolean;
  fallbackLabel?: string;
  useEmailPrefix?: boolean;
};

export function getDisplayName(
  profile: DisplayNameProfile | null | undefined,
  options: DisplayNameOptions = {}
) {
  if (options.unassigned) return "Unassigned";

  const fullName = profile?.full_name?.trim();
  if (fullName) return fullName;

  const email = profile?.email?.trim();
  if (email) {
    return options.useEmailPrefix ? email.split("@")[0] || email : email;
  }

  return options.fallbackLabel ?? "Team member";
}
