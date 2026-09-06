package com.dcore.backend.service;

import com.dcore.backend.dto.CreateProductRequest;
import com.dcore.backend.dto.ProductDto;
import com.dcore.backend.entity.Product;
import com.dcore.backend.entity.StockBatch;
import com.dcore.backend.repository.ProductRepository;
import com.dcore.backend.repository.StockBatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class ProductService {

    private final ProductRepository productRepository;
    private final StockBatchRepository stockBatchRepository;

    public ProductDto createProduct(CreateProductRequest request) {
        if (productRepository.existsByActiveNameIgnoreCase(request.getName())) {
            throw new IllegalArgumentException("A product with this name already exists.");
        }
        Product product = Product.builder()
                .itemCode(request.getItemCode())
                .name(request.getName())
                .description(request.getDescription())
                .imageUrl(request.getImageUrl())
                .active(true)
                .standardPrice(
                        request.getStandardPrice() != null ? request.getStandardPrice() : java.math.BigDecimal.ZERO)
                .wholesalePrice(request.getWholesalePrice() != null ? request.getWholesalePrice()
                    : java.math.BigDecimal.ZERO)
                .build();

        return mapToDto(productRepository.save(product));
    }

    public ProductDto updateProduct(Long id, CreateProductRequest request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Product not found"));
        boolean activating = request.getActive() == null || request.getActive();
        if (activating && productRepository.existsByActiveNameIgnoreCaseAndIdNot(request.getName(), id)) {
            throw new IllegalArgumentException("A product with this name already exists.");
        }
        product.setItemCode(request.getItemCode());
        product.setName(request.getName());
        product.setDescription(request.getDescription());
        product.setImageUrl(request.getImageUrl());
        product.setActive(activating);
        product.setStandardPrice(request.getStandardPrice() != null ? request.getStandardPrice() : java.math.BigDecimal.ZERO);
        product.setWholesalePrice(request.getWholesalePrice() != null ? request.getWholesalePrice() : java.math.BigDecimal.ZERO);
        return mapToDto(productRepository.save(product));
    }

    public void deleteProduct(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Product not found"));
        product.setActive(false);
        productRepository.save(product);
    }

    public List<ProductDto> getAllProducts() {
        return productRepository.findAll().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    public ProductDto getProductById(Long id) {
        return productRepository.findById(id).map(this::mapToDto)
                .orElseThrow(() -> new RuntimeException("Product not found"));
    }

    public String generateNextItemCode() {
        return productRepository.findTopByOrderByItemCodeDesc()
                .map(p -> {
                    String code = p.getItemCode();
                    if (code != null && code.startsWith("DC-")) {
                        try {
                            String numPart = code.substring(3);
                            int num = Integer.parseInt(numPart);
                            return String.format("DC-%04d", num + 1);
                        } catch (NumberFormatException e) {
                            return "DC-0001";
                        }
                    }
                    return "DC-0001";
                })
                .orElse("DC-0001");
    }

    public boolean existsByName(String name) {
        return productRepository.existsByActiveNameIgnoreCase(name);
    }

    public List<ProductDto> searchByName(String query) {
        return productRepository.searchByName(query).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    private ProductDto mapToDto(Product product) {
        List<StockBatch> batches = stockBatchRepository.findAvailableBatchesForProduct(product.getId());
        int totalStock = batches.stream()
                .map(StockBatch::getQuantityRemaining)
                .filter(q -> q != null)
                .mapToInt(Integer::intValue)
                .sum();

        return ProductDto.builder()
                .id(product.getId())
                .itemCode(product.getItemCode())
                .name(product.getName())
                .description(product.getDescription())
                .imageUrl(product.getImageUrl())
                .active(product.getActive() == null || product.getActive())
                .standardPrice(product.getStandardPrice())
                .wholesalePrice(product.getWholesalePrice())
                .totalStock(totalStock)
                .build();
    }
}
