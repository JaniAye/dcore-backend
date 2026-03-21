package com.dcore.backend.repository;

import com.dcore.backend.entity.StockBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface StockBatchRepository extends JpaRepository<StockBatch, Long> {
    @Query("SELECT sb FROM StockBatch sb WHERE sb.product.id = :productId AND sb.quantityRemaining > 0 ORDER BY sb.createdAt ASC")
    List<StockBatch> findAvailableBatchesForProduct(@Param("productId") Long productId);
}
