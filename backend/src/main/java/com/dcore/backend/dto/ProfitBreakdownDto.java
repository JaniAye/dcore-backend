package com.dcore.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Builder
public class ProfitBreakdownDto {
    private BigDecimal totalSales;
    private BigDecimal totalCostOfSales;
    private BigDecimal totalMiscExpenses;
    private BigDecimal netProfit;
}
