import {
  Armchair,
  Brush,
  CakeSlice,
  Camera,
  Car,
  Castle,
  ClipboardCheck,
  Flower2,
  HeartHandshake,
  Mail,
  MicVocal,
  Music,
  Shirt,
  Sparkles,
  UtensilsCrossed,
  Video,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  venue: Castle,
  caterer: UtensilsCrossed,
  catering: UtensilsCrossed,
  photographer: Camera,
  videographer: Video,
  dj: Music,
  band: MicVocal,
  florist: Flower2,
  officiant: HeartHandshake,
  "planner / coordinator": ClipboardCheck,
  "hair & makeup": Brush,
  attire: Shirt,
  baker: CakeSlice,
  rentals: Armchair,
  transportation: Car,
  stationery: Mail,
};

export function vendorIcon(category: string): LucideIcon {
  return ICONS[category.toLowerCase()] ?? Sparkles;
}
