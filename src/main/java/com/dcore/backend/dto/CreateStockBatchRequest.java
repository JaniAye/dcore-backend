package com.dcore.backend.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class CreateStockBatchRequest {
    private Long productId;
    private Integer quantity;
    private BigDecimal baseCost;
}
