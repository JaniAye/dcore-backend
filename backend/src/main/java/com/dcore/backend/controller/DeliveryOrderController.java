package com.dcore.backend.controller;

import com.dcore.backend.dto.DeliveryOrderDto;
import com.dcore.backend.dto.DeliveryOrderRequest;
import com.dcore.backend.entity.DeliveryOrder;
import com.dcore.backend.service.DeliveryOrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
