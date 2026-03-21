package com.dcore.backend.service;

import com.dcore.backend.dto.AddBatchExpenseRequest;
import com.dcore.backend.dto.BatchExpenseDto;
import com.dcore.backend.dto.CreateStockBatchRequest;
import com.dcore.backend.dto.StockBatchDto;
import com.dcore.backend.entity.BatchExpense;
import com.dcore.backend.entity.Product;
import com.dcore.backend.entity.StockBatch;
import com.dcore.backend.repository.BatchExpenseRepository;
import com.dcore.backend.repository.ProductRepository;
import com.dcore.backend.repository.StockBatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StockBatchService {
    
    private final StockBatchRepository stockBatchRepository;
    private final BatchExpenseRepository batchExpenseRepository;
    private final ProductRepository productRepository;

    public StockBatchDto addStockBatch(CreateStockBatchRequest request) {
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new RuntimeException("Product not found"));

        StockBatch batch = StockBatch.builder()
                .product(product)
                .quantityInitial(request.getQuantity())
                .quantityRemaining(request.getQuantity())
                .baseCost(request.getBaseCost())
                .createdAt(LocalDateTime.now())
                .build();

        return mapToDto(stockBatchRepository.save(batch));
    }

    public BatchExpenseDto addExpenseToBatch(AddBatchExpenseRequest request) {
        StockBatch batch = stockBatchRepository.findById(request.getBatchId())
                .orElseThrow(() -> new RuntimeException("Batch not found"));

        BatchExpense expense = BatchExpense.builder()
                .batch(batch)
                .description(request.getDescription())
                .amount(request.getAmount())
                .build();

        expense = batchExpenseRepository.save(expense);
        
        return BatchExpenseDto.builder()
                .id(expense.getId())
                .batchId(batch.getId())
                .description(expense.getDescription())
                .amount(expense.getAmount())
                .build();
    }

    public List<StockBatchDto> getAllBatches() {
        return stockBatchRepository.findAll().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    private StockBatchDto mapToDto(StockBatch batch) {
        List<BatchExpense> expenses = batchExpenseRepository.findAll()
                .stream()
                .filter(e -> e.getBatch().getId().equals(batch.getId()))
                .collect(Collectors.toList());

        BigDecimal totalExpenses = expenses.stream()
                .map(BatchExpense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCost = batch.getBaseCost().add(totalExpenses);
        BigDecimal costPerItem = totalCost.divide(BigDecimal.valueOf(batch.getQuantityInitial()), 2, RoundingMode.HALF_UP);

        return StockBatchDto.builder()
                .id(batch.getId())
                .productId(batch.getProduct().getId())
                .productName(batch.getProduct().getName())
                .quantityInitial(batch.getQuantityInitial())
                .quantityRemaining(batch.getQuantityRemaining())
                .baseCost(batch.getBaseCost())
                .totalExpenses(totalExpenses)
                .costPerItem(costPerItem)
                .createdAt(batch.getCreatedAt())
                .build();
    }
}
