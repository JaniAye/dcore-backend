package com.dcore.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Builder
public class ProductDto {
    private Long id;
    private String itemCode;
    private String name;
    private String description;
    private Long categoryId;
    private String categoryName;
    private String modelsSupported;
    private String imageUrl;
    private BigDecimal standardPrice;
    private BigDecimal wholesalePrice;
    private Integer totalStock;
}
