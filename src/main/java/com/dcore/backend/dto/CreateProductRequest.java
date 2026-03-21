package com.dcore.backend.dto;

import lombok.Data;

@Data
public class CreateProductRequest {
    private String itemCode;
    private String name;
    private String description; // optional
    private String imageUrl;    // optional - set via image upload
    private java.math.BigDecimal standardPrice;
    private java.math.BigDecimal priceLevel2;
    private java.math.BigDecimal priceLevel3;
    private java.math.BigDecimal minPrice;
}
