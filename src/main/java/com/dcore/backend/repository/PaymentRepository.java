package com.dcore.backend.repository;

import com.dcore.backend.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findBySale_Customer_Id(Long customerId);
}
