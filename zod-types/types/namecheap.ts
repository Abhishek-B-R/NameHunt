/* Types */
export type CheckDomainResult = {
  ok: boolean;
  domain: string; 
  available: boolean;
  isPremium: boolean;
  prices: {
    premiumRegistration: number;
    premiumRenewal: number;
    premiumRestore: number;
    premiumTransfer: number;
    icannFee: number;
    eapFee?: number;
  };
  meta: {
    requestedCommand?: string;
    server?: string;
    executionTime?: number;
    gmtOffset?: string;
  };
  raw: any; // keep original parsed XML for debugging
};

export type PricingRow = {
  duration: number;
  durationType: string; // YEAR
  price: number;
  regularPrice: number;
  yourPrice: number;
  couponPrice?: number;
  currency: string;
};

export type PricingResult = {
  ok: boolean;
  tld: string;
  category: "REGISTER" | "RENEW" | "TRANSFER" | string;
  prices: PricingRow[];
  meta: {
    requestedCommand?: string;
    server?: string;
    executionTime?: number;
    gmtOffset?: string;
  };
  raw: any; // keep original parsed XML for debugging
};
