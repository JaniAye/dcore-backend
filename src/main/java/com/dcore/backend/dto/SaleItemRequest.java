package com.dcore.backend.dto;

import lombok.Data;

@Data
public class SaleItemRequest {
    private Long productId;
    private Integer quantity;
}
