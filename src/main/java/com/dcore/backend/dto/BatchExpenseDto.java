package com.dcore.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Builder
public class BatchExpenseDto {
    private Long id;
    private Long batchId;
    private String description;
    private BigDecimal amount;
}
