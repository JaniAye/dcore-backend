package com.dcore.backend.dto;

import com.dcore.backend.entity.DeliveryOrder;
import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class DeliveryOrderRequest {
    private Long customerId;  // Optional
    private String deliveryDetails;  // Customer delivery details as text
    private DeliveryOrder.PaymentMethod paymentMethod;
    private BigDecimal codAmount;
    private BigDecimal deliveryFee;
    private List<DeliveryOrderItemRequest> items;

    @Data
    public static class DeliveryOrderItemRequest {
        private Long productId;
        private Integer quantity;
    }
}
