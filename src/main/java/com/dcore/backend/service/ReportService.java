package com.dcore.backend.service;

import com.dcore.backend.dto.MiscExpenseDto;
import com.dcore.backend.dto.ProfitBreakdownDto;
import com.dcore.backend.dto.SaleDto;
import com.dcore.backend.entity.DeliveryOrder;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final SaleService saleService;
    private final DeliveryOrderService deliveryOrderService;
    private final MiscExpenseService miscExpenseService;

    public BigDecimal getDailySalesAmount(LocalDate date) {
        LocalDateTime startOfDay = date.atStartOfDay();
        LocalDateTime endOfDay = date.atTime(23, 59, 59);

        // Include POS sales
        BigDecimal posSales = saleService.getAllSales().stream()
                .filter(s -> !s.getCreatedAt().isBefore(startOfDay) && !s.getCreatedAt().isAfter(endOfDay))
                .filter(s -> !Boolean.TRUE.equals(s.getIsInternal()))
                .map(SaleDto::getFinalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Include Delivery Orders (Delivered only)
        BigDecimal deliverySales = deliveryOrderService.getAllOrders().stream()
                .filter(o -> o.getStatus() == DeliveryOrder.OrderStatus.DELIVERED)
                .filter(o -> o.getOrderDate() != null && !o.getOrderDate().isBefore(startOfDay) && !o.getOrderDate().isAfter(endOfDay))
                .map(o -> o.getCodAmount().subtract(o.getDeliveryFee()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return posSales.add(deliverySales);
    }

    public ProfitBreakdownDto getMonthlyProfit(int year, int month) {
        // 1. POS Profit
        BigDecimal posProfit = saleService.getAllSales().stream()
                .filter(s -> s.getCreatedAt().getYear() == year && s.getCreatedAt().getMonthValue() == month)
                .filter(s -> !Boolean.TRUE.equals(s.getIsInternal()))
                .flatMap(s -> s.getItems().stream())
                .map(item -> {
                    BigDecimal totalCost = item.getPurchasePrice() != null 
                        ? item.getPurchasePrice().multiply(BigDecimal.valueOf(item.getQuantity()))
                        : BigDecimal.ZERO;
                    return item.getSubtotal().subtract(totalCost);
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 2. Delivery Orders Profit (Delivered only)
        BigDecimal deliveryProfit = deliveryOrderService.getAllOrders().stream()
                .filter(o -> o.getStatus() == DeliveryOrder.OrderStatus.DELIVERED)
                .filter(o -> o.getOrderDate() != null && o.getOrderDate().getYear() == year && o.getOrderDate().getMonthValue() == month)
                .map(o -> {
                    BigDecimal totalItemCost = o.getItems().stream()
                        .map(item -> item.getPurchasePrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                    
                    // Net Revenue from items is (COD - DeliveryFee)
                    return o.getCodAmount().subtract(o.getDeliveryFee()).subtract(totalItemCost);
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 3. Miscellaneous Expenses
        BigDecimal totalMiscExpenses = miscExpenseService.getAllExpenses().stream()
                .filter(e -> e.getExpenseDate().getYear() == year && e.getExpenseDate().getMonthValue() == month)
                .map(MiscExpenseDto::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Total Profit = POS + Delivery - Misc
        BigDecimal totalProfit = posProfit.add(deliveryProfit).subtract(totalMiscExpenses);

        return ProfitBreakdownDto.builder()
                .posProfit(posProfit)
                .deliveryProfit(deliveryProfit)
                .miscExpenses(totalMiscExpenses)
                .totalProfit(totalProfit)
                .build();
    }
}
