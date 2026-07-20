package com.dcore.backend.dto;

import com.dcore.backend.entity.DiscountLevel;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
public class SaleRequest {
    private Long customerId;
    private List<SaleItemRequest> items;
    private DiscountLevel discountLevel;
    private BigDecimal customDiscountAmount;
    private String discountType; // "PERCENTAGE" or "FIXED"
    private String discountReason;
    private Boolean isInternal;
    private String internalReason;
    private BigDecimal paymentAmount;
    private String paymentMethod;
}
