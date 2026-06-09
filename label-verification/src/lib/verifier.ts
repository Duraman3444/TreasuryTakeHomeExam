export interface VerificationFieldResult {
  status: 'MATCH' | 'WARNING' | 'MISMATCH' | 'INCOMPLETE';
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
  overallStatus: 'MATCH' | 'WARNING' | 'MISMATCH' | 'INCOMPLETE';
  fields: {
    brandName: VerificationFieldResult;
    classType: VerificationFieldResult;
    abv: VerificationFieldResult;
    netContents: VerificationFieldResult;
    bottlerNameAddress: VerificationFieldResult;
    countryOfOrigin: VerificationFieldResult;
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
 * Builds an INCOMPLETE result for a field whose COLA form reference value was left blank.
 * We surface what the AI read from the label so the agent can fill the form in, but we do
 * NOT treat a blank reference as a match or a mismatch — there is simply nothing to compare against.
 */
function incompleteResult(fieldLabel: string, actual: string): VerificationFieldResult {
  return {
    status: 'INCOMPLETE',
    expected: '—',
    actual: actual || 'Not detected',
    message: actual
      ? `No ${fieldLabel} entered in the COLA form. The AI read "${actual}" from the label — enter the application value to verify it.`
      : `No ${fieldLabel} entered in the COLA form, and none detected on the label.`,
  };
}

/**
 * Generic text-field comparison (exact → MATCH, casing/punctuation → WARNING,
 * substring → optional partial WARNING, otherwise MISMATCH). Blank reference → INCOMPLETE.
 * Used for free-text fields like bottler name/address and country of origin.
 */
function compareTextField(
  fieldLabel: string,
  expectedRaw: string,
  actualRaw: string,
  allowPartial = false
): VerificationFieldResult {
  const exp = expectedRaw.trim();
  const act = actualRaw.trim();
  const Cap = fieldLabel.charAt(0).toUpperCase() + fieldLabel.slice(1);

  if (!exp) return incompleteResult(fieldLabel, act);
  if (!act) {
    return { status: 'MISMATCH', expected: exp, actual: 'Not detected', message: `${Cap} could not be detected on the label.` };
  }
  if (exp === act) {
    return { status: 'MATCH', expected: exp, actual: act, message: `${Cap} matches exactly.` };
  }
  if (normalizeString(exp) === normalizeString(act)) {
    return { status: 'WARNING', expected: exp, actual: act, message: `${Cap} matches, but casing or punctuation differs.`, diff: diffWords(exp, act) };
  }
  if (allowPartial && (act.toLowerCase().includes(exp.toLowerCase()) || exp.toLowerCase().includes(act.toLowerCase()))) {
    return { status: 'WARNING', expected: exp, actual: act, message: `Partial match on ${fieldLabel}; the label and application differ in detail.`, diff: diffWords(exp, act) };
  }
  return { status: 'MISMATCH', expected: exp, actual: act, message: `${Cap} does not match the application.`, diff: diffWords(exp, act) };
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
    bottlerNameAddress?: string;
    countryOfOrigin?: string;
  },
  extracted: {
    brandName: string | null;
    classType: string | null;
    abv: string | null;
    netContents: string | null;
    governmentWarning: string | null;
    isGovernmentWarningPresent: boolean;
    bottlerNameAddress?: string | null;
    countryOfOrigin?: string | null;
    governmentWarningProminence?: 'prominent' | 'not_bold' | 'too_small' | null;
  }
): VerificationReport {
  // 1. Verify Brand Name
  const expBrand = form.brandName.trim();
  const actBrand = (extracted.brandName || '').trim();
  let brandResult: VerificationFieldResult;

  if (!expBrand) {
    brandResult = incompleteResult('brand name', actBrand);
  } else if (!actBrand) {
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

  if (!expClass) {
    classResult = incompleteResult('class/type designation', actClass);
  } else if (!actClass) {
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

  if (!expABVRaw) {
    abvResult = incompleteResult('alcohol content (ABV)', actABVRaw);
  } else if (actABVNum === null) {
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

  if (!expNet) {
    netResult = incompleteResult('net contents', actNet);
  } else if (!actNet) {
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
      // Text is exact. TTB also requires "GOVERNMENT WARNING:" to be BOLD and conspicuous,
      // so factor in the AI's visual prominence assessment (Jenny's "all caps AND bold" / "tiny text" concern).
      const prominence = extracted.governmentWarningProminence;
      if (prominence === 'not_bold') {
        warningResult = {
          status: 'WARNING',
          expected: STANDARD_GOVERNMENT_WARNING_FULL,
          actual: actWarning,
          message: 'Warning text is exact, but the "GOVERNMENT WARNING:" heading does not appear BOLD. TTB requires it in bold capital letters — verify formatting.',
        };
      } else if (prominence === 'too_small') {
        warningResult = {
          status: 'WARNING',
          expected: STANDARD_GOVERNMENT_WARNING_FULL,
          actual: actWarning,
          message: 'Warning text is exact, but it appears in small/hard-to-read text. TTB requires the statement be conspicuous and legible — recommend manual review.',
        };
      } else {
        warningResult = {
          status: 'MATCH',
          expected: STANDARD_GOVERNMENT_WARNING_FULL,
          actual: actWarning,
          message: 'Government warning matches the standard CFR Title 27 text exactly, in bold, legible form.',
        };
      }
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

  // 6. Verify Bottler Name / Address (optional field; addresses vary in formatting → allow partial)
  const bottlerResult = compareTextField(
    'bottler name/address',
    (form.bottlerNameAddress || '').trim(),
    (extracted.bottlerNameAddress || '').trim(),
    true
  );

  // 7. Verify Country of Origin (required only for imports → handle the "not declared" case gracefully)
  const expCountry = (form.countryOfOrigin || '').trim();
  const actCountry = (extracted.countryOfOrigin || '').trim();
  let countryResult: VerificationFieldResult;
  if (!expCountry && !actCountry) {
    countryResult = {
      status: 'MATCH',
      expected: '—',
      actual: '—',
      message: 'No country of origin declared — required only for imported products.',
    };
  } else if (!expCountry && actCountry) {
    countryResult = {
      status: 'WARNING',
      expected: '—',
      actual: actCountry,
      message: `Label declares a country of origin ("${actCountry}") but the application does not. Confirm the product's import status.`,
    };
  } else {
    countryResult = compareTextField('country of origin', expCountry, actCountry, true);
  }

  // Compute overall status
  const statuses = [
    brandResult.status,
    classResult.status,
    abvResult.status,
    netResult.status,
    bottlerResult.status,
    countryResult.status,
    warningResult.status,
  ];

  let overallStatus: 'MATCH' | 'WARNING' | 'MISMATCH' | 'INCOMPLETE' = 'MATCH';
  if (statuses.includes('MISMATCH')) {
    overallStatus = 'MISMATCH';
  } else if (statuses.includes('INCOMPLETE')) {
    overallStatus = 'INCOMPLETE';
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
      bottlerNameAddress: bottlerResult,
      countryOfOrigin: countryResult,
      governmentWarning: warningResult,
    },
  };
}
