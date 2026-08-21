use payslip_domain::{AmountField, Payslip, RelationalPayslip};

pub fn to_relational(payslip: &Payslip) -> RelationalPayslip {
    let mut rel = payslip.clone();
    for stmt in &mut rel.statements {
        let mut total_incentives_val = 0.0;
        let mut first_incentive_item: Option<(String, Option<AmountField>)> = None;
        let mut incentive_count = 0;

        let mut total_allowances_val = 0.0;
        let mut allowance_count = 0;

        for item in &stmt.earnings.items {
            let cat = item.canonical_category.as_str();
            let val = item.amount.as_ref().and_then(|a| a.value).unwrap_or(0.0);

            if cat == "production_incentive_bonus"
                || cat == "statutory_bonus"
                || cat == "overtime"
                || cat == "arrears"
                || cat == "performance_incentive"
                || cat == "bonus_incentive"
            {
                if val > 0.0 {
                    total_incentives_val += val;
                    incentive_count += 1;
                    if first_incentive_item.is_none() {
                        first_incentive_item = Some((item.raw_label.clone(), item.amount.clone()));
                    }
                }
            } else if cat != "basic_pay" && !cat.contains("basic") {
                if val > 0.0 {
                    total_allowances_val += val;
                    allowance_count += 1;
                }
            }
        }

        if total_incentives_val > 0.0 && stmt.summary.total_incentives_and_bonus.is_none() {
            let (raw_label, raw_val_str) = if incentive_count == 1 {
                if let Some((r_label, amt_opt)) = first_incentive_item {
                    let r_val = amt_opt.and_then(|a| a.raw_value_string.clone()).unwrap_or_else(|| format!("{:.2}", total_incentives_val));
                    (r_label, r_val)
                } else {
                    ("total_incentives_and_bonus".to_string(), format!("{:.2}", total_incentives_val))
                }
            } else {
                ("total_incentives_and_bonus".to_string(), format!("{:.2}", total_incentives_val))
            };
            stmt.summary.total_incentives_and_bonus = Some(AmountField::new(
                total_incentives_val,
                &raw_label,
                &raw_val_str,
                "computed_from_components",
                1.0,
            ));
        }

        if total_allowances_val > 0.0 && stmt.summary.total_allowances.is_none() {
            stmt.summary.total_allowances = Some(AmountField::new(
                total_allowances_val,
                "total_allowances",
                &format!("{:.2}", total_allowances_val),
                "computed_from_components",
                1.0,
            ));
        }
    }
    rel
}
