// Income computation models under the Income Tax Act, 1961.

pub mod aadhaar;
pub mod contract;
pub mod computation;
pub mod money;
pub mod relational;
pub mod years;

pub use aadhaar::AADHAAR_REDACTED;
pub use computation::{
    AssesseeDetails, ChapterViaDeductions, Computation, DeductionItem, HeadsOfIncome, RawContent,
    TaxComputation, TaxCredits,
};
pub use contract::{
    AdjustmentItem, AnnexureDetails, AnnexureIncomeItem, AssesseeInfo, BankDetails,
    BusinessIncomeAdjustments, BusinessIncomeDetails, BusinessIncomeSection, CapitalGainSection,
    CaVerification, CoiDocument, ComputationOfTaxOnTotalIncome, ComputationOfTotalIncome,
    ConfidenceBreakdown, CreditEngineSummary, DeductionsSection, FinancialParticulars, GstTurnoverDetail,
    HealthAndEducationCess, IncomeDeclaredBusinessTurnover, LongTermCapitalGainDetails, Meta,
    NormalIncomeTaxCalculation, OtherSourcesBreakdown, OtherSourcesDetails,
    OtherSourcesSection, PartnershipFirmShare, PresumptiveTier,
    ProfitsAndGainsBusinessProfession, RateAmount, RefundDetails, ReturnDetails,
    SalariesLayout, SelfAssessmentChallan, ShortTermCapitalGainDetails, TaxCalculationDetails, TaxComputationContract,
    TaxComputationExtended, TaxSlab, TaxSlabItem, TdsDeductedItem, TdsItem, TotalIncomeDetails,
};
pub use relational::{
    BusinessDetail, CapitalGainsDetail, ChapterViA, Component, DeductionEntry, DocumentMetadata,
    HeadDetail, HeadKind, HousePropertyDetail, IncomeHead, OtherSourcesDetail,
    RelationalComputation, SalaryDetail, TaxCreditLines, TaxMatrix,
};
pub use money::Money;
pub use years::YearRange;
