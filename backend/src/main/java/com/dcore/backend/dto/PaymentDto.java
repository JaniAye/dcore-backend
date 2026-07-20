package com.dcore.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class PaymentDto {
    private Long id;
    private BigDecimal amount;
    private String paymentMethod;
    private LocalDateTime createdAt;
}
