package com.dcore.backend.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class PaymentRequest {
    private Long saleId;
    private BigDecimal amount;
    private String paymentMethod;
}
