import { STANDARD_GOVERNMENT_WARNING_FULL } from "./verifier";

export interface LabelSample {
  id: string;
  name: string;
  description: string;
  formValues: {
    brandName: string;
    classType: string;
    abv: string;
    netContents: string;
    bottlerNameAddress: string;
    countryOfOrigin: string;
    governmentWarning: string;
  };
  labelValues: {
    brandName: string;
    classType: string;
    abv: string;
    netContents: string;
    bottlerNameAddress: string;
    countryOfOrigin: string;
    governmentWarning: string;
  };
  canvasOptions: {
    angle?: number;
    badLighting?: boolean;
    skew?: boolean;
    darkBg?: boolean;
  };
}

export const LABEL_SAMPLES: LabelSample[] = [
  {
    id: "compliant-bourbon",
    name: "OLD TOM BOURBON (Compliant)",
    description: "A legally compliant Bourbon Whiskey label. All fields match the application, and the Government Warning text is exact.",
    formValues: {
      brandName: "OLD TOM DISTILLERY",
      classType: "Kentucky Straight Bourbon Whiskey",
      abv: "45% Alc./Vol.",
      netContents: "750 mL",
      bottlerNameAddress: "Bottled by Old Tom Distillery, Bardstown, KY",
      countryOfOrigin: "",
      governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL,
    },
    labelValues: {
      brandName: "OLD TOM DISTILLERY",
      classType: "Kentucky Straight Bourbon Whiskey",
      abv: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
      bottlerNameAddress: "Bottled by Old Tom Distillery, Bardstown, KY",
      countryOfOrigin: "",
      governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL,
    },
    canvasOptions: {},
  },
  {
    id: "mismatch-casing-warning",
    name: "STONE'S THROW GIN (Minor Warnings)",
    description: "Contains minor mismatches: Brand name casing differs ('Stone's Throw' vs 'STONE'S THROW') and ABV is specified differently ('40% ABV' vs '40% Alc./Vol.'). These are flagged as Warnings.",
    formValues: {
      brandName: "Stone's Throw",
      classType: "Dry Gin",
      abv: "40% ABV",
      netContents: "1 L",
      bottlerNameAddress: "Distilled & Bottled by Stone's Throw Co., Portland, OR",
      countryOfOrigin: "",
      governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL,
    },
    labelValues: {
      brandName: "STONE'S THROW",
      classType: "Dry Gin",
      abv: "40% Alc./Vol.",
      netContents: "1 L",
      bottlerNameAddress: "Distilled & Bottled by Stone's Throw Co., Portland, OR",
      countryOfOrigin: "",
      governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL,
    },
    canvasOptions: {
      darkBg: true,
    },
  },
  {
    id: "non-compliant-warning-prefix",
    name: "HIGHLAND MIST (Casing Failure)",
    description: "CRITICAL FAILURE: The Government Warning prefix is written in title case ('Government Warning:') instead of mandatory ALL CAPS ('GOVERNMENT WARNING:'). Legally non-compliant.",
    formValues: {
      brandName: "HIGHLAND MIST",
      classType: "Single Malt Scotch Whisky",
      abv: "43% Alc./Vol.",
      netContents: "700 mL",
      bottlerNameAddress: "Imported by Highland Imports, New York, NY",
      countryOfOrigin: "Product of Scotland",
      governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL,
    },
    labelValues: {
      brandName: "HIGHLAND MIST",
      classType: "Single Malt Scotch Whisky",
      abv: "43% Alc./Vol.",
      netContents: "700 mL",
      bottlerNameAddress: "Imported by Highland Imports, New York, NY",
      countryOfOrigin: "Product of Scotland",
      governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL.replace("GOVERNMENT WARNING:", "Government Warning:"),
    },
    canvasOptions: {},
  },
  {
    id: "non-compliant-typo",
    name: "EL DORADO TEQUILA (Wording Mismatch)",
    description: "CRITICAL FAILURE: The warning label body has a spelling mistake: 'alcoholic beverages impairs' is written as 'alcoholic beverage impairs', and 'operate machinery' is written as 'operate machine'.",
    formValues: {
      brandName: "EL DORADO",
      classType: "Tequila Reposado",
      abv: "40% Alc./Vol.",
      netContents: "750 mL",
      bottlerNameAddress: "Imported by El Dorado Spirits, Houston, TX",
      countryOfOrigin: "Product of Mexico",
      governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL,
    },
    labelValues: {
      brandName: "EL DORADO",
      classType: "Tequila Reposado",
      abv: "40% Alc./Vol.",
      netContents: "750 mL",
      bottlerNameAddress: "Imported by El Dorado Spirits, Houston, TX",
      countryOfOrigin: "Product of Mexico",
      governmentWarning: "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverage during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machine, and may cause health problems.",
    },
    canvasOptions: {
      badLighting: true,
    },
  },
];
