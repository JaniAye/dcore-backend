package com.dcore.backend.service;

import com.dcore.backend.dto.SaleItemRequest;
import com.dcore.backend.dto.SaleRequest;
import com.dcore.backend.entity.*;
import com.dcore.backend.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SaleServiceInvoiceMutationTest {
    @Mock private SaleRepository saleRepository;
    @Mock private SaleItemRepository saleItemRepository;
    @Mock private ProductRepository productRepository;
    @Mock private StockBatchRepository stockBatchRepository;
    @Mock private CustomerRepository customerRepository;
    @Mock private UserRepository userRepository;
    @Mock private PaymentRepository paymentRepository;
    @Mock private BatchExpenseRepository batchExpenseRepository;

    @InjectMocks private SaleService saleService;

    @Test
    void editingInvoiceRestoresOldStockThenAppliesRevisedLinesAndTotals() {
        Sale sale = saleWithSeller();
        Product oldProduct = product(1L, "Old product", "100");
        Product addedProduct = product(2L, "Added product", "200");
        StockBatch oldBatch = batch(11L, oldProduct, 5, 3, "40", "100");
        StockBatch addedBatch = batch(12L, addedProduct, 8, 8, "80", "200");
        SaleItem oldItem = SaleItem.builder()
                .sale(sale)
                .product(oldProduct)
                .batch(oldBatch)
                .quantity(2)
                .unitPrice(new BigDecimal("100"))
                .purchasePrice(new BigDecimal("40"))
                .discountAmount(BigDecimal.ZERO)
                .subtotal(new BigDecimal("200"))
                .build();
        sale.setItems(new ArrayList<>(List.of(oldItem)));
        sale.setTotalAmount(new BigDecimal("200"));
        sale.setDiscountAmount(BigDecimal.ZERO);
        sale.setFinalAmount(new BigDecimal("200"));

        SaleItemRequest revisedOldItem = item(1L, 1, "100", "90");
        SaleItemRequest addedItem = item(2L, 2, "200", "200");
        SaleRequest request = new SaleRequest();
        request.setItems(List.of(revisedOldItem, addedItem));

        when(saleRepository.findById(7L)).thenReturn(Optional.of(sale));
        when(saleRepository.save(sale)).thenReturn(sale);
        when(paymentRepository.findAll()).thenReturn(List.of());
        when(productRepository.findById(1L)).thenReturn(Optional.of(oldProduct));
        when(productRepository.findById(2L)).thenReturn(Optional.of(addedProduct));
        when(stockBatchRepository.findAvailableBatchesForProduct(1L)).thenReturn(List.of(oldBatch));
        when(stockBatchRepository.findAvailableBatchesForProduct(2L)).thenReturn(List.of(addedBatch));
        when(batchExpenseRepository.findByBatchId(11L)).thenReturn(List.of());
        when(batchExpenseRepository.findByBatchId(12L)).thenReturn(List.of());

        var updated = saleService.updateSale(7L, request);

        assertEquals(4, oldBatch.getQuantityRemaining());
        assertEquals(6, addedBatch.getQuantityRemaining());
        assertEquals(new BigDecimal("500"), updated.getTotalAmount());
        assertEquals(new BigDecimal("10"), updated.getDiscountAmount());
        assertEquals(new BigDecimal("490"), updated.getFinalAmount());
        assertEquals(2, updated.getItems().size());
    }

    @Test
    void cancellingInvoiceRestoresStockOnlyOnceAndMarksHistory() {
        Sale sale = saleWithSeller();
        Product product = product(1L, "Product", "100");
        StockBatch batch = batch(11L, product, 5, 3, "40", "100");
        SaleItem item = SaleItem.builder()
                .sale(sale)
                .product(product)
                .batch(batch)
                .quantity(2)
                .unitPrice(new BigDecimal("100"))
                .purchasePrice(new BigDecimal("40"))
                .discountAmount(BigDecimal.ZERO)
                .subtotal(new BigDecimal("200"))
                .build();
        sale.setItems(new ArrayList<>(List.of(item)));

        when(saleRepository.findById(7L)).thenReturn(Optional.of(sale));
        when(saleRepository.save(sale)).thenReturn(sale);
        when(paymentRepository.findAll()).thenReturn(List.of());

        var cancelled = saleService.cancelSale(7L);
        var cancelledAgain = saleService.cancelSale(7L);

        assertEquals(5, batch.getQuantityRemaining());
        assertTrue(cancelled.getCancelled());
        assertTrue(cancelledAgain.getCancelled());
        assertEquals(BigDecimal.ZERO, cancelled.getOutstandingBalance());
        assertFalse(cancelled.getItems().isEmpty());
    }

    @Test
    void removingAnItemFromPaidInvoiceRecordsRefundAdjustmentAndUpdatesNetPaid() {
        Sale sale = saleWithSeller();
        Product product = product(1L, "Product", "100");
        StockBatch batch = batch(11L, product, 5, 3, "40", "100");
        SaleItem existingItem = SaleItem.builder()
                .sale(sale)
                .product(product)
                .batch(batch)
                .quantity(2)
                .unitPrice(new BigDecimal("100"))
                .purchasePrice(new BigDecimal("40"))
                .discountAmount(BigDecimal.ZERO)
                .subtotal(new BigDecimal("200"))
                .build();
        sale.setItems(new ArrayList<>(List.of(existingItem)));
        sale.setTotalAmount(new BigDecimal("200"));
        sale.setFinalAmount(new BigDecimal("200"));

        Payment payment = Payment.builder()
                .id(31L)
                .sale(sale)
                .amount(new BigDecimal("200"))
                .paymentMethod("CASH")
                .createdAt(LocalDateTime.now().minusMinutes(1))
                .build();
        List<Payment> payments = new ArrayList<>(List.of(payment));
        SaleItemRequest remainingItem = item(1L, 1, "100", "100");
        SaleRequest request = new SaleRequest();
        request.setItems(List.of(remainingItem));

        when(saleRepository.findById(7L)).thenReturn(Optional.of(sale));
        when(saleRepository.save(sale)).thenReturn(sale);
        when(paymentRepository.findAll()).thenAnswer(invocation -> payments);
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> {
            Payment refund = invocation.getArgument(0);
            refund.setId(32L);
            payments.add(refund);
            return refund;
        });
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(stockBatchRepository.findAvailableBatchesForProduct(1L)).thenReturn(List.of(batch));
        when(batchExpenseRepository.findByBatchId(11L)).thenReturn(List.of());

        var updated = saleService.updateSale(7L, request);

        assertEquals(4, batch.getQuantityRemaining());
        assertEquals(new BigDecimal("100"), updated.getFinalAmount());
        assertEquals(new BigDecimal("-100"), updated.getPayments().get(1).getAmount());
        assertEquals("REFUND", updated.getPayments().get(1).getPaymentMethod());
        assertEquals(BigDecimal.ZERO, updated.getOutstandingBalance());
    }

    private Sale saleWithSeller() {
        User seller = User.builder().name("Seller").build();
        return Sale.builder()
                .id(7L)
                .invoiceId("DC-TEST1234")
                .seller(seller)
                .totalAmount(BigDecimal.ZERO)
                .discountAmount(BigDecimal.ZERO)
                .finalAmount(BigDecimal.ZERO)
                .discountLevel(DiscountLevel.NONE)
                .isInternal(false)
                .createdAt(LocalDateTime.now())
                .cancelled(false)
                .items(new ArrayList<>())
                .build();
    }

    private Product product(Long id, String name, String standardPrice) {
        return Product.builder()
                .id(id)
                .name(name)
                .itemCode("P-" + id)
                .standardPrice(new BigDecimal(standardPrice))
                .wholesalePrice(BigDecimal.ZERO)
                .build();
    }

    private StockBatch batch(Long id, Product product, int initial, int remaining,
            String baseCost, String sellingPrice) {
        return StockBatch.builder()
                .id(id)
                .product(product)
                .quantityInitial(initial)
                .quantityRemaining(remaining)
                .baseCost(new BigDecimal(baseCost))
                .sellingPrice(new BigDecimal(sellingPrice))
                .createdAt(LocalDateTime.now())
                .build();
    }

    private SaleItemRequest item(Long productId, int quantity, String originalPrice, String price) {
        SaleItemRequest item = new SaleItemRequest();
        item.setProductId(productId);
        item.setQuantity(quantity);
        item.setOriginalPrice(new BigDecimal(originalPrice));
        item.setOverridePrice(new BigDecimal(price));
        return item;
    }
}
