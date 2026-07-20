package com.dcore.backend.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class SaleItemRequest {
    private Long productId;
    private Integer quantity;
    private String discountType; // "PERCENTAGE", "FIXED", or "NONE"
    private BigDecimal discountValue;
    private BigDecimal overridePrice;
}
