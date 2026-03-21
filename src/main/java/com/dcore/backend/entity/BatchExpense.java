package com.dcore.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "batch_expenses")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BatchExpense {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private StockBatch batch;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    private BigDecimal amount;
}
