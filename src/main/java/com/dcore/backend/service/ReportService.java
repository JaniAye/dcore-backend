package com.dcore.backend.service;

import com.dcore.backend.dto.SaleDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

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
        List<SaleDto> monthlySales = saleService.getAllSales().stream()
                .filter(s -> s.getCreatedAt().getYear() == year && s.getCreatedAt().getMonthValue() == month)
                .filter(s -> !Boolean.TRUE.equals(s.getIsInternal()))
                .collect(Collectors.toList());

        BigDecimal totalRevenue = monthlySales.stream()
                .map(SaleDto::getFinalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return totalRevenue.multiply(new BigDecimal("0.20"));
    }
}
