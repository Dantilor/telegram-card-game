import {
  Archive,
  Crosshair,
  Eye,
  Fingerprint,
  Radio,
  ScanLine,
  ShieldCheck,
  Timer,
} from "lucide-react";
import type { PlayerRole } from "../lib/multiplayer";

export function RoleIcon({ icon }: { icon: PlayerRole["icon"] }) {
  if (icon === "scan") return <ScanLine />;
  if (icon === "eye") return <Eye />;
  if (icon === "radio") return <Radio />;
  if (icon === "archive") return <Archive />;
  if (icon === "shield") return <ShieldCheck />;
  if (icon === "timer") return <Timer />;
  if (icon === "profile") return <Fingerprint />;
  return <Crosshair />;
}
