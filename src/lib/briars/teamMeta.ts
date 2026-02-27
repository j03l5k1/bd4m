export type TeamMeta = {
  shortName: string;
  logoUrl?: string;
};

export const TEAM_META: Record<string, TeamMeta> = {
  "Briars 3": {
    shortName: "Briars",
    logoUrl: "https://smhockey.com.au/legends/assets/teams/briars.png",
  },
  "Macquarie Uni 2": {
    shortName: "Macquarie",
    logoUrl: "https://smhockey.com.au/legends/assets/teams/macquarie.png",
  },
  "Manly GNS 4": {
    shortName: "Manly",
    logoUrl: "https://smhockey.com.au/legends/assets/teams/manly.png",
  },
  Penrith: {
    shortName: "Penrith",
    logoUrl: "https://smhockey.com.au/legends/assets/teams/penrith.png",
  },
  "Ryde HH 4": {
    shortName: "Ryde",
    logoUrl: "https://smhockey.com.au/legends/assets/teams/ryde.png",
  },
  "Macarthur 2": {
    shortName: "Macarthur",
    logoUrl: "https://smhockey.com.au/legends/assets/teams/macarthur.png",
  },
};

export function getTeamMeta(name: string): TeamMeta {
  return (
    TEAM_META[name] || {
      shortName: String(name || "").split(" ")[0] || "Team",
    }
  );
}
