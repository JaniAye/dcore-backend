package com.dcore.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class StockBatchDto {
    private Long id;
    private Long productId;
    private String productName;
    private Integer quantityInitial;
    private Integer quantityRemaining;
    private BigDecimal baseCost;
    private BigDecimal sellingPrice;
    private BigDecimal totalExpenses;
    private BigDecimal costPerItem;
    private LocalDateTime createdAt;
}
