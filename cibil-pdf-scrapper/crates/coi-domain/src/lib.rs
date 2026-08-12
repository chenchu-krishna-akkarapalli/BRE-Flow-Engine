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
    AssesseeInfo, BankDetails, BusinessProfession, CoiDocument, ComputationOfTotalIncome,
    ConfidenceBreakdown, FinancialParticulars, Meta, PresumptiveTier, ReturnDetails, TaxComputationContract,
    TaxSlab, TdsItem,
};
pub use relational::{
    BusinessDetail, CapitalGainsDetail, ChapterViA, Component, DeductionEntry, DocumentMetadata,
    HeadDetail, HeadKind, HousePropertyDetail, IncomeHead, OtherSourcesDetail,
    RelationalComputation, SalaryDetail, TaxCreditLines, TaxMatrix,
};
pub use money::Money;
pub use years::YearRange;
