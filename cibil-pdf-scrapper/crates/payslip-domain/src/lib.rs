// Payslip data primitives. Every parsed field keeps the raw text it came from,
// so a wrong interpretation can always be traced back to what was on the page.

pub mod money;
pub mod payslip;

pub use money::Money;
pub use payslip::{
    Deduction, Earning, EmployeeInfo, EmployerDetails, PayPeriod, Payslip, RawContent,
};
