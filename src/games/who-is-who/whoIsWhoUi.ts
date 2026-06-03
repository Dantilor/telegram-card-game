export type RoleIconVariant = "cyan" | "pink" | "purple" | "neutral";

export interface RoleIconStyle {
  icon: string;
  variant: RoleIconVariant;
}

const ROLE_ICONS: RoleIconStyle[] = [
  { icon: "local_fire_department", variant: "cyan" },
  { icon: "psychology", variant: "pink" },
  { icon: "visibility_off", variant: "purple" },
  { icon: "photo_camera", variant: "neutral" },
  { icon: "emoji_people", variant: "cyan" },
  { icon: "nightlife", variant: "pink" },
  { icon: "mic", variant: "purple" },
  { icon: "sports_bar", variant: "neutral" },
];

export function getRoleIconStyle(index: number): RoleIconStyle {
  return ROLE_ICONS[index % ROLE_ICONS.length];
}
