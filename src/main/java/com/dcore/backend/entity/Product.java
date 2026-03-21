package com.dcore.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "products")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String itemCode;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    private String modelsSupported;

    private String imageUrl;

    // Pricing levels (LKR)
    @Column(nullable = false)
    private BigDecimal standardPrice;

    private BigDecimal priceLevel2;

    private BigDecimal priceLevel3;

    @Column(nullable = false)
    private BigDecimal minPrice; // Used for MAX discount floor
}
