package com.dcore.backend.dto;

import lombok.Data;

@Data
public class CreateProductRequest {
    private String itemCode;
    private String name;
    private String description; // optional
    private String imageUrl; // optional - set via image upload
    private Boolean active;
    private java.math.BigDecimal standardPrice;
    private java.math.BigDecimal wholesalePrice;
}
