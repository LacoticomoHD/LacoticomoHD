export type RootStackParamList = {
  Tabs: undefined;
  ShopDetail: { shopId: string };
  RateShop: { shopId: string; shopName: string };
  ReportShop: { shopId: string; shopName: string };
  AddShop: undefined;
  EditShop: { shopId: string };
  MyRatings: undefined;
  Legal: undefined;
};

export type TabParamList = {
  Karte: undefined;
  Liste: undefined;
  Profil: undefined;
};
