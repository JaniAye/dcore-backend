package com.dcore.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Builder
public class SaleItemDto {
    private Long id;
    private Long productId;
    private String productCode;
    private String productName;
    private String description;
    private Long batchId;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal purchasePrice;
    private BigDecimal discountAmount;
    private BigDecimal subtotal;
}
