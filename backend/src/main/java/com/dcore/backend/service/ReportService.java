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
        // 1. POS Revenue and COGS
        BigDecimal posRevenue = saleService.getAllSales().stream()
                .filter(s -> s.getCreatedAt().getYear() == year && s.getCreatedAt().getMonthValue() == month)
                .filter(s -> !Boolean.TRUE.equals(s.getIsInternal()))
                .flatMap(s -> s.getItems().stream())
                .map(item -> item.getSubtotal())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal posCostOfSales = saleService.getAllSales().stream()
                .filter(s -> s.getCreatedAt().getYear() == year && s.getCreatedAt().getMonthValue() == month)
                .filter(s -> !Boolean.TRUE.equals(s.getIsInternal()))
                .flatMap(s -> s.getItems().stream())
                .map(item -> item.getPurchasePrice() != null
                        ? item.getPurchasePrice().multiply(BigDecimal.valueOf(item.getQuantity()))
                        : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 2. Delivery Revenue and COGS (Delivered only)
        BigDecimal deliveryRevenue = deliveryOrderService.getAllOrders().stream()
                .filter(o -> o.getStatus() == DeliveryOrder.OrderStatus.DELIVERED)
                .filter(o -> o.getOrderDate() != null && o.getOrderDate().getYear() == year && o.getOrderDate().getMonthValue() == month)
                .map(o -> o.getCodAmount().subtract(o.getDeliveryFee()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal deliveryCostOfSales = deliveryOrderService.getAllOrders().stream()
                .filter(o -> o.getStatus() == DeliveryOrder.OrderStatus.DELIVERED)
                .filter(o -> o.getOrderDate() != null && o.getOrderDate().getYear() == year && o.getOrderDate().getMonthValue() == month)
                .flatMap(o -> o.getItems().stream())
                .map(item -> item.getPurchasePrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 3. Miscellaneous Expenses
        BigDecimal totalMiscExpenses = miscExpenseService.getAllExpenses().stream()
                .filter(e -> e.getExpenseDate().getYear() == year && e.getExpenseDate().getMonthValue() == month)
                .map(MiscExpenseDto::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalSales = posRevenue.add(deliveryRevenue);
        BigDecimal totalCostOfSales = posCostOfSales.add(deliveryCostOfSales);
        BigDecimal netProfit = totalSales.subtract(totalCostOfSales).subtract(totalMiscExpenses);

        return ProfitBreakdownDto.builder()
                .totalSales(totalSales)
                .totalCostOfSales(totalCostOfSales)
                .totalMiscExpenses(totalMiscExpenses)
                .netProfit(netProfit)
                .build();
    }
}
