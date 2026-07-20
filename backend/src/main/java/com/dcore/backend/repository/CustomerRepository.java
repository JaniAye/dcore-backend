package com.dcore.backend.repository;

import com.dcore.backend.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface CustomerRepository extends JpaRepository<Customer, Long> {
    Optional<Customer> findByMobile(String mobile);
}
