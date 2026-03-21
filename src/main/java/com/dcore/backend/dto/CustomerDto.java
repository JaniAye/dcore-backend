package com.dcore.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.math.BigDecimal;

@Data
@Builder
public class CustomerDto {
    private Long id;
    private String name;
    private String mobile;
    private LocalDateTime createdAt;
    private BigDecimal outstandingBalance;
}
