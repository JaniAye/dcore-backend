package com.dcore.backend.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class CreateProductRequest {
    private String itemCode;
    private String name;
    private String description;
    private Long categoryId;
    private String modelsSupported;
    private String imageUrl;
    private BigDecimal baseSellingPrice;
    private BigDecimal minSellingPrice;
}
