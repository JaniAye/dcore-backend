package com.dcore.backend.repository;

import com.dcore.backend.entity.MiscExpense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MiscExpenseRepository extends JpaRepository<MiscExpense, Long> {
}
