package com.dcore.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductDefaultsDto {
    private BigDecimal lastBaseCost;
    private List<CreateStockBatchRequest.ExpenseItemDto> lastExpenses;
    private BigDecimal standardPrice;
    private BigDecimal wholesalePrice;
}
