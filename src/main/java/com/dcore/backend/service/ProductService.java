package com.dcore.backend.service;

import com.dcore.backend.dto.CreateProductRequest;
import com.dcore.backend.dto.ProductDto;
import com.dcore.backend.entity.Category;
import com.dcore.backend.entity.Product;
import com.dcore.backend.entity.StockBatch;
import com.dcore.backend.repository.CategoryRepository;
import com.dcore.backend.repository.ProductRepository;
import com.dcore.backend.repository.StockBatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final StockBatchRepository stockBatchRepository;

    public ProductDto createProduct(CreateProductRequest request) {
        Category category = null;
        if (request.getCategoryId() != null) {
            category = categoryRepository.findById(request.getCategoryId()).orElse(null);
        }

        Product product = Product.builder()
                .itemCode(request.getItemCode())
                .name(request.getName())
                .description(request.getDescription())
                .category(category)
                .modelsSupported(request.getModelsSupported())
                .imageUrl(request.getImageUrl())
                .baseSellingPrice(request.getBaseSellingPrice())
                .minSellingPrice(request.getMinSellingPrice())
                .build();

        return mapToDto(productRepository.save(product));
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

    private ProductDto mapToDto(Product product) {
        List<StockBatch> batches = stockBatchRepository.findAvailableBatchesForProduct(product.getId());
        int totalStock = batches.stream().mapToInt(StockBatch::getQuantityRemaining).sum();

        return ProductDto.builder()
                .id(product.getId())
                .itemCode(product.getItemCode())
                .name(product.getName())
                .description(product.getDescription())
                .categoryId(product.getCategory() != null ? product.getCategory().getId() : null)
                .categoryName(product.getCategory() != null ? product.getCategory().getName() : null)
                .modelsSupported(product.getModelsSupported())
                .imageUrl(product.getImageUrl())
                .baseSellingPrice(product.getBaseSellingPrice())
                .minSellingPrice(product.getMinSellingPrice())
                .totalStock(totalStock)
                .build();
    }
}
