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
        if (request.getCustomerId() != null) {
            customer = customerRepository.findById(request.getCustomerId())
                    .orElseThrow(() -> new RuntimeException("Customer not found"));
        } else if (Boolean.FALSE.equals(request.getIsInternal()) && (request.getPaymentAmount() == null)) {
            throw new RuntimeException("Customer is required for pay later");
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

            BigDecimal itemUnitPrice = product.getStandardPrice();
            if (Boolean.TRUE.equals(request.getIsInternal())) {
                itemUnitPrice = BigDecimal.ZERO;
            }

            // Calculate item-level discount for the entire quantity of this item
            BigDecimal rawItemSubtotal = itemUnitPrice.multiply(BigDecimal.valueOf(itemReq.getQuantity()));
            BigDecimal itemDiscountAmount = BigDecimal.ZERO;

            if (!Boolean.TRUE.equals(request.getIsInternal()) && itemReq.getDiscountType() != null
                    && !"NONE".equals(itemReq.getDiscountType())) {
                if ("PERCENTAGE".equals(itemReq.getDiscountType())) {
                    itemDiscountAmount = rawItemSubtotal.multiply(itemReq.getDiscountValue())
                            .divide(new BigDecimal("100"));
                } else if ("FIXED".equals(itemReq.getDiscountType())) {
                    itemDiscountAmount = itemReq.getDiscountValue();
                }
            }

            for (StockBatch batch : availableBatches) {
                if (remainingQtyToSell <= 0)
                    break;

                int qtyFromBatch = Math.min(batch.getQuantityRemaining(), remainingQtyToSell);
                batch.setQuantityRemaining(batch.getQuantityRemaining() - qtyFromBatch);
                stockBatchRepository.save(batch);

                // Pro-rate the item-level discount across batches if necessary (though usually
                // simple)
                // For simplicity, we just store the totals in the SaleItem
                BigDecimal batchSubtotalRaw = itemUnitPrice.multiply(BigDecimal.valueOf(qtyFromBatch));

                // We'll put all discount info into the FIRST batch entry for this product to
                // keep it simple,
                // or just distribute it. Let's just store it per batch part.
                BigDecimal batchDiscountAmount = itemDiscountAmount.multiply(BigDecimal.valueOf(qtyFromBatch))
                        .divide(BigDecimal.valueOf(itemReq.getQuantity()), 2, RoundingMode.HALF_UP);

                // Calculate actual landed cost for this batch
                List<BatchExpense> expenses = batchExpenseRepository.findByBatchId(batch.getId());
                BigDecimal totalExpenses = expenses.stream()
                        .map(BatchExpense::getAmount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal totalBaseCost = batch.getBaseCost().multiply(BigDecimal.valueOf(batch.getQuantityInitial()));
                BigDecimal totalLandedCost = totalBaseCost.add(totalExpenses);
                BigDecimal landedCost = batch.getQuantityInitial() > 0
                        ? totalLandedCost.divide(BigDecimal.valueOf(batch.getQuantityInitial()), 2,
                                RoundingMode.HALF_UP)
                        : batch.getBaseCost();

                SaleItem saleItem = SaleItem.builder()
                        .sale(sale)
                        .product(product)
                        .batch(batch)
                        .quantity(qtyFromBatch)
                        .unitPrice(itemUnitPrice)
                        .purchasePrice(landedCost) // Use Landed Cost instead of Base Cost
                        .discountType(itemReq.getDiscountType())
                        .discountValue(itemReq.getDiscountValue())
                        .discountAmount(batchDiscountAmount)
                        .subtotal(batchSubtotalRaw.subtract(batchDiscountAmount))
                        .build();

                saleItems.add(saleItem);
                totalAmountStr = totalAmountStr.add(batchSubtotalRaw);
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

        if (request.getPaymentAmount() != null && request.getPaymentAmount().compareTo(BigDecimal.ZERO) > 0) {
            Payment payment = Payment.builder()
                    .sale(savedSale)
                    .amount(request.getPaymentAmount())
                    .paymentMethod(request.getPaymentMethod())
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

    public PaymentDto addPayment(PaymentRequest request) {
        Sale sale = saleRepository.findById(request.getSaleId())
                .orElseThrow(() -> new RuntimeException("Sale not found"));

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
