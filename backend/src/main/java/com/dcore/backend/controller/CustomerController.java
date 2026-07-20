package com.dcore.backend.controller;

import com.dcore.backend.dto.CreateCustomerRequest;
import com.dcore.backend.dto.CustomerDto;
import com.dcore.backend.dto.SaleDto;
import com.dcore.backend.service.CustomerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;

    @PostMapping
    public ResponseEntity<CustomerDto> createCustomer(@Valid @RequestBody CreateCustomerRequest request) {
        return ResponseEntity.ok(customerService.createCustomer(request));
    }

    @GetMapping
    public ResponseEntity<List<CustomerDto>> getAllCustomers() {
        return ResponseEntity.ok(customerService.getAllCustomers());
    }

    @GetMapping("/search")
    public ResponseEntity<CustomerDto> getCustomerByMobile(@RequestParam String mobile) {
        CustomerDto customer = customerService.getCustomerByMobile(mobile);
        if (customer != null) {
            return ResponseEntity.ok(customer);
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/{id}/sales")
    public ResponseEntity<List<SaleDto>> getCustomerSalesHistory(@PathVariable Long id) {
        return ResponseEntity.ok(customerService.getCustomerSalesHistory(id));
    }
}
