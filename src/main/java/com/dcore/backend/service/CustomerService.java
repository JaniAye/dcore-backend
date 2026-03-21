package com.dcore.backend.service;

import com.dcore.backend.dto.CreateCustomerRequest;
import com.dcore.backend.dto.CustomerDto;
import com.dcore.backend.entity.Customer;
import com.dcore.backend.entity.Payment;
import com.dcore.backend.entity.Sale;
import com.dcore.backend.repository.CustomerRepository;
import com.dcore.backend.repository.PaymentRepository;
import com.dcore.backend.repository.SaleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final SaleRepository saleRepository;
    private final PaymentRepository paymentRepository;

    public CustomerDto createCustomer(CreateCustomerRequest request) {
        return customerRepository.findByMobile(request.getMobile())
                .map(existing -> {
                    if (request.getName() != null && !request.getName().trim().isEmpty()) {
                        existing.setName(request.getName());
                        customerRepository.save(existing);
                    }
                    return mapToDto(existing);
                })
                .orElseGet(() -> {
                    Customer customer = Customer.builder()
                            .name(request.getName())
                            .mobile(request.getMobile())
                            .createdAt(LocalDateTime.now())
                            .build();
                    return mapToDto(customerRepository.save(customer));
                });
    }

    public List<CustomerDto> getAllCustomers() {
        return customerRepository.findAll().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    public CustomerDto getCustomerByMobile(String mobile) {
        return customerRepository.findByMobile(mobile)
                .map(this::mapToDto)
                .orElse(null);
    }

    private CustomerDto mapToDto(Customer customer) {
        List<Sale> sales = saleRepository.findAll().stream()
                .filter(s -> s.getCustomer() != null && s.getCustomer().getId().equals(customer.getId()))
                .collect(Collectors.toList());

        BigDecimal totalSalesAmt = sales.stream()
                .map(Sale::getFinalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<Payment> payments = paymentRepository.findAll().stream()
                .filter(p -> p.getSale().getCustomer() != null && p.getSale().getCustomer().getId().equals(customer.getId()))
                .collect(Collectors.toList());

        BigDecimal totalPayments = payments.stream()
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal outstandingBalance = totalSalesAmt.subtract(totalPayments);

        return CustomerDto.builder()
                .id(customer.getId())
                .name(customer.getName())
                .mobile(customer.getMobile())
                .createdAt(customer.getCreatedAt())
                .outstandingBalance(outstandingBalance)
                .build();
    }
}
