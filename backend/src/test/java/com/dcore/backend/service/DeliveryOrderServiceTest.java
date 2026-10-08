package com.dcore.backend.service;

import com.dcore.backend.dto.DeliveryOrderDto;
import com.dcore.backend.dto.DeliveryOrderRequest;
import com.dcore.backend.dto.MiscExpenseDto;
import com.dcore.backend.dto.SaleDto;
import com.dcore.backend.entity.DeliveryOrder;
import com.dcore.backend.entity.DeliveryOrderItem;
import com.dcore.backend.entity.Product;
import com.dcore.backend.entity.StockBatch;
import com.dcore.backend.repository.BatchExpenseRepository;
import com.dcore.backend.repository.CustomerRepository;
import com.dcore.backend.repository.DeliveryOrderItemRepository;
import com.dcore.backend.repository.DeliveryOrderRepository;
import com.dcore.backend.repository.ProductRepository;
import com.dcore.backend.repository.StockBatchRepository;
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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryOrderServiceTest {
    @Mock private DeliveryOrderRepository deliveryOrderRepository;
    @Mock private DeliveryOrderItemRepository deliveryOrderItemRepository;
    @Mock private CustomerRepository customerRepository;
    @Mock private ProductRepository productRepository;
    @Mock private StockBatchRepository stockBatchRepository;
    @Mock private BatchExpenseRepository batchExpenseRepository;

    @InjectMocks private DeliveryOrderService deliveryOrderService;

    @Test
    void changingAwayFromReturnedDeductsPreviouslyRestockedItems() {
        StockBatch batch = StockBatch.builder().id(5L).quantityRemaining(0).build();
        DeliveryOrder order = order(DeliveryOrder.OrderStatus.DELIVERED, batch, 3);
        when(deliveryOrderRepository.findById(1L)).thenReturn(Optional.of(order));
        when(deliveryOrderRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        deliveryOrderService.updateStatus(1L, DeliveryOrder.OrderStatus.RETURNED);
        assertEquals(3, batch.getQuantityRemaining());
        deliveryOrderService.updateStatus(1L, DeliveryOrder.OrderStatus.RETURNED);
        assertEquals(3, batch.getQuantityRemaining());

        deliveryOrderService.updateStatus(1L, DeliveryOrder.OrderStatus.READY);
        assertEquals(0, batch.getQuantityRemaining());
        assertEquals(DeliveryOrder.OrderStatus.READY, order.getStatus());

        deliveryOrderService.updateStatus(1L, DeliveryOrder.OrderStatus.RETURNED);
        assertEquals(3, batch.getQuantityRemaining());
    }

    @Test
    void changingAwayFromReturnedFailsWithoutMutationWhenRestockedItemsAreUnavailable() {
        StockBatch batch = StockBatch.builder().id(5L).quantityRemaining(2).build();
        DeliveryOrder order = order(DeliveryOrder.OrderStatus.RETURNED, batch, 3);
        when(deliveryOrderRepository.findById(1L)).thenReturn(Optional.of(order));

        assertThrows(RuntimeException.class,
                () -> deliveryOrderService.updateStatus(1L, DeliveryOrder.OrderStatus.DELIVERED));

        assertEquals(2, batch.getQuantityRemaining());
        assertEquals(DeliveryOrder.OrderStatus.RETURNED, order.getStatus());
        verify(stockBatchRepository, never()).save(any());
        verify(deliveryOrderRepository, never()).save(any());
    }

    @Test
    void creatingCustomItemDoesNotReadOrChangeInventory() {
        DeliveryOrderRequest.DeliveryOrderItemRequest itemRequest = new DeliveryOrderRequest.DeliveryOrderItemRequest();
        itemRequest.setCustomItemName("Special order item");
        itemRequest.setCustomDescription("Customer supplied request");
        itemRequest.setBaseCost(new BigDecimal("12.50"));
        itemRequest.setSellingPrice(new BigDecimal("18.00"));
        itemRequest.setQuantity(2);

        when(deliveryOrderRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(deliveryOrderItemRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        DeliveryOrderDto result = deliveryOrderService.createOrder(DeliveryOrderRequest.builder()
                .paymentMethod(DeliveryOrder.PaymentMethod.COD)
                .items(List.of(itemRequest))
                .build());

        assertEquals("Special order item", result.getItems().get(0).getProductName());
        assertEquals(new BigDecimal("12.50"), result.getItems().get(0).getPurchasePrice());
        assertEquals(new BigDecimal("18.00"), result.getItems().get(0).getSellingPrice());
        verifyNoInteractions(productRepository, stockBatchRepository, batchExpenseRepository);
    }

    private DeliveryOrder order(DeliveryOrder.OrderStatus status, StockBatch batch, int quantity) {
        Product product = Product.builder().id(7L).name("Test product").build();
        DeliveryOrderItem item = DeliveryOrderItem.builder()
                .product(product)
                .batch(batch)
                .quantity(quantity)
                .build();
        return DeliveryOrder.builder()
                .id(1L)
                .status(status)
                .paymentMethod(DeliveryOrder.PaymentMethod.COD)
                .orderDate(LocalDateTime.of(2026, 10, 1, 12, 0))
                .codAmount(BigDecimal.ZERO)
                .deliveryFee(BigDecimal.ZERO)
                .items(new ArrayList<>(List.of(item)))
                .build();
    }
}