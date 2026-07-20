package com.dcore.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class MiscExpenseDto {
    private Long id;
    private String description;
    private BigDecimal amount;
    private LocalDate expenseDate;
    private String category;
}
