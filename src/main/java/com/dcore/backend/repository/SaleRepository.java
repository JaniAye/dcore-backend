package com.dcore.backend.repository;

import com.dcore.backend.entity.Sale;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SaleRepository extends JpaRepository<Sale, Long> {
    List<Sale> findByCustomerIdOrderByCreatedAtDesc(Long customerId);
}
