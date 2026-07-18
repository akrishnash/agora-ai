export function getCredentialCode(role?: string, isModerator = false) {
  if (isModerator) return "AG";

  const normalized = (role ?? "").toLowerCase();
  const mappings: Array<[string[], string]> = [
    [["prosecutor"], "CP"],
    [["wrongful", "conviction", "innocence"], "WC"],
    [["victim"], "VR"],
    [["criminologist", "crime"], "CR"],
    [["judge", "appellate", "court"], "AJ"],
    [["security"], "SR"],
    [["safety"], "AS"],
    [["open-source", "open source"], "OS"],
    [["economist", "economic", "market"], "EC"],
    [["lawyer", "legal", "policy"], "PL"],
    [["ethicist", "ethics"], "EL"],
    [["scientist", "domain"], "DS"],
    [["skeptic"], "CS"],
    [["proponent", "advocate"], "PA"],
  ];

  return mappings.find(([terms]) => terms.some((term) => normalized.includes(term)))?.[1] ?? "EX";
}

export function getSpeakerTitle(role?: string, isModerator = false) {
  return isModerator ? "Moderator" : role || "Expert";
}
