package com.dcore.backend.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DatabaseMigration {

    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void migratePricingColumns() {
        jdbcTemplate.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC(19, 2)");
        jdbcTemplate.execute("UPDATE products p SET wholesale_price = latest.selling_price "
                + "FROM (SELECT DISTINCT ON (product_id) product_id, selling_price "
                + "FROM stock_batches ORDER BY product_id, created_at DESC) latest "
                + "WHERE p.id = latest.product_id AND p.wholesale_price IS NULL");
        jdbcTemplate.execute("ALTER TABLE products DROP COLUMN IF EXISTS min_price");
    }
}