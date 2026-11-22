package com.dcore.backend.controller;

import com.dcore.backend.dto.DeliveryOrderDto;
import com.dcore.backend.dto.DeliveryOrderRequest;
import com.dcore.backend.entity.DeliveryOrder;
import com.dcore.backend.service.DeliveryOrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/delivery-orders")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DeliveryOrderController {
    private final DeliveryOrderService deliveryOrderService;

    @PostMapping
    public ResponseEntity<DeliveryOrderDto> createOrder(@RequestBody DeliveryOrderRequest request) {
        return ResponseEntity.ok(deliveryOrderService.createOrder(request));
    }

    @GetMapping
    public ResponseEntity<List<DeliveryOrderDto>> getAllOrders() {
        return ResponseEntity.ok(deliveryOrderService.getAllOrders());
    }

    @GetMapping("/delivered")
    public ResponseEntity<List<DeliveryOrderDto>> getAllDeliveredOrders() {
        LocalDate today = LocalDate.now();

        int year = today.getYear();
        int month = today.getMonthValue();
        return ResponseEntity.ok(deliveryOrderService.getAllDeliveredOrdersWithinMonth(year, month));
    }


    @PutMapping("/{id}")
    public ResponseEntity<DeliveryOrderDto> updateOrder(
            @PathVariable Long id,
            @RequestBody DeliveryOrderRequest request) {
        return ResponseEntity.ok(deliveryOrderService.updateOrder(id, request));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<DeliveryOrderDto> updateStatus(
            @PathVariable Long id,
            @RequestParam DeliveryOrder.OrderStatus status) {
        return ResponseEntity.ok(deliveryOrderService.updateStatus(id, status));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteOrder(@PathVariable Long id) {
        deliveryOrderService.deletePendingOrder(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/auto-complete")
    public ResponseEntity<Integer> autoComplete() {
        return ResponseEntity.ok(deliveryOrderService.autoCompleteOldOrders());
    }
}
