package com.dcore.backend.repository;

import com.dcore.backend.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long> {
    Optional<Product> findTopByOrderByItemCodeDesc();
    boolean existsByNameIgnoreCase(String name);
}
