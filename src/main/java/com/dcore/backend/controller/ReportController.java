package com.dcore.backend.controller;

import com.dcore.backend.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/daily-sales")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Map<String, BigDecimal>> getDailySales(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        Map<String, BigDecimal> response = new HashMap<>();
        response.put("sales", reportService.getDailySalesAmount(date));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/monthly-profit")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<com.dcore.backend.dto.ProfitBreakdownDto> getMonthlyProfit(
            @RequestParam int year, @RequestParam int month) {
        return ResponseEntity.ok(reportService.getMonthlyProfit(year, month));
    }
}
