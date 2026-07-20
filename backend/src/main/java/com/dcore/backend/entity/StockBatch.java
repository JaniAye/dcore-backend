package com.dcore.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "stock_batches")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StockBatch {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private Integer quantityInitial;

    @Column(nullable = false)
    private Integer quantityRemaining;

    @Column(nullable = false)
    private BigDecimal baseCost;

    @Column(nullable = false)
    private BigDecimal sellingPrice;

    @Column(nullable = false)
    private LocalDateTime createdAt;
}
