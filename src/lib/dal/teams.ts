/**
 * Teams DAL — stub (teams table removed in mission migration).
 * Team functionality is now handled by the mission system.
 */

export async function getTeams(): Promise<never[]> {
  return [];
}

export async function getTeam(_id: string): Promise<undefined> {
  return undefined;
}
