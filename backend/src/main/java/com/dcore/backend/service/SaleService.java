package com.dcore.backend.service;

import com.dcore.backend.dto.*;
import com.dcore.backend.entity.*;
import com.dcore.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SaleService {

    private final SaleRepository saleRepository;
    private final ProductRepository productRepository;
    private final StockBatchRepository stockBatchRepository;
    private final CustomerRepository customerRepository;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;
    private final BatchExpenseRepository batchExpenseRepository;

    @Transactional
    public SaleDto createSale(SaleRequest request) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User seller = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Seller not found"));

        if (!Boolean.TRUE.equals(request.getIsInternal()) && seller.getRole() == Role.SALES_PERSON) {
            if (request.getDiscountLevel() == DiscountLevel.MAX
                    && (request.getDiscountReason() == null || request.getDiscountReason().isEmpty())) {
                throw new RuntimeException("Max discount requires a reason");
            }
        }

        if (Boolean.TRUE.equals(request.getIsInternal()) && seller.getRole() != Role.SUPER_ADMIN) {
            throw new RuntimeException("Only Super Admin can do internal sales");
        }

        Customer customer = null;
        if (request.getCustomerId() != null && request.getCustomerId() > 0) {
            customer = customerRepository.findById(request.getCustomerId())
                    .orElseThrow(() -> new RuntimeException("Customer not found"));
        } else if (Boolean.FALSE.equals(request.getIsInternal()) && (request.getPaymentAmount() == null)) {
            throw new RuntimeException("Customer is required for pay later");
        }

        String paymentMethod = request.getPaymentMethod() != null ? request.getPaymentMethod() : "CASH";
        boolean storeCredit = "CREDIT".equalsIgnoreCase(paymentMethod);
        if (storeCredit && customer == null && !Boolean.TRUE.equals(request.getIsInternal())) {
            throw new RuntimeException("A registered customer is required for store credit");
        }

        Sale sale = Sale.builder()
                .invoiceId("DC-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .customer(customer)
                .seller(seller)
                .discountLevel(request.getDiscountLevel() != null ? request.getDiscountLevel() : DiscountLevel.NONE)
                .discountReason(request.getDiscountReason())
                .isInternal(request.getIsInternal() != null ? request.getIsInternal() : false)
                .internalReason(request.getInternalReason())
                .createdAt(LocalDateTime.now())
                .build();

        BigDecimal totalAmountStr = BigDecimal.ZERO; // Track total before any discounts
        BigDecimal totalDiscountAmount = BigDecimal.ZERO;
        List<SaleItem> saleItems = new ArrayList<>();

        for (SaleItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new RuntimeException("Product not found"));

            int remainingQtyToSell = itemReq.getQuantity();
            List<StockBatch> availableBatches = stockBatchRepository.findAvailableBatchesForProduct(product.getId());

            // Standard base price is now irrelevant as we use the batch's selling price or override

            // Pricing and discounts are now handled per batch part in the inner loop

            for (StockBatch batch : availableBatches) {
                if (remainingQtyToSell <= 0)
                    break;

                int qtyFromBatch = Math.min(batch.getQuantityRemaining(), remainingQtyToSell);
                batch.setQuantityRemaining(batch.getQuantityRemaining() - qtyFromBatch);
                stockBatchRepository.save(batch);

                // Pro-rate the item-level discount across batches if necessary (though usually
                // simple)
                // For simplicity, we just store the totals in the SaleItem
                // Pricing logic: use override price if provided, otherwise batch selling price
                BigDecimal batchSellingPrice = batch.getSellingPrice();
                BigDecimal finalUnitPrice = itemReq.getOverridePrice() != null ? itemReq.getOverridePrice() : batchSellingPrice;
                
                if (Boolean.TRUE.equals(request.getIsInternal())) {
                    finalUnitPrice = BigDecimal.ZERO;
                }

                // Landed cost calculation for floor validation
                List<BatchExpense> expenses = batchExpenseRepository.findByBatchId(batch.getId());
                BigDecimal totalExpenses = expenses.stream()
                        .map(BatchExpense::getAmount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal totalBaseCost = batch.getBaseCost().multiply(BigDecimal.valueOf(batch.getQuantityInitial()));
                BigDecimal totalLandedCost = totalBaseCost.add(totalExpenses);
                BigDecimal landedCost = batch.getQuantityInitial() > 0
                        ? totalLandedCost.divide(BigDecimal.valueOf(batch.getQuantityInitial()), 2, RoundingMode.HALF_UP)
                        : batch.getBaseCost();

                // Cost Floor Validation (only for non-internal sales)
                if (!Boolean.TRUE.equals(request.getIsInternal()) && finalUnitPrice.compareTo(landedCost) < 0) {
                    throw new RuntimeException("Selling price of " + finalUnitPrice + " is below landed cost of " + landedCost + " for product " + product.getName());
                }

                // Discount logic: any difference from original selling price is treated as a discount
                BigDecimal batchDiscountAmount = BigDecimal.ZERO;
                if (finalUnitPrice.compareTo(batchSellingPrice) < 0) {
                    batchDiscountAmount = batchSellingPrice.subtract(finalUnitPrice).multiply(BigDecimal.valueOf(qtyFromBatch));
                }

                SaleItem saleItem = SaleItem.builder()
                        .sale(sale)
                        .product(product)
                        .batch(batch)
                        .quantity(qtyFromBatch)
                        .unitPrice(finalUnitPrice)
                        .purchasePrice(landedCost)
                        .discountType("OVERRIDE")
                        .discountValue(BigDecimal.ZERO)
                        .discountAmount(batchDiscountAmount)
                        .subtotal(finalUnitPrice.multiply(BigDecimal.valueOf(qtyFromBatch)))
                        .build();

                saleItems.add(saleItem);
                totalAmountStr = totalAmountStr.add(finalUnitPrice.multiply(BigDecimal.valueOf(qtyFromBatch)));
                totalDiscountAmount = totalDiscountAmount.add(batchDiscountAmount);
                remainingQtyToSell -= qtyFromBatch;
            }

            if (remainingQtyToSell > 0) {
                throw new RuntimeException("Not enough stock for product " + product.getName());
            }
        }

        sale.setItems(saleItems);
        sale.setTotalAmount(totalAmountStr);
        sale.setDiscountAmount(totalDiscountAmount);
        sale.setFinalAmount(totalAmountStr.subtract(totalDiscountAmount));

        Sale savedSale = saleRepository.save(sale);

        BigDecimal paymentAmount = request.getPaymentAmount();
        if (!storeCredit && paymentAmount == null && !Boolean.TRUE.equals(request.getIsInternal())) {
            paymentAmount = sale.getFinalAmount();
        }

        if (paymentAmount != null && paymentAmount.compareTo(BigDecimal.ZERO) > 0) {
            paymentAmount = paymentAmount.min(sale.getFinalAmount());
            Payment payment = Payment.builder()
                    .sale(savedSale)
                    .amount(paymentAmount)
                    .paymentMethod(paymentMethod)
                    .createdAt(LocalDateTime.now())
                    .build();
            paymentRepository.save(payment);
        }

        return getSaleById(savedSale.getId());
    }

    public SaleDto getSaleById(Long id) {
        Sale sale = saleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Sale not found"));

        return mapToDto(sale);
    }

    public List<SaleDto> getAllSales() {
        return saleRepository.findAll().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    public List<SaleDto> getSalesByDateRange(LocalDate startDate, LocalDate endDate) {
        return saleRepository.findAll().stream()
                .filter(sale -> {
                    LocalDate saleDate = sale.getCreatedAt().toLocalDate();
                    boolean afterStart = startDate == null || !saleDate.isBefore(startDate);
                    boolean beforeEnd = endDate == null || !saleDate.isAfter(endDate);
                    return afterStart && beforeEnd;
                })
                .map(this::mapToDto)
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .collect(Collectors.toList());
    }

    public PaymentDto addPayment(PaymentRequest request) {
        Sale sale = saleRepository.findById(request.getSaleId())
                .orElseThrow(() -> new RuntimeException("Sale not found"));

        if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new RuntimeException("Payment amount must be greater than zero");
        }

        BigDecimal totalPaid = paymentRepository.findAll().stream()
                .filter(payment -> payment.getSale().getId().equals(sale.getId()))
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal outstanding = sale.getFinalAmount().subtract(totalPaid);
        if (request.getAmount().compareTo(outstanding) > 0) {
            throw new RuntimeException("Payment cannot exceed the outstanding balance of " + outstanding);
        }

        Payment payment = Payment.builder()
                .sale(sale)
                .amount(request.getAmount())
                .paymentMethod(request.getPaymentMethod())
                .createdAt(LocalDateTime.now())
                .build();

        payment = paymentRepository.save(payment);
        return PaymentDto.builder()
                .id(payment.getId())
                .amount(payment.getAmount())
                .paymentMethod(payment.getPaymentMethod())
                .createdAt(payment.getCreatedAt())
                .build();
    }

    private SaleDto mapToDto(Sale sale) {
        List<SaleItemDto> items = sale.getItems().stream().map(i -> SaleItemDto.builder()
                .id(i.getId())
                .productId(i.getProduct().getId())
                .productName(i.getProduct().getName())
                .batchId(i.getBatch().getId())
                .quantity(i.getQuantity())
                .unitPrice(i.getUnitPrice())
                .purchasePrice(i.getPurchasePrice())
                .subtotal(i.getSubtotal())
                .build()).collect(Collectors.toList());

        List<Payment> paymentsEntity = paymentRepository.findAll().stream()
                .filter(p -> p.getSale().getId().equals(sale.getId()))
                .collect(Collectors.toList());

        List<PaymentDto> payments = paymentsEntity.stream().map(p -> PaymentDto.builder()
                .id(p.getId())
                .amount(p.getAmount())
                .paymentMethod(p.getPaymentMethod())
                .createdAt(p.getCreatedAt())
                .build()).collect(Collectors.toList());

        BigDecimal totalPaid = paymentsEntity.stream().map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal outstandingBalance = sale.getFinalAmount().subtract(totalPaid);

        return SaleDto.builder()
                .id(sale.getId())
                .invoiceId(sale.getInvoiceId())
                .customerId(sale.getCustomer() != null ? sale.getCustomer().getId() : null)
                .customerName(sale.getCustomer() != null ? sale.getCustomer().getName() : null)
                .sellerName(sale.getSeller().getName())
                .totalAmount(sale.getTotalAmount())
                .discountAmount(sale.getDiscountAmount())
                .finalAmount(sale.getFinalAmount())
                .discountLevel(sale.getDiscountLevel())
                .discountReason(sale.getDiscountReason())
                .isInternal(sale.getIsInternal())
                .internalReason(sale.getInternalReason())
                .createdAt(sale.getCreatedAt())
                .items(items)
                .payments(payments)
                .outstandingBalance(outstandingBalance)
                .build();
    }
}
