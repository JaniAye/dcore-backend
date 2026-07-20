package com.dcore.backend.dto;

import com.dcore.backend.entity.DiscountLevel;
import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class SaleDto {
    private Long id;
    private String invoiceId;
    private Long customerId;
    private String customerName;
    private String sellerName;
    private BigDecimal totalAmount;
    private BigDecimal discountAmount;
    private BigDecimal finalAmount;
    private DiscountLevel discountLevel;
    private String discountReason;
    private Boolean isInternal;
    private String internalReason;
    private LocalDateTime createdAt;
    private List<SaleItemDto> items;
    private List<PaymentDto> payments;
    private BigDecimal outstandingBalance;
}
