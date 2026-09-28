import type { BankFoirDetail, Phase2FoirCalculationResponse } from "./types";

export interface FoirRatioResult {
  foirPct: number;
  desc: string;
  notes?: string;
}

export type PolicyEvaluator = (
  isSalaried: boolean,
  averageIncome: number,
  gmi: number,
) => FoirRatioResult;

export const BANK_DISPLAY_NAMES: Record<string, string> = {
  BOB: "Bank of Baroda",
  BOM: "Bank of Maharashtra",
  BOI: "Bank of India",
  IOB: "Indian Overseas Bank",
  INDIAN_BANK: "Indian Bank",
  HDFC: "HDFC Bank",
  AXIS: "Axis Bank",
  KOTAK: "Kotak Mahindra Bank",
};

export const SUPPORTED_POLICY_BANKS = [
  "BOB",
  "BOM",
  "BOI",
  "IOB",
  "INDIAN_BANK",
  "HDFC",
  "AXIS",
  "KOTAK",
] as const;

/**
 * In-memory index of bank policy rules, offering O(1) evaluation
 * without procedural branching cascades.
 */
export class PolicyIndex {
  private static policyMap = new Map<string, PolicyEvaluator>();
  private static initialized = false;

  private static ensureInitialized() {
    if (this.initialized) return;

    // 1. Bank of Baroda (BOB)
    this.register("BOB", (isSalaried, averageIncome, gmi) => {
      if (isSalaried) {
        if (gmi <= 50000) return { foirPct: 0.6, desc: "GMI ≤ ₹50,000 (60%)" };
        if (gmi <= 150000) return { foirPct: 0.7, desc: "GMI ₹50,000 – ₹1,50,000 (70%)" };
        return { foirPct: 0.8, desc: "GMI > ₹1,50,000 (80%)" };
      }
      if (averageIncome < 600000) return { foirPct: 0.6, desc: "Avg Annual Income < ₹6 Lakh (60%)" };
      return { foirPct: 0.8, desc: "Avg Annual Income ≥ ₹6 Lakh (80%)" };
    });

    // 2. Bank of Maharashtra (BOM)
    this.register("BOM", (isSalaried, averageIncome, gmi) => {
      if (isSalaried) {
        if (gmi <= 50000) return { foirPct: 0.6, desc: "GMI ≤ ₹50,000 (60%)" };
        if (gmi <= 100000) return { foirPct: 0.65, desc: "GMI ₹50,000 – ₹1,00,000 (65%)" };
        if (gmi <= 200000) return { foirPct: 0.7, desc: "GMI ₹1,00,000 – ₹2,00,000 (70%)" };
        if (gmi <= 500000) return { foirPct: 0.75, desc: "GMI ₹2,00,000 – ₹5,00,000 (75%)" };
        return { foirPct: 0.8, desc: "GMI > ₹5,00,000 (80%)" };
      }
      if (averageIncome < 600000) return { foirPct: 0.6, desc: "Avg Annual Income < ₹6 Lakh (60%)" };
      if (averageIncome < 1200000) return { foirPct: 0.65, desc: "Avg Annual Income ₹6L – ₹12L (65%)" };
      if (averageIncome < 2400000) return { foirPct: 0.7, desc: "Avg Annual Income ₹12L – ₹24L (70%)" };
      if (averageIncome < 6000000) return { foirPct: 0.75, desc: "Avg Annual Income ₹24L – ₹60L (75%)" };
      return { foirPct: 0.8, desc: "Avg Annual Income ≥ ₹60 Lakh (80%)" };
    });

    // 3. Bank of India (BOI)
    this.register("BOI", (isSalaried, _avg, gmi) => {
      if (isSalaried) {
        if (gmi < 100000) return { foirPct: 0.6, desc: "GMI < ₹1 Lakh (60%)" };
        if (gmi <= 500000) return { foirPct: 0.7, desc: "GMI ₹1 Lakh – ₹5 Lakh (70%)" };
        return { foirPct: 0.75, desc: "GMI > ₹5 Lakh (75%)" };
      }
      if (gmi < 100000) return { foirPct: 0.6, desc: "Converted GMI < ₹1 Lakh (60%)", notes: "Evaluated on converted monthly income" };
      if (gmi <= 500000) return { foirPct: 0.7, desc: "Converted GMI ₹1L – ₹5L (70%)", notes: "Evaluated on converted monthly income" };
      return { foirPct: 0.75, desc: "Converted GMI > ₹5 Lakh (75%)", notes: "Evaluated on converted monthly income" };
    });

    // 4. Indian Overseas Bank (IOB)
    this.register("IOB", (isSalaried, _avg, gmi) => {
      if (isSalaried) {
        if (gmi <= 100000) return { foirPct: 0.6, desc: "GMI ≤ ₹1 Lakh (60%)" };
        return { foirPct: 0.7, desc: "GMI > ₹1 Lakh (70%)", notes: "Requires DGM Approval" };
      }
      if (gmi <= 100000) return { foirPct: 0.6, desc: "Converted GMI ≤ ₹1 Lakh (60%)", notes: "Evaluated on converted monthly income" };
      return { foirPct: 0.7, desc: "Converted GMI > ₹1 Lakh (70%)", notes: "Requires DGM Approval" };
    });

    // 5. Indian Bank (INDIAN / INDIAN_BANK)
    const indianBankEvaluator: PolicyEvaluator = (isSalaried, averageIncome, gmi) => {
      const ref = (isSalaried && averageIncome > 15000000) ? gmi : averageIncome;
      if (ref < 1500000) return { foirPct: 0.6, desc: "Income < ₹15 Lakhs (60%)" };
      return { foirPct: 0.7, desc: "Income ≥ ₹15 Lakhs (70%)", notes: "Subject to ₹50,000 minimum net take-home surplus condition" };
    };
    this.register("INDIAN", indianBankEvaluator);
    this.register("INDIAN_BANK", indianBankEvaluator);

    this.initialized = true;
  }

  public static register(bankCode: string, evaluator: PolicyEvaluator): void {
    this.policyMap.set(bankCode.toUpperCase(), evaluator);
  }

  /**
   * Retrieves the FOIR percentage and bracket description in O(1) time.
   */
  public static getFoirRatio(
    bankCode: string,
    workType: string,
    averageIncome: number,
  ): FoirRatioResult {
    this.ensureInitialized();
    const code = bankCode.toUpperCase();
    const isSalaried = workType.toLowerCase().includes("salaried");
    const gmi = Math.round((averageIncome / 12) * 100) / 100;

    const evaluator = this.policyMap.get(code);
    if (evaluator) {
      return evaluator(isSalaried, averageIncome, gmi);
    }

    // Default benchmark (HDFC, AXIS, KOTAK)
    if (isSalaried) {
      return { foirPct: 0.5, desc: "Standard Salaried Benchmark (50%)", notes: "Default benchmark" };
    }
    return { foirPct: 0.6, desc: "Standard Self-Employed Benchmark (60%)", notes: "Default benchmark" };
  }

  /**
   * Evaluates all supported banks against an assessed income and ongoing EMI.
   */
  public static evaluateAll(
    averageIncome: number,
    occupation: string,
    existingEmi: number,
  ): Phase2FoirCalculationResponse {
    const isSalaried = occupation.toLowerCase().includes("salaried");
    const workType = isSalaried ? "Salaried" : "Self-Employed";
    const averageMonthly = Math.round((averageIncome / 12) * 100) / 100;
    const baseIncome = isSalaried ? averageMonthly : Math.round(averageIncome * 100) / 100;
    const emi = Math.max(0, Number(existingEmi) || 0);

    const results: Record<string, BankFoirDetail> = {};

    for (const code of SUPPORTED_POLICY_BANKS) {
      const { foirPct, desc, notes } = this.getFoirRatio(code, workType, averageIncome);
      const foirBasedIncome = Math.round(baseIncome * foirPct * 100) / 100;
      const finalProcessed = Math.round((foirBasedIncome - emi) * 100) / 100;

      results[code] = {
        bank_code: code,
        bank_name: BANK_DISPLAY_NAMES[code] || code,
        work_type: workType,
        base_income: baseIncome,
        foir_percentage: foirPct,
        foir_based_income: foirBasedIncome,
        existing_emi: emi,
        final_processed_income: finalProcessed,
        bracket_description: desc,
        notes,
      };
    }

    return {
      average_income: averageIncome,
      average_monthly_income: averageMonthly,
      occupation: workType,
      existing_emi: emi,
      bank_foir_results: results,
    };
  }
}
