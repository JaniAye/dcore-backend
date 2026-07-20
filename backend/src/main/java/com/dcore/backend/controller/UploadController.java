package com.dcore.backend.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/uploads")
@RequiredArgsConstructor
public class UploadController {

    private static final String UPLOAD_DIR = "/app/uploads/";

    @PostMapping("/image")
    public ResponseEntity<Map<String, String>> uploadImage(@RequestParam("file") MultipartFile file) {
        try {
            // Ensure upload directory exists
            Path uploadPath = Paths.get(UPLOAD_DIR);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            // Generate a unique filename
            String extension = "";
            String originalName = file.getOriginalFilename();
            if (originalName != null && originalName.contains(".")) {
                extension = originalName.substring(originalName.lastIndexOf("."));
            }
            String filename = UUID.randomUUID() + extension;

            // Save the file
            Path filePath = uploadPath.resolve(filename);
            file.transferTo(filePath.toFile());

            // Return the public URL
            String url = "/uploads/" + filename;
            return ResponseEntity.ok(Map.of("url", url));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Upload failed: " + e.getMessage()));
        }
    }
}
