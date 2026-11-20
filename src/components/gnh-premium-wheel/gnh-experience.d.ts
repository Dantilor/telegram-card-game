export type CatalogGame = {
  id: string;
  title: string;
  image: string;
  players: [number, number];
  minutes: number;
  moods: Array<'fun' | 'brain' | 'mystery' | 'close'>;
  premium: boolean;
  description: string;
  /** Optional manually wrapped label, e.g. 'Мафия:|Тени города'. */
  wheelLabel?: string;
};
export type PremiumPlan = {
  id: string;
  label: string;
  days: number | null;
  price: number;
  currency: 'RUB';
  description: string;
  badge?: string;
  recommended?: boolean;
  cta?: string;
};
export type ReturnContext = { returnView: 'premium' | 'wheel'; selectedGameId: string | null };
export type ExperienceHandle = {
  showPremium(): void;
  showWheel(): void;
  refreshAccess(): void;
  destroy(): void;
};
export type ExperienceOptions = {
  catalog: CatalogGame[];
  plans: PremiumPlan[];
  assetBase: string;
  featuredGameIds?: string[];
  initialView?: 'premium' | 'wheel' | 'plans';
  demoMode?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
  isPremium?: boolean | (() => boolean);
  onCheckout?: (plan: PremiumPlan, context: ReturnContext) => void | Promise<void>;
  onStartGame?: (gameId: string) => void | Promise<void>;
  onNeedPremium?: (gameId: string) => void;
  onViewChange?: (view: 'premium' | 'wheel') => void;
  onGoHome?: () => void;
};
export function mountGnhExperience(root: HTMLElement, options: ExperienceOptions): ExperienceHandle;
