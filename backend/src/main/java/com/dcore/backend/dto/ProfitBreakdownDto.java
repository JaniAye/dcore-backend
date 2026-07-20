package com.dcore.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Builder
public class ProfitBreakdownDto {
    private BigDecimal posProfit;
    private BigDecimal deliveryProfit;
    private BigDecimal miscExpenses;
    private BigDecimal totalProfit;
}
