package com.dcore.backend.controller;

import com.dcore.backend.dto.MiscExpenseDto;
import com.dcore.backend.service.MiscExpenseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/misc-expenses")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class MiscExpenseController {
    private final MiscExpenseService miscExpenseService;

    @PostMapping
    public ResponseEntity<MiscExpenseDto> createExpense(@RequestBody MiscExpenseDto dto) {
        return ResponseEntity.ok(miscExpenseService.createExpense(dto));
    }

    @GetMapping
    public ResponseEntity<List<MiscExpenseDto>> getAllExpenses() {
        return ResponseEntity.ok(miscExpenseService.getAllExpenses());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteExpense(@PathVariable Long id) {
        miscExpenseService.deleteExpense(id);
        return ResponseEntity.noContent().build();
    }
}
