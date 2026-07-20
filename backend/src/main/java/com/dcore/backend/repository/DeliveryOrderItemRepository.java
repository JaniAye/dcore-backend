package com.dcore.backend.repository;

import com.dcore.backend.entity.DeliveryOrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DeliveryOrderItemRepository extends JpaRepository<DeliveryOrderItem, Long> {
}
