package com.dcore.backend.repository;

import com.dcore.backend.entity.BatchExpense;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BatchExpenseRepository extends JpaRepository<BatchExpense, Long> {
    List<BatchExpense> findByBatchId(Long batchId);
}
