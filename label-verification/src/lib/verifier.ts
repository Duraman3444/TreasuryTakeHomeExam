export interface VerificationFieldResult {
  status: 'MATCH' | 'WARNING' | 'MISMATCH';
  expected: string;
  actual: string;
  message: string;
  diff?: DiffPart[];
}

export interface DiffPart {
  value: string;
  type: 'match' | 'added' | 'removed' | 'mismatch-case';
}

export interface VerificationReport {
  overallStatus: 'MATCH' | 'WARNING' | 'MISMATCH';
  fields: {
    brandName: VerificationFieldResult;
    classType: VerificationFieldResult;
    abv: VerificationFieldResult;
    netContents: VerificationFieldResult;
    governmentWarning: VerificationFieldResult;
  };
}

// Standard TTB Government Health Warning Statement
export const STANDARD_GOVERNMENT_WARNING_BODY = 
  "(1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

export const STANDARD_GOVERNMENT_WARNING_FULL = 
  "GOVERNMENT WARNING: " + STANDARD_GOVERNMENT_WARNING_BODY;

/**
 * Parses alcohol content string (e.g. "45% Alc./Vol.", "90 Proof", "12%") into a percentage number.
 */
export function parseABV(text: string | null): number | null {
  if (!text) return null;
  
  // Remove spaces around percent
  const cleanText = text.replace(/\s+%/g, '%');

  // Look for percentage
  const pctMatch = cleanText.match(/(\d+(\.\d+)?)%/);
  if (pctMatch) return parseFloat(pctMatch[1]);
  
  // Look for proof
  const proofMatch = cleanText.match(/(\d+(\.\d+)?)\s*proof/i);
  if (proofMatch) return parseFloat(proofMatch[1]) / 2;
  
  // Look for naked numbers next to alc/vol
  const nakedMatch = cleanText.match(/(?:alc|vol|alcohol)\.?\s*(\d+(\.\d+)?)/i) || cleanText.match(/(\d+(\.\d+)?)\s*(?:alc|vol|alcohol)/i);
  if (nakedMatch) return parseFloat(nakedMatch[1]);

  // Try to parse the first float in the text
  const numberMatch = cleanText.match(/(\d+(\.\d+)?)/);
  if (numberMatch) return parseFloat(numberMatch[1]);

  return null;
}

/**
 * Computes word-level diff between two strings using Longest Common Subsequence (LCS).
 */
export function diffWords(expected: string, actual: string): DiffPart[] {
  // Normalize whitespaces, but keep them in tokens for rendering
  const wordsExp = expected.trim().split(/\s+/).filter(Boolean);
  const wordsAct = actual.trim().split(/\s+/).filter(Boolean);
  
  const dp: number[][] = Array(wordsExp.length + 1)
    .fill(0)
    .map(() => Array(wordsAct.length + 1).fill(0));

  for (let i = 1; i <= wordsExp.length; i++) {
    for (let j = 1; j <= wordsAct.length; j++) {
      if (wordsExp[i - 1].toLowerCase() === wordsAct[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const diff: DiffPart[] = [];
  let i = wordsExp.length;
  let j = wordsAct.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && wordsExp[i - 1].toLowerCase() === wordsAct[j - 1].toLowerCase()) {
      const exp = wordsExp[i - 1];
      const act = wordsAct[j - 1];
      if (exp === act) {
        diff.unshift({ value: act, type: 'match' });
      } else {
        diff.unshift({ value: act, type: 'mismatch-case' });
      }
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ value: wordsAct[j - 1], type: 'added' });
      j--;
    } else {
      diff.unshift({ value: wordsExp[i - 1], type: 'removed' });
      i--;
    }
  }

  return diff;
}

/**
 * Helper to normalize string for comparison (removes punctuation, excess spaces, lowercases)
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Verifies the extracted values against form reference values
 */
export function verifyLabel(
  form: {
    brandName: string;
    classType: string;
    abv: string;
    netContents: string;
    governmentWarning: string;
  },
  extracted: {
    brandName: string | null;
    classType: string | null;
    abv: string | null;
    netContents: string | null;
    governmentWarning: string | null;
    isGovernmentWarningPresent: boolean;
  }
): VerificationReport {
  // 1. Verify Brand Name
  const expBrand = form.brandName.trim();
  const actBrand = (extracted.brandName || '').trim();
  let brandResult: VerificationFieldResult;

  if (!actBrand) {
    brandResult = {
      status: 'MISMATCH',
      expected: expBrand,
      actual: 'Not detected',
      message: 'Brand name could not be detected on the label.',
    };
  } else if (expBrand === actBrand) {
    brandResult = {
      status: 'MATCH',
      expected: expBrand,
      actual: actBrand,
      message: 'Brand name matches exactly.',
    };
  } else if (normalizeString(expBrand) === normalizeString(actBrand)) {
    brandResult = {
      status: 'WARNING',
      expected: expBrand,
      actual: actBrand,
      message: 'Brand name matches, but casing or punctuation is different.',
      diff: diffWords(expBrand, actBrand),
    };
  } else {
    brandResult = {
      status: 'MISMATCH',
      expected: expBrand,
      actual: actBrand,
      message: 'Brand name does not match the application.',
      diff: diffWords(expBrand, actBrand),
    };
  }

  // 2. Verify Class/Type
  const expClass = form.classType.trim();
  const actClass = (extracted.classType || '').trim();
  let classResult: VerificationFieldResult;

  if (!actClass) {
    classResult = {
      status: 'MISMATCH',
      expected: expClass,
      actual: 'Not detected',
      message: 'Class/Type designation could not be detected on the label.',
    };
  } else if (expClass === actClass) {
    classResult = {
      status: 'MATCH',
      expected: expClass,
      actual: actClass,
      message: 'Class/Type matches exactly.',
    };
  } else if (normalizeString(expClass) === normalizeString(actClass)) {
    classResult = {
      status: 'WARNING',
      expected: expClass,
      actual: actClass,
      message: 'Class/Type matches, but casing or punctuation differs.',
      diff: diffWords(expClass, actClass),
    };
  } else if (
    actClass.toLowerCase().includes(expClass.toLowerCase()) ||
    expClass.toLowerCase().includes(actClass.toLowerCase())
  ) {
    classResult = {
      status: 'WARNING',
      expected: expClass,
      actual: actClass,
      message: 'Partial match. The label specifies a variation of the Class/Type.',
      diff: diffWords(expClass, actClass),
    };
  } else {
    classResult = {
      status: 'MISMATCH',
      expected: expClass,
      actual: actClass,
      message: 'Class/Type does not match the application.',
      diff: diffWords(expClass, actClass),
    };
  }

  // 3. Verify ABV
  const expABVRaw = form.abv.trim();
  const actABVRaw = (extracted.abv || '').trim();
  const expABVNum = parseABV(expABVRaw);
  const actABVNum = parseABV(actABVRaw);
  let abvResult: VerificationFieldResult;

  if (actABVNum === null) {
    abvResult = {
      status: 'MISMATCH',
      expected: expABVRaw,
      actual: actABVRaw || 'Not detected',
      message: 'Alcohol content (ABV) could not be detected on the label.',
    };
  } else if (expABVNum === actABVNum) {
    if (expABVRaw === actABVRaw) {
      abvResult = {
        status: 'MATCH',
        expected: expABVRaw,
        actual: actABVRaw,
        message: 'ABV matches exactly.',
      };
    } else {
      abvResult = {
        status: 'WARNING',
        expected: expABVRaw,
        actual: actABVRaw,
        message: `ABV numerical strength matches (${expABVNum}%), but formatting differs.`,
      };
    }
  } else {
    abvResult = {
      status: 'MISMATCH',
      expected: expABVRaw,
      actual: actABVRaw,
      message: `ABV mismatch: Application specifies ${expABVNum}% but label shows ${actABVNum}%.`,
      diff: diffWords(expABVRaw, actABVRaw),
    };
  }

  // 4. Verify Net Contents
  const expNet = form.netContents.trim();
  const actNet = (extracted.netContents || '').trim();
  let netResult: VerificationFieldResult;

  // Normalization helper for volumes, e.g. "750 ml" -> "750ml", "750mL" -> "750ml"
  const normalizeVolume = (v: string) => v.toLowerCase().replace(/\s+/g, "");

  if (!actNet) {
    netResult = {
      status: 'MISMATCH',
      expected: expNet,
      actual: 'Not detected',
      message: 'Net contents could not be detected on the label.',
    };
  } else if (expNet === actNet) {
    netResult = {
      status: 'MATCH',
      expected: expNet,
      actual: actNet,
      message: 'Net contents match exactly.',
    };
  } else if (normalizeVolume(expNet) === normalizeVolume(actNet)) {
    netResult = {
      status: 'WARNING',
      expected: expNet,
      actual: actNet,
      message: 'Net contents match, but layout or spacing differs.',
    };
  } else {
    netResult = {
      status: 'MISMATCH',
      expected: expNet,
      actual: actNet,
      message: 'Net contents do not match.',
      diff: diffWords(expNet, actNet),
    };
  }

  // 5. Verify Government Health Warning
  const expWarning = form.governmentWarning.trim();
  const actWarning = (extracted.governmentWarning || '').trim();
  let warningResult: VerificationFieldResult;

  if (!extracted.isGovernmentWarningPresent || !actWarning) {
    warningResult = {
      status: 'MISMATCH',
      expected: expWarning,
      actual: 'Not detected',
      message: 'CRITICAL: Government Warning Statement is missing from the label.',
    };
  } else {
    // Check if the warning starts with "GOVERNMENT WARNING:" in all caps
    const hasAllCapsPrefix = actWarning.startsWith("GOVERNMENT WARNING:");
    
    // Check word-for-word body compliance
    // We compare actual warning to standard warning to ensure legal compliance,
    // and also compare it to what the user filled in the form.
    // The TTB law is strict: it must match the CFR standard word-for-word.
    const cleanActual = actWarning.replace(/\s+/g, " ");
    const cleanStandard = STANDARD_GOVERNMENT_WARNING_FULL;

    if (cleanActual === cleanStandard) {
      warningResult = {
        status: 'MATCH',
        expected: STANDARD_GOVERNMENT_WARNING_FULL,
        actual: actWarning,
        message: 'Government warning matches the standard CFR Title 27 text exactly.',
      };
    } else {
      // Find out if it is just a casing issue on the prefix or a body typo
      const bodyPartAct = actWarning.replace(/^Government Warning:\s*/i, "").trim();
      const bodyMatchesStandard = normalizeString(bodyPartAct) === normalizeString(STANDARD_GOVERNMENT_WARNING_BODY);

      if (bodyMatchesStandard) {
        if (!hasAllCapsPrefix) {
          warningResult = {
            status: 'MISMATCH',
            expected: STANDARD_GOVERNMENT_WARNING_FULL,
            actual: actWarning,
            message: 'CRITICAL WARNING: The prefix "GOVERNMENT WARNING:" must be in ALL CAPS. Title case or lowercase is legally non-compliant.',
            diff: diffWords(STANDARD_GOVERNMENT_WARNING_FULL, actWarning),
          };
        } else {
          warningResult = {
            status: 'WARNING',
            expected: STANDARD_GOVERNMENT_WARNING_FULL,
            actual: actWarning,
            message: 'Warning text matches standard, but has minor punctuation or spacing discrepancies.',
            diff: diffWords(STANDARD_GOVERNMENT_WARNING_FULL, actWarning),
          };
        }
      } else {
        warningResult = {
          status: 'MISMATCH',
          expected: STANDARD_GOVERNMENT_WARNING_FULL,
          actual: actWarning,
          message: 'CRITICAL: Government Warning contains spelling/wording errors relative to standard CFR text.',
          diff: diffWords(STANDARD_GOVERNMENT_WARNING_FULL, actWarning),
        };
      }
    }
  }

  // Compute overall status
  const statuses = [
    brandResult.status,
    classResult.status,
    abvResult.status,
    netResult.status,
    warningResult.status,
  ];

  let overallStatus: 'MATCH' | 'WARNING' | 'MISMATCH' = 'MATCH';
  if (statuses.includes('MISMATCH')) {
    overallStatus = 'MISMATCH';
  } else if (statuses.includes('WARNING')) {
    overallStatus = 'WARNING';
  }

  return {
    overallStatus,
    fields: {
      brandName: brandResult,
      classType: classResult,
      abv: abvResult,
      netContents: netResult,
      governmentWarning: warningResult,
    },
  };
}
