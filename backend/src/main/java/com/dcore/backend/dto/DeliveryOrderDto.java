package com.dcore.backend.dto;

import com.dcore.backend.entity.DeliveryOrder;
import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class DeliveryOrderDto {
    private Long id;
    private String customerName;
    private String customerMobile;
    private String deliveryDetails;
    private LocalDateTime orderDate;
    private DeliveryOrder.OrderStatus status;
    private DeliveryOrder.PaymentMethod paymentMethod;
    private BigDecimal codAmount;
    private BigDecimal deliveryFee;
    private List<DeliveryOrderItemDto> items;

    @Data
    @Builder
    public static class DeliveryOrderItemDto {
        private Long productId;
        private String productName;
        private Integer quantity;
        private BigDecimal purchasePrice;
        private BigDecimal sellingPrice;
    }
}
