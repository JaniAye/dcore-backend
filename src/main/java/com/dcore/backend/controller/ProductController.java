package com.dcore.backend.controller;

import com.dcore.backend.dto.CreateProductRequest;
import com.dcore.backend.dto.ProductDto;
import com.dcore.backend.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @GetMapping
    public List<ProductDto> getAllProducts() {
        return productService.getAllProducts();
    }

    @PostMapping
    public ProductDto createProduct(@RequestBody CreateProductRequest request) {
        return productService.createProduct(request);
    }
    
    @GetMapping("/{id}")
    public ProductDto getProduct(@PathVariable Long id) {
        return productService.getProductById(id);
    }
}
