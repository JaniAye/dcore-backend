package com.dcore.backend.repository;

import com.dcore.backend.entity.BatchExpense;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BatchExpenseRepository extends JpaRepository<BatchExpense, Long> {
}
