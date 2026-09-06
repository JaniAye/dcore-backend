package com.dcore.backend.repository;

import com.dcore.backend.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long> {
    Optional<Product> findTopByOrderByItemCodeDesc();
    @Query("SELECT COUNT(p) > 0 FROM Product p WHERE LOWER(p.name) = LOWER(:name) AND (p.active = true OR p.active IS NULL)")
    boolean existsByActiveNameIgnoreCase(@Param("name") String name);

    @Query("SELECT COUNT(p) > 0 FROM Product p WHERE LOWER(p.name) = LOWER(:name) AND p.id <> :id AND (p.active = true OR p.active IS NULL)")
    boolean existsByActiveNameIgnoreCaseAndIdNot(@Param("name") String name, @Param("id") Long id);
    
    @Query("SELECT p FROM Product p WHERE LOWER(p.name) LIKE LOWER(CONCAT('%', :query, '%')) ORDER BY p.name ASC")
    List<Product> searchByName(@Param("query") String query);
}
