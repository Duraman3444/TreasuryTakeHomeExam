import { parseABV, diffWords, verifyLabel, STANDARD_GOVERNMENT_WARNING_FULL } from "./verifier";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

function testABVParser() {
  console.log("\n--- Testing ABV Parser ---");
  assert(parseABV("45% Alc./Vol.") === 45, "Should parse standard ABV percentage");
  assert(parseABV("40% alc/vol") === 40, "Should parse lowercase ABV");
  assert(parseABV("13.5% Vol.") === 13.5, "Should parse decimal ABV");
  assert(parseABV("90 Proof") === 45, "Should convert proof to ABV");
  assert(parseABV("alc 40 vol") === 40, "Should parse naked alc vol");
  assert(parseABV("none") === null, "Should return null for invalid strings");
}

function testDiffWords() {
  console.log("\n--- Testing Word Diff (LCS) ---");
  const diff1 = diffWords("OLD TOM", "stone's throw");
  assert(diff1.some(d => d.type === "added"), "Should flag added words");
  assert(diff1.some(d => d.type === "removed"), "Should flag removed words");

  const diff2 = diffWords("Old Tom", "OLD TOM");
  assert(diff2.every(d => d.type === "mismatch-case"), "Should flag case mismatch");
}

function testVerifier() {
  console.log("\n--- Testing Compliance Verifier ---");
  
  // Test case 1: Exact Compliant Match
  const form = {
    brandName: "OLD TOM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    abv: "45% Alc./Vol.",
    netContents: "750 mL",
    governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL,
  };
  
  const extractedExact = {
    brandName: "OLD TOM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    abv: "45% Alc./Vol.",
    netContents: "750 mL",
    governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL,
    isGovernmentWarningPresent: true
  };

  const reportExact = verifyLabel(form, extractedExact);
  assert(reportExact.overallStatus === "MATCH", "Overall status should be MATCH for exact matches");
  assert(reportExact.fields.brandName.status === "MATCH", "Brand name should match");
  assert(reportExact.fields.abv.status === "MATCH", "ABV should match exactly");
  assert(reportExact.fields.governmentWarning.status === "MATCH", "Government warning should match");

  // Test case 2: Compliance with Warning (formatting differs)
  const extractedWarning = {
    ...extractedExact,
    abv: "45% Alc./Vol. (90 Proof)"
  };
  const reportWarning = verifyLabel(form, extractedWarning);
  assert(reportWarning.overallStatus === "WARNING", "Overall status should be WARNING for formatting differences");
  assert(reportWarning.fields.abv.status === "WARNING", "ABV should show WARNING status");

  // Test case 3: Title Case Warning Mismatch (Sarah & Jenny's rejection criteria)
  const extractedBadWarning = {
    ...extractedExact,
    governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL.replace("GOVERNMENT WARNING:", "Government Warning:")
  };
  const reportBadWarning = verifyLabel(form, extractedBadWarning);
  assert(reportBadWarning.overallStatus === "MISMATCH", "Should reject if warning prefix is title-case");
  assert(reportBadWarning.fields.governmentWarning.status === "MISMATCH", "Warning status should be MISMATCH");
  assert(reportBadWarning.fields.governmentWarning.message.includes("ALL CAPS"), "Should flag ALL CAPS requirement");
}

function runAllTests() {
  try {
    testABVParser();
    testDiffWords();
    testVerifier();
    console.log("\n[SUCCESS] All compliance engine tests passed successfully!\n");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`\n[FAIL] Test suite failed: ${message}\n`);
    process.exit(1);
  }
}

runAllTests();
