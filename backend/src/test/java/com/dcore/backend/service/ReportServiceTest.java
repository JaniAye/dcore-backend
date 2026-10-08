package com.dcore.backend.service;

import com.dcore.backend.dto.DeliveryOrderDto;
import com.dcore.backend.dto.MiscExpenseDto;
import com.dcore.backend.dto.SaleDto;
import com.dcore.backend.entity.DeliveryOrder;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportServiceTest {
    @Mock private SaleService saleService;
    @Mock private DeliveryOrderService deliveryOrderService;
    @Mock private MiscExpenseService miscExpenseService;

    @InjectMocks private ReportService reportService;

    @Test
    void returnedOrdersDeductShippingFeesButDoNotCountAsSalesOrCogs() {
        DeliveryOrderDto deliveredOrder = deliveryOrder(
                DeliveryOrder.OrderStatus.DELIVERED, "130", "10", "40", 2);
        DeliveryOrderDto returnedOrder = deliveryOrder(
                DeliveryOrder.OrderStatus.RETURNED, "100", "25", "30", 1);
        when(saleService.getAllSales()).thenReturn(List.<SaleDto>of());
        when(deliveryOrderService.getAllOrders()).thenReturn(List.of(deliveredOrder, returnedOrder));
        when(miscExpenseService.getAllExpenses()).thenReturn(List.<MiscExpenseDto>of());

        var report = reportService.getMonthlyProfit(2026, 10);

        assertEquals(new BigDecimal("120"), report.getTotalSales());
        assertEquals(new BigDecimal("80"), report.getTotalCostOfSales());
        assertEquals(new BigDecimal("25"), report.getReturnedDeliveryFees());
        assertEquals(new BigDecimal("15"), report.getNetProfit());
    }

    private DeliveryOrderDto deliveryOrder(DeliveryOrder.OrderStatus status, String cod,
            String fee, String purchasePrice, int quantity) {
        return DeliveryOrderDto.builder()
                .status(status)
                .orderDate(LocalDateTime.of(2026, 10, 2, 12, 0))
                .codAmount(new BigDecimal(cod))
                .deliveryFee(new BigDecimal(fee))
                .items(List.of(DeliveryOrderDto.DeliveryOrderItemDto.builder()
                        .purchasePrice(new BigDecimal(purchasePrice))
                        .quantity(quantity)
                        .build()))
                .build();
    }
}