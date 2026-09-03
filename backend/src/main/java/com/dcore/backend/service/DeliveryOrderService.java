package com.dcore.backend.service;

import com.dcore.backend.dto.DeliveryOrderDto;
import com.dcore.backend.dto.DeliveryOrderRequest;
import com.dcore.backend.entity.*;
import com.dcore.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DeliveryOrderService {
    private final DeliveryOrderRepository deliveryOrderRepository;
    private final DeliveryOrderItemRepository deliveryOrderItemRepository;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final StockBatchRepository stockBatchRepository;
    private final BatchExpenseRepository batchExpenseRepository;

    @Transactional
    public DeliveryOrderDto createOrder(DeliveryOrderRequest request) {
        Customer customer = null;
        if (request.getCustomerId() != null) {
            customer = customerRepository.findById(request.getCustomerId())
                    .orElseThrow(() -> new RuntimeException("Customer not found"));
        }

        DeliveryOrder order = DeliveryOrder.builder()
                .customer(customer)
                .deliveryDetails(request.getDeliveryDetails())
                .orderDate(LocalDateTime.now())
                .status(DeliveryOrder.OrderStatus.PENDING)
                .paymentMethod(request.getPaymentMethod())
                .codAmount(request.getCodAmount())
                .deliveryFee(request.getDeliveryFee())
                .items(new ArrayList<>())
                .build();

        DeliveryOrder savedOrder = deliveryOrderRepository.save(order);
        List<DeliveryOrderItem> orderItems = new ArrayList<>();

        for (DeliveryOrderRequest.DeliveryOrderItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new RuntimeException("Product not found: " + itemReq.getProductId()));

            int remainingToDeduct = itemReq.getQuantity();
            List<StockBatch> batches = stockBatchRepository.findAvailableBatchesForProduct(product.getId());

            int totalAvailable = batches.stream().mapToInt(StockBatch::getQuantityRemaining).sum();
            if (totalAvailable < remainingToDeduct) {
                throw new RuntimeException("Insufficient stock for product: " + product.getName() + ". Available: " + totalAvailable);
            }

            for (StockBatch batch : batches) {
                if (remainingToDeduct <= 0) break;

                int deduct = Math.min(batch.getQuantityRemaining(), remainingToDeduct);
                batch.setQuantityRemaining(batch.getQuantityRemaining() - deduct);
                stockBatchRepository.save(batch);

                BigDecimal landedCost = calculateLandedCost(batch);

                DeliveryOrderItem orderItem = DeliveryOrderItem.builder()
                        .deliveryOrder(savedOrder)
                        .product(product)
                        .batch(batch)
                        .quantity(deduct)
                        .purchasePrice(landedCost)
                        .sellingPrice(product.getStandardPrice())
                        .build();
                
                orderItems.add(deliveryOrderItemRepository.save(orderItem));
                remainingToDeduct -= deduct;
            }
        }

        savedOrder.setItems(orderItems);
        return mapToDto(savedOrder);
    }

    private BigDecimal calculateLandedCost(StockBatch batch) {
        List<BatchExpense> expenses = batchExpenseRepository.findByBatchId(batch.getId());
        BigDecimal totalExpenses = expenses.stream()
                .map(BatchExpense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalBaseCost = batch.getBaseCost().multiply(BigDecimal.valueOf(batch.getQuantityInitial()));
        BigDecimal totalLandedCost = totalBaseCost.add(totalExpenses);
        
        if (batch.getQuantityInitial() == 0) return batch.getBaseCost();
        
        return totalLandedCost.divide(BigDecimal.valueOf(batch.getQuantityInitial()), 2, RoundingMode.HALF_UP);
    }

    @Transactional
    public DeliveryOrderDto updateStatus(Long orderId, DeliveryOrder.OrderStatus newStatus) {
        DeliveryOrder order = deliveryOrderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (order.getStatus() == DeliveryOrder.OrderStatus.RETURNED && newStatus != DeliveryOrder.OrderStatus.RETURNED) {
            throw new RuntimeException("Cannot change status of a returned order");
        }

        if (newStatus == DeliveryOrder.OrderStatus.PENDING
                && order.getStatus() != DeliveryOrder.OrderStatus.READY
                && order.getStatus() != DeliveryOrder.OrderStatus.DELIVERED) {
            throw new RuntimeException("Only ready or delivered orders can be marked pending");
        }

        if (newStatus == DeliveryOrder.OrderStatus.RETURNED && order.getStatus() != DeliveryOrder.OrderStatus.RETURNED) {
            // Restock items
            for (DeliveryOrderItem item : order.getItems()) {
                StockBatch batch = item.getBatch();
                batch.setQuantityRemaining(batch.getQuantityRemaining() + item.getQuantity());
                stockBatchRepository.save(batch);
            }
        }

        order.setStatus(newStatus);
        return mapToDto(deliveryOrderRepository.save(order));
    }

    @Transactional
    public void deletePendingOrder(Long orderId) {
        DeliveryOrder order = deliveryOrderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        if (order.getStatus() != DeliveryOrder.OrderStatus.PENDING) {
            throw new RuntimeException("Only pending orders can be deleted");
        }
        for (DeliveryOrderItem item : order.getItems()) {
            StockBatch batch = item.getBatch();
            batch.setQuantityRemaining(batch.getQuantityRemaining() + item.getQuantity());
            stockBatchRepository.save(batch);
        }
        deliveryOrderRepository.delete(order);
    }

    @Transactional
    public int autoCompleteOldOrders() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(8);
        List<DeliveryOrder> oldPendingOrders = deliveryOrderRepository.findAll().stream()
                .filter(o -> o.getStatus() == DeliveryOrder.OrderStatus.PENDING)
                .filter(o -> o.getOrderDate() != null && o.getOrderDate().isBefore(cutoff))
                .collect(Collectors.toList());

        for (DeliveryOrder order : oldPendingOrders) {
            order.setStatus(DeliveryOrder.OrderStatus.DELIVERED);
            deliveryOrderRepository.save(order);
        }

        return oldPendingOrders.size();
    }

    public List<DeliveryOrderDto> getAllOrders() {
        return deliveryOrderRepository.findAll().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    private DeliveryOrderDto mapToDto(DeliveryOrder order) {
        return DeliveryOrderDto.builder()
                .id(order.getId())
                .customerName(order.getCustomer() != null ? order.getCustomer().getName() : null)
                .customerMobile(order.getCustomer() != null ? order.getCustomer().getMobile() : null)
                .deliveryDetails(order.getDeliveryDetails())
                .orderDate(order.getOrderDate())
                .status(order.getStatus())
                .paymentMethod(order.getPaymentMethod())
                .codAmount(order.getCodAmount())
                .deliveryFee(order.getDeliveryFee())
                .items(order.getItems().stream().map(item -> 
                    DeliveryOrderDto.DeliveryOrderItemDto.builder()
                        .productId(item.getProduct().getId())
                        .productName(item.getProduct().getName())
                        .quantity(item.getQuantity())
                        .purchasePrice(item.getPurchasePrice())
                        .sellingPrice(item.getSellingPrice() != null
                            ? item.getSellingPrice()
                            : item.getProduct().getStandardPrice())
                        .build()
                ).collect(Collectors.toList()))
                .build();
    }
}
