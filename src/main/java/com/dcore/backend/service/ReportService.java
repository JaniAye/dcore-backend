package com.dcore.backend.service;

import com.dcore.backend.dto.SaleDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final SaleService saleService;

    public BigDecimal getDailySalesAmount(LocalDate date) {
        LocalDateTime startOfDay = date.atStartOfDay();
        LocalDateTime endOfDay = date.atTime(23, 59, 59);

        return saleService.getAllSales().stream()
                .filter(s -> !s.getCreatedAt().isBefore(startOfDay) && !s.getCreatedAt().isAfter(endOfDay))
                .filter(s -> !Boolean.TRUE.equals(s.getIsInternal()))
                .map(SaleDto::getFinalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public BigDecimal getMonthlyProfit(int year, int month) {
        return saleService.getAllSales().stream()
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
    }
}
