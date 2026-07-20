package com.dcore.backend.service;

import com.dcore.backend.entity.Role;
import com.dcore.backend.entity.User;
import com.dcore.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
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
