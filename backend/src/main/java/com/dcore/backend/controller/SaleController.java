package com.dcore.backend.controller;

import com.dcore.backend.dto.PaymentDto;
import com.dcore.backend.dto.PaymentRequest;
import com.dcore.backend.dto.SaleDto;
import com.dcore.backend.dto.SaleRequest;
import com.dcore.backend.service.SaleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/sales")
@RequiredArgsConstructor
public class SaleController {

    private final SaleService saleService;

    @PostMapping
    public ResponseEntity<SaleDto> createSale(@RequestBody SaleRequest request) {
        return ResponseEntity.ok(saleService.createSale(request));
    }

    @GetMapping
    public ResponseEntity<List<SaleDto>> getAllSales() {
        return ResponseEntity.ok(saleService.getAllSales());
    }

    @GetMapping("/filtered")
    public ResponseEntity<List<SaleDto>> getSalesByDateRange(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        LocalDate from = startDate != null && !startDate.isBlank() ? LocalDate.parse(startDate) : null;
        LocalDate to = endDate != null && !endDate.isBlank() ? LocalDate.parse(endDate) : null;
        return ResponseEntity.ok(saleService.getSalesByDateRange(from, to));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SaleDto> getSaleById(@PathVariable Long id) {
        return ResponseEntity.ok(saleService.getSaleById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SaleDto> updateSale(@PathVariable Long id, @RequestBody SaleRequest request) {
        return ResponseEntity.ok(saleService.updateSale(id, request));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<SaleDto> cancelSale(@PathVariable Long id) {
        return ResponseEntity.ok(saleService.cancelSale(id));
    }
    
    @PostMapping("/payments")
    public ResponseEntity<PaymentDto> addPayment(@RequestBody PaymentRequest request) {
        return ResponseEntity.ok(saleService.addPayment(request));
    }
}
