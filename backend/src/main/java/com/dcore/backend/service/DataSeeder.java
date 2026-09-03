package com.dcore.backend.service;

import com.dcore.backend.entity.Role;
import com.dcore.backend.entity.User;
import com.dcore.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) throws Exception {
        jdbcTemplate.execute("ALTER TABLE delivery_orders DROP CONSTRAINT IF EXISTS delivery_orders_status_check");
        jdbcTemplate.execute("ALTER TABLE delivery_orders ADD CONSTRAINT delivery_orders_status_check CHECK (status IN ('PENDING', 'READY', 'DELIVERED', 'RETURNED'))");

        if (userRepository.count() == 0) {
            User admin = User.builder()
                    .username("admin")
                    .password(passwordEncoder.encode("admin123"))
                    .name("Super Admin")
                    .role(Role.SUPER_ADMIN)
                    .build();
            userRepository.save(admin);
            
            User sales = User.builder()
                    .username("sales")
                    .password(passwordEncoder.encode("sales123"))
                    .name("Sales Person")
                    .role(Role.SALES_PERSON)
                    .build();
            userRepository.save(sales);
        }
    }
}
