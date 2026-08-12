use payslip_domain::{
    CompensationSummary, ComponentSection, PayComponent, Payslip, PayslipMetadata,
    Reconciliation, RelationalPayslip, SCHEMA_VERSION,
};

pub fn to_relational(payslip: &Payslip) -> RelationalPayslip {
    let earnings = payslip
        .earnings
        .iter()
        .filter(|item| item.amount.is_some())
        .map(|item| component(payslip, &item.label, item.amount.clone(), &item.raw_line))
        .collect::<Vec<_>>();
    let deductions = payslip
        .deductions
        .iter()
        .filter(|item| item.amount.is_some())
        .map(|item| component(payslip, &item.label, item.amount.clone(), &item.raw_line))
        .collect::<Vec<_>>();
    let earnings_total = earnings.iter().filter_map(|item| item.amount.as_ref()).map(|money| money.paise).sum();
    let deductions_total = deductions.iter().filter_map(|item| item.amount.as_ref()).map(|money| money.paise).sum();
    let calculated_net_pay = payslip.gross_earnings.as_ref().and_then(|gross| {
        payslip.total_deductions.as_ref().map(|deductions| {
            payslip_domain::Money::from_paise(gross.paise - deductions.paise, format!("{} - {}", gross.raw, deductions.raw))
        })
    });
    let earnings_gap = payslip.gross_earnings.as_ref().map(|stated| stated.paise - earnings_total);
    let deductions_gap = payslip.total_deductions.as_ref().map(|stated| stated.paise - deductions_total);
    RelationalPayslip {
        metadata: PayslipMetadata {
            source: payslip.source.clone(),
            format: payslip.format.clone(),
            page_count: payslip.raw.page_count,
            line_count: payslip.raw.lines.len(),
            schema_version: SCHEMA_VERSION.to_string(),
            structure_source: "layout_grid".to_string(),
        },
        employee: payslip.employee.clone(),
        employer: payslip.employer.clone(),
        pay_period: payslip.period.clone(),
        earnings: ComponentSection {
            components: earnings,
            stated_total: payslip.gross_earnings.clone(),
            parsed_total: earnings_total,
        },
        deductions: ComponentSection {
            components: deductions,
            stated_total: payslip.total_deductions.clone(),
            parsed_total: deductions_total,
        },
        compensation: CompensationSummary {
            gross_earnings: payslip.gross_earnings.clone(),
            total_deductions: payslip.total_deductions.clone(),
            net_pay: payslip.net_pay.clone(),
            net_pay_words: payslip.net_pay_words.clone(),
        },
        reconciliation: Reconciliation {
            calculated_net_pay,
            stated_net_pay: payslip.net_pay.clone(),
            balances: payslip.balances(),
            earnings_component_total: earnings_total,
            deduction_component_total: deductions_total,
            earnings_gap,
            deductions_gap,
        },
        raw: payslip.raw.clone(),
    }
}

fn component(payslip: &Payslip, label: &str, amount: Option<payslip_domain::Money>, raw_line: &str) -> PayComponent {
    let page = payslip.raw.lines.iter().find(|line| line.text() == raw_line).map(|line| line.page);
    PayComponent { label: label.to_string(), amount, raw_line: raw_line.to_string(), page }
}

#[cfg(test)]
mod tests {
    use super::to_relational;
    use payslip_domain::{Money, Payslip};

    #[test]
    fn relational_view_reconciles_totals() {
        let mut payslip: Payslip = serde_json::from_value(serde_json::json!({
            "source": "test.pdf",
            "format": "test",
            "employee": {},
            "employer": {},
            "period": {},
            "earnings": [],
            "deductions": [],
            "gross_earnings": null,
            "total_deductions": null,
            "net_pay": null,
            "net_pay_words": null,
            "raw": { "page_count": 1, "lines": [], "table": { "columns": [], "rows": [] } }
        })).unwrap();
        payslip.gross_earnings = Some(Money::parse("1000").unwrap());
        payslip.total_deductions = Some(Money::parse("100").unwrap());
        payslip.net_pay = Some(Money::parse("900").unwrap());
        let relational = to_relational(&payslip);
        assert_eq!(relational.reconciliation.calculated_net_pay.unwrap().paise, 90000);
        assert_eq!(relational.reconciliation.balances, Some(true));
    }
}
