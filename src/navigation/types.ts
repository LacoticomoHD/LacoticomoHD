export type RootStackParamList = {
  Tabs: undefined;
  /** Anmelden/Registrieren – wird als Overlay gezeigt, wenn ein Gast eine
   *  Aktion auslöst, die ein Konto braucht (Bewerten, Eintragen, Merken …). */
  Auth: undefined;
  ShopDetail: { shopId: string };
  RateShop: { shopId: string; shopName: string; latitude: number; longitude: number };
  ReportShop: { shopId: string; shopName: string };
  AddShop: undefined;
  EditShop: { shopId: string };
  MyRatings: undefined;
  Favorites: undefined;
  ReportsInbox: undefined;
  ShopEdits: undefined;
  Legal: undefined;
};

export type TabParamList = {
  Karte: undefined;
  Liste: undefined;
  Top10: undefined;
  Profil: undefined;
};
