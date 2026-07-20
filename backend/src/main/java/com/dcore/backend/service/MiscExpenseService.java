package com.dcore.backend.service;

import com.dcore.backend.dto.MiscExpenseDto;
import com.dcore.backend.entity.MiscExpense;
import com.dcore.backend.repository.MiscExpenseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MiscExpenseService {
    private final MiscExpenseRepository miscExpenseRepository;

    public MiscExpenseDto createExpense(MiscExpenseDto dto) {
        MiscExpense expense = MiscExpense.builder()
                .description(dto.getDescription())
                .amount(dto.getAmount())
                .expenseDate(dto.getExpenseDate() != null ? dto.getExpenseDate() : LocalDate.now())
                .category(dto.getCategory())
                .build();
        return mapToDto(miscExpenseRepository.save(expense));
    }

    public List<MiscExpenseDto> getAllExpenses() {
        return miscExpenseRepository.findAll().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    public void deleteExpense(Long id) {
        miscExpenseRepository.deleteById(id);
    }

    private MiscExpenseDto mapToDto(MiscExpense expense) {
        return MiscExpenseDto.builder()
                .id(expense.getId())
                .description(expense.getDescription())
                .amount(expense.getAmount())
                .expenseDate(expense.getExpenseDate())
                .category(expense.getCategory())
                .build();
    }
}
