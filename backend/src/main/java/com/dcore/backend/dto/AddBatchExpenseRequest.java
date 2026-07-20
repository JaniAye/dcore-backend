package com.dcore.backend.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class AddBatchExpenseRequest {
    private Long batchId;
    private String description;
    private BigDecimal amount;
}
