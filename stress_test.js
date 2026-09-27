#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "stress_test_log.txt");
const TIMESTAMP = new Date().toISOString();

let testStats = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

function log(msg) {
  console.log(msg);
}

function writeLog() {
  let summary = "╔════════════════════════════════════════════════════════════════════════════╗\n";
  summary += "║                     TRIANGLE.HTML STRESS TEST REPORT                       ║\n";
  const gen = "Generated: " + TIMESTAMP;
  summary += "║" + gen.padStart(gen.length + Math.floor((76 - gen.length) / 2)).padEnd(76) + "║\n";
  summary += "╚════════════════════════════════════════════════════════════════════════════╝\n\n";
  summary += "SUMMARY\n";
  summary += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
  summary += "Total Tests:    " + testStats.total + "\n";
  summary += "Passed:         " + testStats.passed + " ✓\n";
  summary += "Failed:         " + testStats.failed + " ✗\n";
  const rate = testStats.total > 0 ? ((testStats.passed / testStats.total) * 100).toFixed(2) : 0;
  summary += "Success Rate:   " + rate + "%\n\n";
  summary += "DETAILED TEST RESULTS\n";
  summary += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

  let logContent = summary;

  let passedTests = [];
  let failedTests = [];

  testStats.tests.forEach(test => {
    if (test.passed) {
      passedTests.push(test);
    } else {
      failedTests.push(test);
    }
  });

  logContent += "\nPASSED TESTS (" + passedTests.length + ")\n";
  logContent += "─".repeat(80) + "\n";
  passedTests.forEach((test, idx) => {
    logContent += (idx + 1) + ". [" + test.category + "] " + test.name + "\n";
    logContent += "   Status: PASS\n";
    if (test.details) logContent += "   Details: " + test.details + "\n";
    logContent += "\n";
  });

  logContent += "\nFAILED TESTS (" + failedTests.length + ")\n";
  logContent += "─".repeat(80) + "\n";
  failedTests.forEach((test, idx) => {
    logContent += (idx + 1) + ". [" + test.category + "] " + test.name + "\n";
    logContent += "   Status: FAIL\n";
    logContent += "   Error: " + test.error + "\n";
    if (test.expected) logContent += "   Expected: " + test.expected + "\n";
    if (test.actual) logContent += "   Got: " + test.actual + "\n";
    logContent += "   Reproduction: " + (test.reproduction || "N/A") + "\n";
    logContent += "\n";
  });

  logContent += "\n" + "═".repeat(80) + "\n";
  logContent += "END OF REPORT\n";

  fs.writeFileSync(LOG_FILE, logContent, "utf-8");
  console.log("\nLog written to: " + LOG_FILE);
}

function test(category, name, fn) {
  testStats.total++;
  try {
    const result = fn();
    /* only an explicit `true` passes — a test whose guard short-circuits
       (`x && ...` with x null) must fail, not slip through as a pass */
    if (result !== true) throw new Error("Assertion failed (returned " + result + ")");
    testStats.passed++;
    testStats.tests.push({
      category,
      name,
      passed: true,
      details: "Test executed successfully"
    });
    log("  ✓ " + name);
  } catch (err) {
    testStats.failed++;
    testStats.tests.push({
      category,
      name,
      passed: false,
      error: err.message,
      reproduction: "Run the same test again"
    });
    log("  ✗ " + name + " - " + err.message);
  }
}

const htmlFile = path.join(__dirname, "triangle.html");
const htmlContent = fs.readFileSync(htmlFile, "utf-8");

const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error("ERROR: Could not find script in HTML file");
  process.exit(1);
}

const scriptContent = scriptMatch[1];

// Extract only the math utility functions by cutting at the start of DOM code
const cutPoint = scriptContent.indexOf("const cv = document.getElementById");
const pureCode = cutPoint > 0 ? scriptContent.substring(0, cutPoint) : scriptContent;

let extractedFunctions = {};
try {
  const fn = new Function(pureCode + `
    return {
      clamp, dist, deg, radOf, fmt, fmtExact, groupExact, numFmt,
      gcdInt, niceRatio, fractionStr, piStr,
      parseMeasure, solveN, anglesFromSides, angleAt, solvePositions,
      canonical, signedArea2, sidesOf, derive
    };
  `);
  extractedFunctions = fn();
} catch (err) {
  console.error("ERROR extracting functions:", err.message);
  process.exit(1);
}

log("\nSTRESS TESTING TRIANGLE.HTML");
log("═".repeat(80));

log("\nMath Utilities");
log("─".repeat(40));

test("Math", "clamp: value within range", () => {
  return extractedFunctions.clamp(5, 0, 10) === 5;
});

test("Math", "clamp: value below min", () => {
  return extractedFunctions.clamp(-5, 0, 10) === 0;
});

test("Math", "clamp: value above max", () => {
  return extractedFunctions.clamp(15, 0, 10) === 10;
});

test("Math", "dist: distance calculation", () => {
  const d = extractedFunctions.dist({ x: 0, y: 0 }, { x: 3, y: 4 });
  return Math.abs(d - 5) < 0.0001;
});

test("Math", "deg: radians to degrees", () => {
  const d = extractedFunctions.deg(Math.PI);
  return Math.abs(d - 180) < 0.0001;
});

test("Math", "radOf: degrees to radians", () => {
  const r = extractedFunctions.radOf(180);
  return Math.abs(r - Math.PI) < 0.0001;
});

log("\nNumber Formatting");
log("─".repeat(40));

test("Format", "fmt: normal positive number", () => {
  const result = extractedFunctions.fmt(3.14159, 2);
  return result === "3.14";
});

test("Format", "fmt: null value", () => {
  return extractedFunctions.fmt(null, 2) === "—";
});

test("Format", "fmt: infinity", () => {
  return extractedFunctions.fmt(Infinity, 2) === "∞";
});

test("Format", "fmt: very small number", () => {
  const result = extractedFunctions.fmt(0.000001, 2);
  return result.includes("e");
});

test("Format", "fmtExact: exact formatting", () => {
  const result = extractedFunctions.fmtExact(5.0);
  return result === "5.0";
});

test("Format", "fmtExact: trailing zeros trimmed", () => {
  const result = extractedFunctions.fmtExact(3.14);
  return result === "3.14";
});

test("Format", "groupExact: aligned decimals", () => {
  const result = extractedFunctions.groupExact([1, 1.5, 2.25]);
  return result.length === 3 && result.every(s => typeof s === "string");
});

log("\nFraction & Pi Detection");
log("─".repeat(40));

test("Fractions", "niceRatio: simple fraction", () => {
  const ratio = extractedFunctions.niceRatio(0.5, 10);
  return !!ratio && ratio.num === 1 && ratio.den === 2;
});

test("Fractions", "niceRatio: null for irrational", () => {
  const ratio = extractedFunctions.niceRatio(Math.sqrt(2), 100);
  return ratio === null;
});

test("Fractions", "fractionStr: outputs string", () => {
  const str = extractedFunctions.fractionStr(0.5);
  return str === "1/2";
});

test("Fractions", "piStr: pi multiple", () => {
  const str = extractedFunctions.piStr(Math.PI);
  return str === "π";
});

test("Fractions", "piStr: pi fraction", () => {
  const str = extractedFunctions.piStr(Math.PI / 2);
  return str === "π/2";
});

log("\nInput Parsing");
log("─".repeat(40));

test("Parse", "parseMeasure: numeric inches", () => {
  const result = extractedFunctions.parseMeasure("3.5", "side", "in");
  return !!result && result.value === 3.5;
});

test("Parse", "parseMeasure: feet", () => {
  const result = extractedFunctions.parseMeasure("5 ft", "side", "in");
  return !!result && result.value === 60 && result.unit === "ft";
});

test("Parse", "parseMeasure: centimeters", () => {
  const result = extractedFunctions.parseMeasure("100 cm", "side", "cm");
  return !!result && result.unit === "cm" && Math.abs(result.value - 100 / 2.54) < 1e-9;
});

test("Parse", "parseMeasure: feet and inches", () => {
  const result = extractedFunctions.parseMeasure("5'6\"", "side", "ft");
  return !!result && Math.abs(result.value - 66) < 0.01;
});

test("Parse", "parseMeasure: invalid input", () => {
  const result = extractedFunctions.parseMeasure("abc", "side", "in");
  return result === null;
});

test("Parse", "parseMeasure: degrees", () => {
  const result = extractedFunctions.parseMeasure("45°", "angle", "deg");
  return !!result && Math.abs(result.value - Math.PI / 4) < 1e-12;
});

log("\nTriangle Solving");
log("─".repeat(40));

test("Solve", "anglesFromSides: 3-4-5 triangle", () => {
  const angles = extractedFunctions.anglesFromSides(3, 4, 5);
  return angles.length === 3 &&
         angles.every(a => a > 0 && a < Math.PI) &&
         Math.abs((angles[0] + angles[1] + angles[2]) - Math.PI) < 0.0001;
});

test("Solve", "anglesFromSides: sum to pi", () => {
  const angles = extractedFunctions.anglesFromSides(7, 8, 9);
  return Math.abs((angles[0] + angles[1] + angles[2]) - Math.PI) < 0.0001;
});

test("Solve", "solveN: 3x3 system needing a pivot swap", () => {
  /* 0·x + 2y + z = 7, x + y + z = 6, 2x + y + 3z = 13  →  (1, 2, 3) */
  const x = extractedFunctions.solveN([[0, 2, 1], [1, 1, 1], [2, 1, 3]], [7, 6, 13]);
  return !!x && Math.abs(x[0] - 1) < 1e-12 && Math.abs(x[1] - 2) < 1e-12 && Math.abs(x[2] - 3) < 1e-12;
});

test("Solve", "solveN: 6x6 system (the drag solver's size)", () => {
  const n = 6, xTrue = [1, -2, 3, 0.5, -1.5, 4];
  const A = [...Array(n)].map((_, i) => [...Array(n)].map((_, j) => (i === j ? 10 : 0) + Math.sin(i * 7 + j * 3)));
  const b = A.map(row => row.reduce((acc, v, j) => acc + v * xTrue[j], 0));
  const x = extractedFunctions.solveN(A, b);
  return !!x && x.every((v, i) => Math.abs(v - xTrue[i]) < 1e-10);
});

test("Solve", "canonical: sides come out exactly a, b, c", () => {
  const P = extractedFunctions.canonical(5, 4, 3, 1);
  const [a, b, c] = extractedFunctions.sidesOf(P);
  return Math.abs(a - 5) < 1e-12 && Math.abs(b - 4) < 1e-12 && Math.abs(c - 3) < 1e-12 && P[0].y > 0;
});

test("Solve", "angleAt: matches the Law of Cosines and sums to π", () => {
  const P = [{x: 0.3, y: 2.1}, {x: -1.7, y: -0.4}, {x: 2.9, y: 0.2}];
  const [a, b, c] = extractedFunctions.sidesOf(P);
  const lc = extractedFunctions.anglesFromSides(a, b, c);
  const at = [0, 1, 2].map(i => extractedFunctions.angleAt(P, i));
  return at.every((v, i) => Math.abs(v - lc[i]) < 1e-12) && Math.abs(at[0] + at[1] + at[2] - Math.PI) < 1e-12;
});

test("Solve", "solvePositions: no locks → corners stay exactly where put", () => {
  const P = [{x: 0.1, y: 1.3}, {x: -2.5, y: 0.4}, {x: 3, y: 0}];
  const out = extractedFunctions.solvePositions(P, [], [1, 1, 1], false);
  return out.every((p, i) => p.x === P[i].x && p.y === P[i].y);
});

test("Solve", "solvePositions: locked side held when the others must GROW (regression)", () => {
  /* side a locked at 6 while B and A are dragged so b + c = 5.92 < 6 —
     the old side-length solver clamped a to b + c and dropped the lock */
  const P = [{x: -0.1, y: 1.3}, {x: -2.5, y: 0.4}, {x: 3, y: 0}];
  const out = extractedFunctions.solvePositions(P, [{ type: "side", i: 0, value: 6, w: 1 }], [0.35, 0.35, 1], false);
  return Math.abs(extractedFunctions.sidesOf(out)[0] - 6) < 1e-9;
});

test("Solve", "solvePositions: locked angle held while a corner is dragged", () => {
  const P0 = [{x: 0, y: 2}, {x: -2, y: 0}, {x: 2, y: 0}];
  const A0 = extractedFunctions.angleAt(P0, 0);
  const P = [{x: 0, y: 2}, {x: -3.1, y: 0.7}, {x: 2, y: 0}];
  const out = extractedFunctions.solvePositions(P, [{ type: "angle", i: 0, value: A0, w: 1 }], [1, 0.25, 1], false);
  return Math.abs(extractedFunctions.angleAt(out, 0) - A0) < 1e-9;
});

test("Solve", "solvePositions: pinned corner lands exactly, locks still hold", () => {
  const P = [{x: 0, y: 3}, {x: 0, y: 0}, {x: 4, y: 0}];
  const cons = [{ type: "side", i: 1, value: 4, w: 1 }];
  const out = extractedFunctions.solvePositions([{x: 1, y: 3.5}, P[1], P[2]], cons, [1, 1, 1], false, 0);
  const b = extractedFunctions.sidesOf(out)[1];
  return out[0].x === 1 && out[0].y === 3.5 && Math.abs(b - 4) < 1e-9;
});

test("Solve", "solvePositions: dragging B with side a locked puts B on the circle about C", () => {
  /* the geometric answer with A and C held still is B = C + a·(cursor − C)/|cursor − C|.
     A and C are not pinned (they give way a little, as dragging does), so B lands
     near — not exactly on — that point; the lock itself must hold exactly */
  const P = [{x: 0, y: 3}, {x: 0, y: 0}, {x: 4, y: 0}];
  const cursor = {x: 1, y: 1};
  const out = extractedFunctions.solvePositions([P[0], cursor, P[2]], [{ type: "side", i: 0, value: 4, w: 1 }], [1, 0.25, 1], false);
  const d = Math.hypot(cursor.x - 4, cursor.y), ex = 4 + 4 * (cursor.x - 4) / d, ey = 4 * cursor.y / d;
  return Math.hypot(out[1].x - ex, out[1].y - ey) < 0.1 && Math.hypot(out[2].x - 4, out[2].y) < 0.1 &&
         Math.abs(extractedFunctions.sidesOf(out)[0] - 4) < 1e-9;
});

log("\nGeometry Operations");
log("─".repeat(40));

test("Geometry", "signedArea2: positive area", () => {
  const P = [{x: 0, y: 0}, {x: 1, y: 0}, {x: 0, y: 1}];
  const area = extractedFunctions.signedArea2(P);
  return area > 0;
});

test("Geometry", "sidesOf: computes side lengths", () => {
  const P = [{x: 0, y: 0}, {x: 3, y: 0}, {x: 0, y: 4}];
  const sides = extractedFunctions.sidesOf(P);
  return sides[0] === 5 && sides[1] === 4 && sides[2] === 3;
});

test("Geometry", "solvePositions: 3 locked sides → drag only moves the shape rigidly", () => {
  const P = [{x: 0, y: 3}, {x: 0, y: 0}, {x: 4, y: 0}];
  const cons = [0, 1, 2].map(i => ({ type: "side", i, value: [5, 4, 3][i], w: 1 }));
  const out = extractedFunctions.solvePositions([{x: 0, y: 3}, {x: 0.8, y: -0.6}, {x: 4, y: 0}], cons, [1, 0.25, 1], false);
  const s = extractedFunctions.sidesOf(out);
  return Math.abs(s[0] - 5) < 1e-9 && Math.abs(s[1] - 4) < 1e-9 && Math.abs(s[2] - 3) < 1e-9;
});

log("\nEdge Cases & Stress Tests");
log("─".repeat(40));

test("Edge Case", "Very large numbers", () => {
  const result = extractedFunctions.fmt(1e20, 2);
  return result.includes("e");
});

test("Edge Case", "Very small numbers", () => {
  const result = extractedFunctions.fmt(1e-20, 2);
  return result.includes("e");
});

test("Edge Case", "Negative numbers", () => {
  const result = extractedFunctions.clamp(-100, -50, 50);
  return result === -50;
});

test("Edge Case", "Zero handling in fractions", () => {
  const ratio = extractedFunctions.niceRatio(0, 10);
  return ratio === null;
});

test("Edge Case", "Degenerate triangle (collinear)", () => {
  const angles = extractedFunctions.anglesFromSides(1, 1, 2);
  return angles[0] === 0 || angles[1] === 0 || angles[2] === 0;
});

test("Edge Case", "Nearly degenerate triangle", () => {
  const angles = extractedFunctions.anglesFromSides(1, 1, 1.99);
  return angles.every(a => isFinite(a));
});

test("Edge Case", "Right triangle", () => {
  const angles = extractedFunctions.anglesFromSides(3, 4, 5);
  const rightAngle = angles.find(a => Math.abs(a - Math.PI/2) < 0.01);
  return rightAngle !== undefined;
});

test("Edge Case", "Parse with whitespace", () => {
  const result = extractedFunctions.parseMeasure("  3.5  in  ", "side", "in");
  return !!result && result.value === 3.5;
});

test("Edge Case", "Parse with comma decimal", () => {
  const result = extractedFunctions.parseMeasure("3,5 cm", "side", "cm");
  return !!result && Math.abs(result.value - 3.5 / 2.54) < 1e-9;
});

log("\nNumerical Stability");
log("─".repeat(40));

test("Numerical", "Angle sum precision", () => {
  const angles = extractedFunctions.anglesFromSides(5.5, 6.3, 7.1);
  const sum = angles[0] + angles[1] + angles[2];
  return Math.abs(sum - Math.PI) < 1e-10;
});

test("Numerical", "Distance calculation consistency", () => {
  const d1 = extractedFunctions.dist({x: 0, y: 0}, {x: 1, y: 1});
  const d2 = extractedFunctions.dist({x: 1, y: 1}, {x: 0, y: 0});
  return Math.abs(d1 - d2) < 1e-14;
});

test("Numerical", "Formatting preserves magnitude", () => {
  const v = Math.PI;
  const f = extractedFunctions.fmt(v, 5);
  return parseFloat(f) > 3.1 && parseFloat(f) < 3.2;
});

log("\nUnit Conversions");
log("─".repeat(40));

test("Units", "1 ft equals 12 in", () => {
  const ft = extractedFunctions.parseMeasure("1 ft", "side", "in");
  const inch = extractedFunctions.parseMeasure("12 in", "side", "in");
  return !!ft && !!inch && ft.value === 12 && inch.value === 12;
});

test("Units", "100 mm equals 10 cm", () => {
  const mm = extractedFunctions.parseMeasure("100 mm", "side", "mm");
  const cm = extractedFunctions.parseMeasure("10 cm", "side", "cm");
  return !!mm && !!cm && Math.abs(mm.value - cm.value) < 1e-12;
});

log("\nLoop & Recursion Tests");
log("─".repeat(40));

test("Loops", "GCD calculation", () => {
  const gcd = extractedFunctions.gcdInt(48, 18);
  return gcd === 6;
});

test("Loops", "GCD with large numbers", () => {
  const gcd = extractedFunctions.gcdInt(1000000, 500000);
  return gcd === 500000;
});

test("Loops", "groupExact with many values", () => {
  const values = Array.from({length: 100}, (_, i) => i * 0.1);
  const result = extractedFunctions.groupExact(values);
  return result.length === 100 && result.every(s => typeof s === "string");
});

log("\n");
log("═".repeat(80));
log("TEST RUN COMPLETE");
log("═".repeat(80));

writeLog();

process.exit(testStats.failed > 0 ? 1 : 0);
