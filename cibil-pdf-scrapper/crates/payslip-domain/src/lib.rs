// Payslip data primitives for Schema v2.0.

pub mod money;
pub mod payslip;
pub mod relational;

pub use money::Money;
pub use payslip::{
    AmountField, EmployeeInfo, EmployerDetails, ItemsGroup, LineItem, Period, Payslip,
    PayslipMetadata, RawContent, Reconciliation, Statement, Summary,
};
pub use relational::{RelationalPayslip, SCHEMA_VERSION};
