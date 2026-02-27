export type TeamMeta = {
  shortName: string;
  logoUrl?: string;
};

export const TEAM_META: Record<string, TeamMeta> = {
  "Briars 3": {
    shortName: "Briars",
    logoUrl: "https://smhockey.com.au/wireframe/assets/images/briars_logo.jpg",
  },
  "Macquarie Uni 2": {
    shortName: "Macquarie",
    logoUrl: "https://smhockey.com.au/wireframe/assets/images/mac_uni.png",
  },
  "Manly GNS 4": {
    shortName: "Manly",
    logoUrl: "https://smhockey.com.au/wireframe/assets/images/manly_logo.jpg",
  },
  Penrith: {
    shortName: "Penrith",
    logoUrl: "https://smhockey.com.au/wireframe/assets/images/penrith_logo.jpg",
  },
  "Ryde HH 4": {
    shortName: "Ryde",
    logoUrl: "https://smhockey.com.au/wireframe/assets/images/ryde_logo.png",
  },
  "Macarthur 2": {
    shortName: "Macarthur",
    logoUrl: "https://smhockey.com.au/wireframe/assets/images/mac_logo.png",
  },
};

export function getTeamMeta(name: string): TeamMeta {
  return (
    TEAM_META[name] || {
      shortName: String(name || "").split(" ")[0] || "Team",
    }
  );
}
