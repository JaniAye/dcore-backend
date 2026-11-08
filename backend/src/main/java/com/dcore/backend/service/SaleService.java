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
    private final SaleItemRepository saleItemRepository;
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

        SaleTotals totals = buildSaleItems(sale, request);
        sale.setItems(totals.items());
        sale.setTotalAmount(totals.totalAmount());
        sale.setDiscountAmount(totals.discountAmount());
        sale.setFinalAmount(totals.finalAmount());

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

    @Transactional
    public SaleDto updateSale(Long id, SaleRequest request) {
        Sale sale = saleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Sale not found"));
        if (Boolean.TRUE.equals(sale.getCancelled())) {
            throw new RuntimeException("Cancelled invoices cannot be edited");
        }

        BigDecimal totalPaid = paymentRepository.findAll().stream()
                .filter(payment -> payment.getSale().getId().equals(sale.getId()))
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<SaleItem> cancelledItems = sale.getItems().stream()
            .filter(item -> Boolean.TRUE.equals(item.getCancelled()))
            .collect(Collectors.toList());
        List<SaleItem> activeItems = sale.getItems().stream()
            .filter(item -> !Boolean.TRUE.equals(item.getCancelled()))
            .collect(Collectors.toList());
        restoreStock(activeItems);
        saleItemRepository.deleteAll(activeItems);
        SaleTotals totals = buildSaleItems(sale, request);
        if (totalPaid.compareTo(totals.finalAmount()) > 0) {
            Payment refundAdjustment = Payment.builder()
                .sale(sale)
                .amount(totals.finalAmount().subtract(totalPaid))
                .paymentMethod("REFUND")
                .createdAt(LocalDateTime.now())
                .build();
            paymentRepository.save(refundAdjustment);
        }

        List<SaleItem> revisedItems = new ArrayList<>(cancelledItems);
        revisedItems.addAll(totals.items());
        sale.setItems(revisedItems);
        sale.setTotalAmount(totals.totalAmount());
        sale.setDiscountAmount(totals.discountAmount());
        sale.setFinalAmount(totals.finalAmount());
        return mapToDto(saleRepository.save(sale));
    }

    @Transactional
    public SaleDto cancelSale(Long id) {
        Sale sale = saleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Sale not found"));
        if (!Boolean.TRUE.equals(sale.getCancelled())) {
            restoreStock(sale.getItems().stream()
                .filter(item -> !Boolean.TRUE.equals(item.getCancelled()))
                .collect(Collectors.toList()));
            sale.setCancelled(true);
            saleRepository.save(sale);
        }
        return mapToDto(sale);
    }

    @Transactional
    public SaleDto setSaleItemCancelled(Long saleId, Long saleItemId, boolean cancelled) {
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> new RuntimeException("Sale not found"));
        if (Boolean.TRUE.equals(sale.getCancelled())) {
            throw new RuntimeException("Items cannot be changed on a cancelled invoice");
        }

        SaleItem item = sale.getItems().stream()
                .filter(saleItem -> saleItem.getId().equals(saleItemId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Invoice item not found"));
        if (Boolean.TRUE.equals(item.getCancelled()) == cancelled) {
            return mapToDto(sale);
        }

        StockBatch batch = item.getBatch();
        if (batch != null) {
            if (cancelled) {
                batch.setQuantityRemaining(batch.getQuantityRemaining() + item.getQuantity());
            } else {
                if (batch.getQuantityRemaining() < item.getQuantity()) {
                    throw new RuntimeException("Not enough stock to restore this invoice item");
                }
                batch.setQuantityRemaining(batch.getQuantityRemaining() - item.getQuantity());
            }
            stockBatchRepository.save(batch);
        }

        item.setCancelled(cancelled);
        BigDecimal totalAmount = sale.getItems().stream()
                .filter(saleItem -> !Boolean.TRUE.equals(saleItem.getCancelled()))
                .map(saleItem -> saleItem.getUnitPrice().multiply(BigDecimal.valueOf(saleItem.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal discountAmount = sale.getItems().stream()
                .filter(saleItem -> !Boolean.TRUE.equals(saleItem.getCancelled()))
                .map(saleItem -> saleItem.getDiscountAmount() != null ? saleItem.getDiscountAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        sale.setTotalAmount(totalAmount);
        sale.setDiscountAmount(discountAmount);
        sale.setFinalAmount(totalAmount.subtract(discountAmount));

        BigDecimal totalPaid = paymentRepository.findAll().stream()
                .filter(payment -> payment.getSale().getId().equals(sale.getId()))
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (totalPaid.compareTo(sale.getFinalAmount()) > 0) {
            paymentRepository.save(Payment.builder()
                    .sale(sale)
                    .amount(sale.getFinalAmount().subtract(totalPaid))
                    .paymentMethod("REFUND")
                    .createdAt(LocalDateTime.now())
                    .build());
        }

        return mapToDto(saleRepository.save(sale));
    }

    private SaleTotals buildSaleItems(Sale sale, SaleRequest request) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new RuntimeException("An invoice must contain at least one item");
        }

        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal totalDiscountAmount = BigDecimal.ZERO;
        List<SaleItem> saleItems = new ArrayList<>();

        for (SaleItemRequest itemReq : request.getItems()) {
            if (itemReq.getQuantity() == null || itemReq.getQuantity() < 1) {
                throw new RuntimeException("Item quantity must be at least one");
            }

            if (itemReq.getProductId() == null) {
                if (itemReq.getCustomItemName() == null || itemReq.getCustomItemName().isBlank()
                        || itemReq.getBaseCost() == null || itemReq.getBaseCost().compareTo(BigDecimal.ZERO) < 0
                        || itemReq.getSellingPrice() == null || itemReq.getSellingPrice().compareTo(BigDecimal.ZERO) < 0) {
                    throw new RuntimeException("Custom items require a name and valid cost and selling price");
                }

                BigDecimal originalUnitPrice = itemReq.getOriginalPrice() != null
                        ? itemReq.getOriginalPrice() : itemReq.getSellingPrice();
                BigDecimal finalUnitPrice = itemReq.getOverridePrice() != null
                        ? itemReq.getOverridePrice() : itemReq.getSellingPrice();
                if (Boolean.TRUE.equals(sale.getIsInternal())) {
                    finalUnitPrice = BigDecimal.ZERO;
                }
                if (!Boolean.TRUE.equals(sale.getIsInternal())
                        && finalUnitPrice.compareTo(itemReq.getBaseCost()) < 0) {
                    throw new RuntimeException("Selling price cannot be below cost for item " + itemReq.getCustomItemName());
                }

                BigDecimal quantity = BigDecimal.valueOf(itemReq.getQuantity());
                BigDecimal discountAmount = originalUnitPrice.compareTo(finalUnitPrice) > 0
                        ? originalUnitPrice.subtract(finalUnitPrice).multiply(quantity) : BigDecimal.ZERO;
                saleItems.add(SaleItem.builder()
                        .sale(sale)
                        .customItemName(itemReq.getCustomItemName().trim())
                        .customDescription(itemReq.getCustomDescription())
                        .quantity(itemReq.getQuantity())
                        .unitPrice(originalUnitPrice)
                        .purchasePrice(itemReq.getBaseCost())
                        .discountType("OVERRIDE")
                        .discountValue(BigDecimal.ZERO)
                        .discountAmount(discountAmount)
                        .subtotal(finalUnitPrice.multiply(quantity))
                        .build());
                totalAmount = totalAmount.add(originalUnitPrice.multiply(quantity));
                totalDiscountAmount = totalDiscountAmount.add(discountAmount);
                continue;
            }

            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new RuntimeException("Product not found"));
            int remainingQtyToSell = itemReq.getQuantity();
            List<StockBatch> availableBatches = stockBatchRepository.findAvailableBatchesForProduct(product.getId());

            for (StockBatch batch : availableBatches) {
                if (remainingQtyToSell <= 0) break;
                int qtyFromBatch = Math.min(batch.getQuantityRemaining(), remainingQtyToSell);
                batch.setQuantityRemaining(batch.getQuantityRemaining() - qtyFromBatch);
                stockBatchRepository.save(batch);

                BigDecimal baseSellingPrice;
                if (itemReq.getOriginalPrice() != null && itemReq.getOriginalPrice().compareTo(BigDecimal.ZERO) > 0) {
                    baseSellingPrice = itemReq.getOriginalPrice();
                } else if (product.getStandardPrice() != null && product.getStandardPrice().compareTo(BigDecimal.ZERO) > 0) {
                    baseSellingPrice = product.getStandardPrice();
                } else if (batch.getSellingPrice() != null && batch.getSellingPrice().compareTo(BigDecimal.ZERO) > 0) {
                    baseSellingPrice = batch.getSellingPrice();
                } else {
                    baseSellingPrice = product.getWholesalePrice() != null ? product.getWholesalePrice() : BigDecimal.ZERO;
                }

                BigDecimal finalUnitPrice = itemReq.getOverridePrice() != null
                        ? itemReq.getOverridePrice() : baseSellingPrice;
                if (Boolean.TRUE.equals(sale.getIsInternal())) finalUnitPrice = BigDecimal.ZERO;

                List<BatchExpense> expenses = batchExpenseRepository.findByBatchId(batch.getId());
                BigDecimal totalExpenses = expenses.stream().map(BatchExpense::getAmount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal totalBaseCost = batch.getBaseCost().multiply(BigDecimal.valueOf(batch.getQuantityInitial()));
                BigDecimal totalLandedCost = totalBaseCost.add(totalExpenses);
                BigDecimal landedCost = batch.getQuantityInitial() > 0
                        ? totalLandedCost.divide(BigDecimal.valueOf(batch.getQuantityInitial()), 2, RoundingMode.HALF_UP)
                        : batch.getBaseCost();

                if (!Boolean.TRUE.equals(sale.getIsInternal()) && finalUnitPrice.compareTo(landedCost) < 0) {
                    throw new RuntimeException("Selling price cannot be below landed cost for product " + product.getName());
                }

                BigDecimal originalUnitPrice = baseSellingPrice;
                BigDecimal batchDiscountAmount = BigDecimal.ZERO;
                if (finalUnitPrice.compareTo(baseSellingPrice) < 0) {
                    batchDiscountAmount = baseSellingPrice.subtract(finalUnitPrice).multiply(BigDecimal.valueOf(qtyFromBatch));
                } else if (finalUnitPrice.compareTo(baseSellingPrice) > 0) {
                    originalUnitPrice = finalUnitPrice;
                }
                saleItems.add(SaleItem.builder()
                        .sale(sale)
                        .product(product)
                        .batch(batch)
                        .quantity(qtyFromBatch)
                        .unitPrice(originalUnitPrice)
                        .purchasePrice(landedCost)
                        .discountType("OVERRIDE")
                        .discountValue(BigDecimal.ZERO)
                        .discountAmount(batchDiscountAmount)
                        .subtotal(finalUnitPrice.multiply(BigDecimal.valueOf(qtyFromBatch)))
                        .build());
                totalAmount = totalAmount.add(originalUnitPrice.multiply(BigDecimal.valueOf(qtyFromBatch)));
                totalDiscountAmount = totalDiscountAmount.add(batchDiscountAmount);
                remainingQtyToSell -= qtyFromBatch;
            }
            if (remainingQtyToSell > 0) {
                throw new RuntimeException("Not enough stock for product " + product.getName());
            }
        }

        return new SaleTotals(saleItems, totalAmount, totalDiscountAmount, totalAmount.subtract(totalDiscountAmount));
    }

    private void restoreStock(List<SaleItem> items) {
        for (SaleItem item : items) {
            if (item.getBatch() != null) {
                StockBatch batch = item.getBatch();
                batch.setQuantityRemaining(batch.getQuantityRemaining() + item.getQuantity());
                stockBatchRepository.save(batch);
            }
        }
    }

    private record SaleTotals(List<SaleItem> items, BigDecimal totalAmount,
            BigDecimal discountAmount, BigDecimal finalAmount) {}

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
        if (Boolean.TRUE.equals(sale.getCancelled())) {
            throw new RuntimeException("Payments cannot be added to a cancelled invoice");
        }

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
            .productId(i.getProduct() != null ? i.getProduct().getId() : null)
            .productCode(i.getProduct() != null ? i.getProduct().getItemCode() : null)
            .productName(i.getProduct() != null ? i.getProduct().getName() : i.getCustomItemName())
            .description(i.getCustomDescription())
            .batchId(i.getBatch() != null ? i.getBatch().getId() : null)
                .quantity(i.getQuantity())
                .unitPrice(i.getUnitPrice())
                .purchasePrice(i.getPurchasePrice())
                .discountAmount(i.getDiscountAmount())
                .subtotal(i.getSubtotal())
                .cancelled(i.getCancelled())
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
        if (Boolean.TRUE.equals(sale.getCancelled())) {
            outstandingBalance = BigDecimal.ZERO;
        }

        return SaleDto.builder()
                .id(sale.getId())
                .invoiceId(sale.getInvoiceId())
                .customerId(sale.getCustomer() != null ? sale.getCustomer().getId() : null)
                .customerName(sale.getCustomer() != null ? sale.getCustomer().getName() : null)
                .customerMobile(sale.getCustomer() != null ? sale.getCustomer().getMobile() : null)
                .sellerName(sale.getSeller().getName())
                .totalAmount(sale.getTotalAmount())
                .discountAmount(sale.getDiscountAmount())
                .finalAmount(sale.getFinalAmount())
                .discountLevel(sale.getDiscountLevel())
                .discountReason(sale.getDiscountReason())
                .isInternal(sale.getIsInternal())
                .internalReason(sale.getInternalReason())
                .cancelled(sale.getCancelled())
                .createdAt(sale.getCreatedAt())
                .items(items)
                .payments(payments)
                .outstandingBalance(outstandingBalance)
                .build();
    }
}
