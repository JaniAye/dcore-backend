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
    void monthlyProfitUsesEachBatchCostForPosAndDeliveredOrders() {
        SaleDto posSale = SaleDto.builder()
                .createdAt(LocalDateTime.of(2026, 10, 2, 12, 0))
                .finalAmount(new BigDecimal("4000"))
                .isInternal(false)
                .cancelled(false)
                .items(List.of(
                        saleItem("100", 10),
                        saleItem("120", 10)))
                .build();
        DeliveryOrderDto deliveredOrder = DeliveryOrderDto.builder()
                .status(DeliveryOrder.OrderStatus.DELIVERED)
                .orderDate(LocalDateTime.of(2026, 10, 2, 12, 0))
                .codAmount(new BigDecimal("4000"))
                .deliveryFee(BigDecimal.ZERO)
                .items(List.of(
                        deliveryItem("100", 10),
                        deliveryItem("120", 10)))
                .build();
        when(saleService.getAllSales()).thenReturn(List.of(posSale));
        when(deliveryOrderService.getAllOrders()).thenReturn(List.of(deliveredOrder));
        when(miscExpenseService.getAllExpenses()).thenReturn(List.of());

        var report = reportService.getMonthlyProfit(2026, 10);

        assertEquals(new BigDecimal("8000"), report.getTotalSales());
        assertEquals(new BigDecimal("4400"), report.getTotalCostOfSales());
        assertEquals(new BigDecimal("3600"), report.getNetProfit());
    }

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

        @Test
        void cancelledInvoicesDoNotCountAsSalesOrCostOfSales() {
                SaleDto cancelledSale = SaleDto.builder()
                                .createdAt(LocalDateTime.of(2026, 10, 2, 12, 0))
                                .finalAmount(new BigDecimal("50"))
                                .isInternal(false)
                                .cancelled(true)
                                .items(List.of(com.dcore.backend.dto.SaleItemDto.builder()
                                                .quantity(1)
                                                .subtotal(new BigDecimal("50"))
                                                .purchasePrice(new BigDecimal("20"))
                                                .build()))
                                .build();
                when(saleService.getAllSales()).thenReturn(List.of(cancelledSale));
                when(deliveryOrderService.getAllOrders()).thenReturn(List.of());
                when(miscExpenseService.getAllExpenses()).thenReturn(List.of());

                var report = reportService.getMonthlyProfit(2026, 10);

                assertEquals(BigDecimal.ZERO, report.getTotalSales());
                assertEquals(BigDecimal.ZERO, report.getTotalCostOfSales());
                assertEquals(BigDecimal.ZERO, report.getNetProfit());
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

        private com.dcore.backend.dto.SaleItemDto saleItem(String purchasePrice, int quantity) {
                return com.dcore.backend.dto.SaleItemDto.builder()
                                .purchasePrice(new BigDecimal(purchasePrice))
                                .quantity(quantity)
                                .subtotal(new BigDecimal("200").multiply(BigDecimal.valueOf(quantity)))
                                .build();
        }

        private DeliveryOrderDto.DeliveryOrderItemDto deliveryItem(String purchasePrice, int quantity) {
                return DeliveryOrderDto.DeliveryOrderItemDto.builder()
                                .purchasePrice(new BigDecimal(purchasePrice))
                                .quantity(quantity)
                                .build();
        }
}