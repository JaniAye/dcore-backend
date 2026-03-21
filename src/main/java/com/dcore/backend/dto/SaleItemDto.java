package com.dcore.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Builder
public class SaleItemDto {
    private Long id;
    private Long productId;
    private String productName;
    private Long batchId;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal subtotal;
}
