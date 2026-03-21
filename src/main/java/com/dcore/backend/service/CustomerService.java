package com.dcore.backend.service;

import com.dcore.backend.dto.CreateCustomerRequest;
import com.dcore.backend.dto.CustomerDto;
import com.dcore.backend.dto.SaleDto;
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

    public List<SaleDto> getCustomerSalesHistory(Long customerId) {
        return saleRepository.findByCustomerIdOrderByCreatedAtDesc(customerId).stream()
                .map(this::mapSaleToDto)
                .collect(Collectors.toList());
    }

    private SaleDto mapSaleToDto(Sale sale) {
        // Simplified mapping for history view
        List<Payment> payments = paymentRepository.findAll().stream()
                .filter(p -> p.getSale().getId().equals(sale.getId()))
                .collect(Collectors.toList());

        BigDecimal totalPaid = payments.stream()
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return SaleDto.builder()
                .id(sale.getId())
                .invoiceId(sale.getInvoiceId())
                .finalAmount(sale.getFinalAmount())
                .totalAmount(sale.getTotalAmount())
                .discountAmount(sale.getDiscountAmount())
                .createdAt(sale.getCreatedAt())
                .outstandingBalance(sale.getFinalAmount().subtract(totalPaid))
                .sellerName(sale.getSeller().getName())
                .build();
    }

    private CustomerDto mapToDto(Customer customer) {
        List<Sale> sales = saleRepository.findByCustomerIdOrderByCreatedAtDesc(customer.getId());

        BigDecimal totalSalesAmt = sales.stream()
                .map(Sale::getFinalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<Payment> payments = paymentRepository.findBySale_Customer_Id(customer.getId());

        BigDecimal totalPayments = payments.stream()
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal outstandingBalance = totalSalesAmt.subtract(totalPayments);

        return CustomerDto.builder()
                .id(customer.getId())
                .name(customer.getName())
                .mobile(customer.getMobile())
                .createdAt(customer.getCreatedAt())
                .totalSpend(totalSalesAmt)
                .outstandingBalance(outstandingBalance)
                .build();
    }
}
