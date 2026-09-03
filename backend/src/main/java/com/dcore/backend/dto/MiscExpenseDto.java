package com.dcore.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MiscExpenseDto {
    private Long id;
    private String description;
    private BigDecimal amount;
    private LocalDate expenseDate;
    private String category;
}
