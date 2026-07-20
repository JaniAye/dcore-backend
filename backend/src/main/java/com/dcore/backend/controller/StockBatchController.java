package com.dcore.backend.controller;

import com.dcore.backend.dto.AddBatchExpenseRequest;
import com.dcore.backend.dto.BatchExpenseDto;
import com.dcore.backend.dto.CreateStockBatchRequest;
import com.dcore.backend.dto.ProductDefaultsDto;
import com.dcore.backend.dto.StockBatchDto;
import com.dcore.backend.service.StockBatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/batches")
@RequiredArgsConstructor
public class StockBatchController {

    private final StockBatchService stockBatchService;

    @PostMapping
    public StockBatchDto addStockBatch(@RequestBody CreateStockBatchRequest request) {
        return stockBatchService.addStockBatch(request);
    }

    @PostMapping("/expenses")
    public BatchExpenseDto addExpense(@RequestBody AddBatchExpenseRequest request) {
        return stockBatchService.addExpenseToBatch(request);
    }

    @GetMapping
    public List<StockBatchDto> getAllBatches() {
        return stockBatchService.getAllBatches();
    }

    @GetMapping("/product/{productId}/latest")
    public ProductDefaultsDto getProductDefaults(@PathVariable Long productId) {
        return stockBatchService.getProductDefaults(productId);
    }
}
