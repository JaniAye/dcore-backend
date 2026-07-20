package com.dcore.backend.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
public class CreateStockBatchRequest {
    private Long productId;
    private Integer quantity;
    private BigDecimal baseCost;
    private BigDecimal sellingPrice;
    private List<CreateStockBatchRequest.ExpenseItemDto> expenses;
    private BigDecimal standardPrice;
    private BigDecimal minPrice;

    @Data
    public static class ExpenseItemDto {
        private String description;
        private BigDecimal amount;
    }
}
